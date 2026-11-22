import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LanguageModelUsage } from 'ai';
import { z } from 'zod';
import { AiEvaluationError } from '../../ai/model-registry.service';
import { assembleProfileImproverPrompt } from '../../ai/prompts/profile-improver/assemble-profile-improver-prompt';
import type { ProfileRecommendationRow } from '../../database/schema';
import { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import { GoalsService } from '../../goals/goals.service';
import { profileSnapshotFromRow } from '../../profile-snapshots/profile-snapshot-row';
import type { ProfileSnapshot } from '../../profile-snapshots/profile-snapshot.schema';
import {
  analysisUsageSchema,
  type AnalysisUsage,
} from '../analysis/profile-analysis.schema';
import {
  inspectProfile,
  targetJobProfileFromGoal,
} from '../analysis/deterministic/profile-facts';
import { PROFILE_SECTION_IDS, type ProfileSectionId } from '../profile-section';
import { rankMissingPortfolioProjects } from '../recommendations/portfolio-gap';
import { ProfileImprover } from './profile-improver.service';
import {
  createProfileSuggestionRequestSchema,
  type PersistedSuggestionStyle,
  type ProfileSuggestionField,
  type ProfileSuggestionFillDraft,
  type ProfileSuggestionRewriteDraft,
  updateRecommendationStatusSchema,
} from './profile-suggestion.schema';
import {
  ProfileSuggestionsRepository,
  SUGGESTION_VARIANT_INDEX,
} from './profile-suggestions.repository';
import {
  resolveSuggestionTarget,
  type ProfileSuggestionTarget,
} from './suggestion-target';

const profileSectionSchema = z.enum(PROFILE_SECTION_IDS);

interface ProfileSuggestionResponseBase {
  id: string;
  section: ProfileSectionId;
  field: ProfileSuggestionField | null;
  itemIndex: number | null;
  explanation: string;
  impact: 'high' | 'medium' | 'low';
}

export interface ProfileSuggestionRewriteResponse extends ProfileSuggestionResponseBase {
  kind: 'rewrite';
  originalValue?: string;
  suggestedValue: string;
}

export interface ProfileSuggestionFillResponse extends ProfileSuggestionResponseBase {
  kind: 'fill';
  guidance: string;
  items: string[];
}

export type ProfileSuggestionResponse =
  ProfileSuggestionRewriteResponse | ProfileSuggestionFillResponse;

export interface RecommendationStatusResponse {
  id: string;
  status: 'copied' | 'dismissed';
}

@Injectable()
export class ProfileSuggestionsService {
  constructor(
    private readonly goals: GoalsService,
    private readonly contexts: FreelancerContextService,
    private readonly improver: ProfileImprover,
    private readonly repository: ProfileSuggestionsRepository,
  ) {}

  async create(
    userId: string,
    analysisId: string,
    rawSection: string,
    input: unknown,
  ): Promise<ProfileSuggestionResponse> {
    const section = profileSectionSchema.safeParse(rawSection);
    const request = createProfileSuggestionRequestSchema.safeParse(input);
    if (!section.success || !request.success) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'The profile suggestion request is invalid.',
      });
    }

    const suggestionStyle: PersistedSuggestionStyle =
      request.data.style ?? 'default';
    const source = await this.repository.findSource(userId, analysisId);
    if (!source) throw suggestionNotFound('Analysis');

    const context = await this.contexts.findConfirmedByUserId(userId);
    if (!context) {
      throw new ConflictException({
        code: 'CONTEXT_INCOMPLETE',
        message:
          'Confirm your freelancer context before generating profile suggestions.',
      });
    }

    const snapshot = profileSnapshotFromRow(source.snapshot);
    const goal = await this.goals.findForAnalysis(userId, source.goalId);
    if (!goal) throw suggestionNotFound('Analysis');
    const targetJobProfile = targetJobProfileFromGoal(goal);
    const facts = inspectProfile(snapshot, targetJobProfile);
    const target = resolveSuggestionTarget(section.data, facts);
    const originalValue = readOriginalValue(snapshot, target);

    // Reopening a priority must show the same advice, so a suggestion is
    // generated once per analysis and reused from here on.
    const existing = await this.repository.findExistingSuggestion(
      userId,
      analysisId,
      section.data,
      target.itemIndex,
      suggestionStyle,
    );
    if (existing) return persistedSuggestionResponse(existing, section.data);

    const rankedMissingPortfolioProjects = rankMissingPortfolioProjects(
      snapshot.profile.portfolio,
      context.portfolio,
      targetJobProfile,
    );
    const prompt = assembleProfileImproverPrompt({
      goal,
      context,
      targetJobProfile,
      snapshot,
      section: section.data,
      style: request.data.style,
      target,
      originalValue: originalValue ?? null,
      rankedMissingPortfolioProjects,
    });

    let improvement;
    try {
      improvement = await this.improver.improve(
        prompt,
        {
          context,
          goal,
          snapshot,
          targetJobProfile,
          target,
          originalValue: originalValue ?? null,
          rankedMissingPortfolioProjects,
        },
        SUGGESTION_VARIANT_INDEX,
      );
    } catch (error: unknown) {
      if (error instanceof AiEvaluationError) throw aiEvaluationFailed(error);
      throw error;
    }

    const persisted = await this.repository.persistSuggestion({
      userId,
      analysisId,
      section: section.data,
      impact: improvement.object.impact,
      kind: improvement.object.kind,
      field: target.field,
      itemIndex: target.itemIndex,
      originalValue: originalValue ?? null,
      suggestedValue:
        improvement.object.kind === 'rewrite'
          ? improvement.object.suggestedValue
          : null,
      guidance:
        improvement.object.kind === 'fill'
          ? improvement.object.guidance
          : null,
      items:
        improvement.object.kind === 'fill' ? improvement.object.items : null,
      explanation: improvement.object.explanation,
      suggestionStyle,
      promptVersion: improvement.promptVersion,
      requestedModel: improvement.requestedModelId,
      gateway: improvement.gateway ?? null,
      provider: improvement.provider,
      model: improvement.model,
      usage: normalizeUsage(improvement.usage),
    });
    if (!persisted) throw suggestionNotFound('Analysis');

    const responseBase: ProfileSuggestionResponseBase = {
      id: persisted.id,
      section: section.data,
      field: target.field,
      itemIndex: target.itemIndex,
      explanation: improvement.object.explanation,
      impact: improvement.object.impact,
    };

    return improvement.object.kind === 'rewrite'
      ? rewriteResponse(responseBase, improvement.object, originalValue)
      : fillResponse(responseBase, improvement.object);
  }

  async updateStatus(
    userId: string,
    recommendationId: string,
    input: unknown,
  ): Promise<RecommendationStatusResponse> {
    const parsed = updateRecommendationStatusSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'The recommendation status is invalid.',
      });
    }

    const updated = await this.repository.updateStatus(
      userId,
      recommendationId,
      parsed.data.status,
    );
    if (!updated) throw suggestionNotFound('Recommendation');

    return { id: updated.id, status: parsed.data.status };
  }
}

