import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { AiEvaluationResult } from '../../ai/model-registry.service';
import {
  AiEvaluationError,
  ModelRegistryService,
} from '../../ai/model-registry.service';
import {
  hasUnsupportedNumericClaim,
  PAST_TENSE_ACHIEVEMENT_PATTERN,
} from '../../ai/validation/numeric-claims';
import type { ProfileImproverPromptData } from '../../ai/prompts/profile-improver/prompt-data';
import type { AssembledProfileImproverPrompt } from '../../ai/prompts/profile-improver/assemble-profile-improver-prompt';
import {
  buildProfileSuggestionSchema,
  type ModelProfileSuggestion,
} from '../../ai/schemas/profile-suggestion.schema';
import { stripModelNulls } from '../../ai/schemas/cv-extraction.schema';
import {
  profileSuggestionDomainSchema,
  UPWORK_TITLE_MAX_LENGTH,
  type ProfileSuggestionDraft,
} from './profile-suggestion.schema';
import type { ProfileSuggestionTarget } from './suggestion-target';

export interface ProfileImproverResult extends Omit<
  AiEvaluationResult<ModelProfileSuggestion>,
  'object'
> {
  object: ProfileSuggestionDraft;
  promptVersion: AssembledProfileImproverPrompt['promptVersion'];
}

interface ProfileImproverSource extends Pick<
  ProfileImproverPromptData,
  | 'context'
  | 'goal'
  | 'rankedMissingPortfolioProjects'
  | 'snapshot'
  | 'targetJobProfile'
> {
  originalValue: string | null;
  target: ProfileSuggestionTarget;
}

const normalizedModelSuggestionSchema = z
  .object({
    suggestedValue: z.string().optional(),
    guidance: z.string().optional(),
    items: z.array(z.string()).optional(),
    explanation: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
  })
  .strict();

/**
 * A suggestion the model produced but the domain rules rejected. Separate from
 * a provider or schema failure so only this case is worth resampling.
 */
export class ProfileSuggestionDomainError extends AiEvaluationError {
  constructor(cause: unknown) {
    super(cause);
    this.name = 'ProfileSuggestionDomainError';
  }
}

const PORTFOLIO_ABSENCE_PATTERN =
  /don't have|do not have|no portfolio|not have a portfolio/i;
const EMPTY_PORTFOLIO_PAST_WORK_PATTERN =
  /\bcase stud(?:y|ies)\b|\b(?:your|my|our)\s+(?:experience|role|results?|projects?)\b|\b(?:your|my|our)\s+work\s+(?:on|for|with|in)\b/iu;

@Injectable()
export class ProfileImprover {
  private readonly logger = new Logger(ProfileImprover.name);

  constructor(private readonly models: ModelRegistryService) {}

  async improve(
    prompt: AssembledProfileImproverPrompt,
    source: ProfileImproverSource,
    variantIndex: number,
  ): Promise<ProfileImproverResult> {
    try {
      return await this.attempt(prompt, source, variantIndex);
    } catch (error: unknown) {
      if (!(error instanceof ProfileSuggestionDomainError)) throw error;

      // The domain rules run after `evaluate` returns, so the SDK's own retries
      // and the primary-to-fallback hop are already spent by the time a
      // suggestion is rejected. One more sample recovers the common case — a
      // formatting slip such as prose in a skills item — instead of turning it
      // into a 502 the user cannot retry past. The variant index moves so
      // record/replay does not reuse the rejected sample's cassette.
      this.logger.warn(
        'Resampling the profile suggestion after domain validation rejected the first candidate.',
      );
      return this.attempt(prompt, source, variantIndex + 1);
    }
  }