function normalizeUsage(usage: LanguageModelUsage): AnalysisUsage {
  return analysisUsageSchema.parse({
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
  });
}

function readOriginalValue(
  snapshot: ProfileSnapshot,
  target: ProfileSuggestionTarget,
): string | undefined {
  const { field, itemIndex } = target;
  if (field === 'title') return snapshot.profile.title;
  if (field === 'overview') return snapshot.profile.overview;
  if (field === 'skills' || itemIndex === null) return undefined;
  if (field === 'portfolio') {
    return snapshot.profile.portfolio[itemIndex]?.description;
  }

  return snapshot.profile.employment[itemIndex]?.description;
}

function rewriteResponse(
  base: ProfileSuggestionResponseBase,
  suggestion: ProfileSuggestionRewriteDraft,
  originalValue: string | undefined,
): ProfileSuggestionRewriteResponse {
  return {
    ...base,
    kind: 'rewrite',
    ...(originalValue === undefined ? {} : { originalValue }),
    suggestedValue: suggestion.suggestedValue,
  };
}

function fillResponse(
  base: ProfileSuggestionResponseBase,
  suggestion: ProfileSuggestionFillDraft,
): ProfileSuggestionFillResponse {
  return {
    ...base,
    kind: 'fill',
    guidance: suggestion.guidance,
    items: suggestion.items,
  };
}

/**
 * Rebuilds the response for an already-generated suggestion. Must produce the
 * same shape as the freshly generated path, since the client cannot tell the
 * two apart.
 */
function persistedSuggestionResponse(
  row: ProfileRecommendationRow,
  section: ProfileSectionId,
): ProfileSuggestionResponse {
  const base: ProfileSuggestionResponseBase = {
    id: row.id,
    section,
    field: row.field,
    itemIndex: row.itemIndex,
    explanation: row.reason,
    impact: row.impact,
  };

  if (row.kind === 'fill') {
    return {
      ...base,
      kind: 'fill',
      guidance: row.guidance ?? '',
      items: row.items ?? [],
    };
  }

  if (row.suggestedValue === null) {
    throw new Error(
      `Stored rewrite suggestion ${row.id} has no suggested value.`,
    );
  }

  return {
    ...base,
    kind: 'rewrite',
    ...(row.originalValue === null ? {} : { originalValue: row.originalValue }),
    suggestedValue: row.suggestedValue,
  };
}

function suggestionNotFound(resource: string): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: `${resource} not found.`,
  });
}

function aiEvaluationFailed(cause: unknown): BadGatewayException {
  return new BadGatewayException(
    {
      code: 'AI_EVALUATION_FAILED',
      message: 'The AI suggestion could not be completed.',
    },
    { cause },
  );
}