  private async attempt(
    prompt: AssembledProfileImproverPrompt,
    source: ProfileImproverSource,
    variantIndex: number,
  ): Promise<ProfileImproverResult> {
    const result = await this.models.evaluate({
      capability: 'profileImprover',
      schema: buildProfileSuggestionSchema(source.target.field),
      schemaName: 'profileSuggestionV2',
      system: prompt.system,
      prompt: prompt.prompt,
      temperature: 0.7,
      variantIndex,
    });
    const normalized = normalizedModelSuggestionSchema.safeParse(
      stripModelNulls(result.object),
    );
    const candidate = normalized.success
      ? source.target.kind === 'rewrite'
        ? {
            kind: source.target.kind,
            field: source.target.field,
            itemIndex: source.target.itemIndex,
            suggestedValue: normalized.data.suggestedValue,
            explanation: normalized.data.explanation,
            impact: normalized.data.impact,
          }
        : {
            kind: source.target.kind,
            field: source.target.field,
            itemIndex: source.target.itemIndex,
            guidance: normalized.data.guidance,
            items: normalized.data.items,
            explanation: normalized.data.explanation,
            impact: normalized.data.impact,
          }
      : stripModelNulls(result.object);
    const domainSchema = profileSuggestionDomainSchema.superRefine(
      (suggestion, context) => {
        if (
          suggestion.kind === 'rewrite' &&
          hasUnsupportedNumericClaim(
            suggestion.suggestedValue,
            source.context,
            source.goal,
            source.snapshot.profile,
            source.targetJobProfile,
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['suggestedValue'],
            message:
              'Suggested copy contains a numeric claim absent from the input.',
          });
        }

        if (
          suggestion.kind === 'rewrite' &&
          suggestion.field === 'overview' &&
          source.originalValue !== null &&
          isUnsafePartialRewrite(
            source.originalValue,
            suggestion.suggestedValue,
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['suggestedValue'],
            message:
              'The overview rewrite is too short to be a complete replacement.',
          });
        }

        if (
          suggestion.kind === 'rewrite' &&
          suggestion.field === 'title' &&
          suggestion.suggestedValue.trim().length > UPWORK_TITLE_MAX_LENGTH
        ) {
          context.addIssue({
            code: 'custom',
            path: ['suggestedValue'],
            message: `A title rewrite must be at most ${UPWORK_TITLE_MAX_LENGTH} characters.`,
          });
        }

        if (suggestion.kind === 'fill') {
          const rankedPortfolioTitles =
            source.rankedMissingPortfolioProjects.map(
              (project) => project.title,
            );
          const hasRankedPortfolioTitles =
            suggestion.field === 'portfolio' &&
            rankedPortfolioTitles.length > 0;
          // A subset, in any order, is enough. Requiring the model to reproduce
          // the whole list verbatim and in position is the same brittleness as
          // demanding a verbatim evidence quote: it turns an editorial choice
          // into AI_EVALUATION_FAILED. What must hold is that every named
          // project is one the backend actually selected.
          const returnsRankedPortfolioTitles = suggestion.items.every((item) =>
            rankedPortfolioTitles.includes(item),
          );
          const fillText = [
            suggestion.guidance,
            ...suggestion.items,
            suggestion.explanation,
          ].join('\n');
          const fillNarrativeText = [
            suggestion.guidance,
            suggestion.explanation,
          ].join('\n');

          if (
            suggestion.field === 'portfolio' &&
            hasRankedPortfolioTitles &&
            !returnsRankedPortfolioTitles
          ) {
            context.addIssue({
              code: 'custom',
              path: ['items'],
              message:
                'Portfolio items must exactly match the backend-ranked CV project titles.',
            });
          }

          if (
            suggestion.field === 'portfolio' &&
            PORTFOLIO_ABSENCE_PATTERN.test(fillNarrativeText)
          ) {
            context.addIssue({
              code: 'custom',
              path: ['guidance'],
              message: 'Portfolio guidance must not describe the absence.',
            });
          }

          if (
            PAST_TENSE_ACHIEVEMENT_PATTERN.test(
              hasRankedPortfolioTitles ? fillNarrativeText : fillText,
            )
          ) {
            context.addIssue({
              code: 'custom',
              path: ['items'],
              message:
                'Fill items must describe work to create, not achievements.',
            });
          }

          if (
            suggestion.field === 'portfolio' &&
            source.snapshot.profile.portfolio.length === 0 &&
            source.context.portfolio.length === 0 &&
            EMPTY_PORTFOLIO_PAST_WORK_PATTERN.test(fillText)
          ) {
            context.addIssue({
              code: 'custom',
              path: ['items'],
              message:
                'An empty portfolio fill must propose new work, not imply past work exists.',
            });
          }

          if (suggestion.field === 'skills') {
            for (const [index, item] of suggestion.items.entries()) {
              if (!isSkillTag(item)) {
                context.addIssue({
                  code: 'custom',
                  path: ['items', index],
                  message: 'Skill items must be tag labels, not prose.',
                });
              }
            }
          }
        }
      },
    );
    const bounded = domainSchema.safeParse(candidate);

    if (!bounded.success) {
      // The global exception filter intentionally masks 500-class details. Log
      // only paths and issue codes so validation failures remain diagnosable
      // without recording profile values.
      this.logger.error(
        `Profile suggestion failed domain validation: ${bounded.error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.code}`)
          .join(', ')}`,
      );
      throw new ProfileSuggestionDomainError(bounded.error);
    }

    return {
      ...result,
      object: bounded.data,
      promptVersion: prompt.promptVersion,
    };
  }
}

export function isUnsafePartialRewrite(
  currentValue: string,
  suggestedValue: string,
): boolean {
  const currentLength = currentValue.trim().length;
  if (currentLength === 0) return false;
  return suggestedValue.trim().length < currentLength * 0.5;
}

function isSkillTag(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.split(/\s+/u).length <= 5 &&
    !/[.!?]/u.test(trimmed) &&
    !/^(?:add|include|learn|showcase)\s+/iu.test(trimmed)
  );
}
