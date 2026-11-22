import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { LanguageModelUsage } from 'ai';
import {
  AiEvaluationError,
  ModelRegistryService,
} from '../../ai/model-registry.service';
import { assembleProposalWriterPrompt } from '../../ai/prompts/proposal-writer/assemble-proposal-writer-prompt';
import type { ProposalWriterPromptInput } from '../../ai/prompts/proposal-writer/prompt-data';
import { proposalDraftSchema } from '../../ai/schemas/proposal-draft.schema';
import { hasUnsupportedNumericClaim } from '../../ai/validation/numeric-claims';
import { isInOtherLanguage } from '../../ai/validation/output-language';
import { ModelSelectionsService } from '../../ai/model-selections.service';
import type { ProposalDraftRow } from '../../database/schema';
import { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import { GoalsService } from '../../goals/goals.service';
import { jobSnapshotSchema } from '../../job-snapshots/job-snapshot.schema';
import {
  analysisUsageSchema,
  type AnalysisUsage,
} from '../../profile/analysis/profile-analysis.schema';
import type { ProposalPreferencesResponse } from '../../proposal-preferences/proposal-preferences.service';
import { ProposalPreferencesService } from '../../proposal-preferences/proposal-preferences.service';
import {
  resolveWordBudget,
  wordBudgetVersion,
} from '../../proposal-preferences/word-budgets';
import {
  createProposalDraftSchema,
  jobDimensionScoresSchema,
  proposalAnswerBlocksSchema,
  proposalBlockSchema,
  proposalBlockStatusesSchema,
  refineProposalDraftSchema,
  updateProposalDraftStatusSchema,
  type PersistedProposalAnswer,
  type PersistedProposalBlock,
} from '../job-analysis.schema';
import { JobMatchService } from '../analysis/job-match.service';
import { normalizeJobAnalysisUsage } from '../analysis/job-analyses.repository';
import { ProposalOutcomesRepository } from '../outcomes/proposal-outcomes.repository';
import {
  ProposalDraftsRepository,
  type ReplaceProposalDraftInput,
} from './proposal-drafts.repository';

interface ValidatedGeneration {
  proposal: { text: string; wordCount: number };
  answers: Array<{ position: number; text: string; wordCount: number }>;
  requestedModelId: string;
  gateway: string | undefined;
  provider: string;
  model: string;
  usage: LanguageModelUsage;
  promptVersion: string;
}

type ProposalWriterFactualInputs = Pick<
  ProposalWriterPromptInput,
  'context' | 'findings' | 'goal' | 'snapshot'
>;

export interface ProposalDraftResponse {
  id: string;
  jobAnalysisId: string;
  proposal: PersistedProposalBlock;
  answers: PersistedProposalAnswer[];
  versions: {
    prompt: string;
    requestedModel: string;
    gateway?: string;
    provider: string;
    model: string;
  };
  createdAt: string;
}

class DraftDomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftDomainValidationError';
  }
}

@Injectable()
export class ProposalWriterService {
  private readonly logger = new Logger(ProposalWriterService.name);

  constructor(
    private readonly matches: JobMatchService,
    private readonly goals: GoalsService,
    private readonly contexts: FreelancerContextService,
    private readonly preferences: ProposalPreferencesService,
    private readonly models: ModelRegistryService,
    private readonly modelSelections: ModelSelectionsService,
    private readonly repository: ProposalDraftsRepository,
    private readonly outcomes: ProposalOutcomesRepository,
  ) {}

  async create(
    userId: string,
    analysisId: string,
    input: unknown,
  ): Promise<ProposalDraftResponse> {
    if (!createProposalDraftSchema.safeParse(input).success) {
      throw invalidDraftRequest();
    }
    const source = await this.loadSource(userId, analysisId);
    const prompt = assembleProposalWriterPrompt(source.promptInput);
    const generated = await this.generateAndValidate(
      prompt,
      source.promptInput,
      source.promptInput.preferences,
      source.promptInput.snapshot.job.questions.map(
        (question) => question.position,
      ),
      0,
    );
    const proposal = proposalBlock(generated.proposal, 0);
    const answers = generated.answers.map((answer) => {
      const question = source.promptInput.snapshot.job.questions.find(
        (candidate) => candidate.position === answer.position,
      );
      if (!question)
        throw new DraftDomainValidationError('Question missing.');
      return answerBlock(answer, question.question, 0);
    });
    const persisted = await this.repository.persist({
      userId,
      jobAnalysisId: analysisId,
      proposal,
      answers,
      promptVersion: generated.promptVersion,
      wordBudgetVersion,
      requestedModel: generated.requestedModelId,
      gateway: generated.gateway ?? null,
      provider: generated.provider,
      model: generated.model,
      usage: normalizeUsage(generated.usage),
    });
    try {
      await this.outcomes.ensureTracked({
        userId,
        jobAnalysisId: analysisId,
        proposalDraftId: persisted.id,
        now: new Date(),
      });
    } catch {
      this.logger.warn(
        `Failed to enroll proposal draft ${persisted.id} in the application tracker.`,
      );
    }
    return toProposalDraftResponse(persisted);
  }

  async refine(
    userId: string,
    analysisId: string,
    input: unknown,
  ): Promise<ProposalDraftResponse> {
    const request = refineProposalDraftSchema.safeParse(input);
    if (!request.success) throw invalidDraftRequest();
    const source = await this.loadSource(userId, analysisId);
    const current = await this.repository.findLatestByAnalysis(
      userId,
      analysisId,
    );
    if (!current) throw draftNotFound();
    const proposal = proposalBlockSchema.parse(current.proposal);
    const answers = proposalAnswerBlocksSchema.parse(current.answers);
    const target = resolveTarget(
      request.data.blockId,
      proposal,
      answers,
      source.promptInput.snapshot.job.questions.length,
    );
    const variantIndex = target.variantIndex + 1;
    const prompt = assembleProposalWriterPrompt({
      ...source.promptInput,
      refinement: {
        blockId: request.data.blockId,
        refinement: request.data.refinement,
        existingDraft: {
          proposal: proposal.text,
          answers: answers.map((answer) => ({
            position: answer.position,
            answer: answer.text,
          })),
        },
      },
    });
    const generated = await this.generateAndValidate(
      prompt,
      source.promptInput,
      source.promptInput.preferences,
      source.promptInput.snapshot.job.questions.map(
        (question) => question.position,
      ),
      variantIndex,
    );
    const replacement = replacementBlocks(
      request.data.blockId,
      generated,
      proposal,
      answers,
      source.promptInput.snapshot,
      variantIndex,
    );
    const update: ReplaceProposalDraftInput = {
      ...replacement,
      promptVersion: generated.promptVersion,
      wordBudgetVersion,
      requestedModel: generated.requestedModelId,
      gateway: generated.gateway ?? null,
      provider: generated.provider,
      model: generated.model,
      usage: normalizeUsage(generated.usage),
    };
    const persisted = await this.repository.replaceGeneratedContent(
      userId,
      current.id,
      update,
    );
    if (!persisted) throw draftNotFound();
    return toProposalDraftResponse(persisted);
  }

  async updateStatus(
    userId: string,
    draftId: string,
    input: unknown,
  ): Promise<ProposalDraftResponse> {
    const request = updateProposalDraftStatusSchema.safeParse(input);
    if (!request.success) throw invalidDraftRequest();
    const current = await this.repository.findById(userId, draftId);
    if (!current) throw draftNotFound();
    const proposal = proposalBlockSchema.parse(current.proposal);
    const answers = proposalAnswerBlocksSchema.parse(current.answers);
    if (
      request.data.blockId !== proposal.blockId &&
      !answers.some((answer) => answer.blockId === request.data.blockId)
    ) {
      throw invalidDraftRequest();
    }
    const statuses = proposalBlockStatusesSchema.parse(current.blockStatuses);
    const persisted = await this.repository.updateStatuses(userId, draftId, {
      ...statuses,
      [request.data.blockId]: request.data.status,
    });
    if (!persisted) throw draftNotFound();
    return toProposalDraftResponse(persisted);
  }

  private async loadSource(userId: string, analysisId: string) {
    const source = await this.matches.findSource(userId, analysisId);
    const context = await this.contexts.findConfirmedByUserId(userId);
    if (!context) {
      throw new ConflictException({
        code: 'CONTEXT_INCOMPLETE',
        message:
          'Confirm your freelancer context before generating a proposal.',
      });
    }
    const goal = await this.goals.findForAnalysis(userId, source.goal.id);
    if (!goal) throw draftNotFound();
    const snapshot = jobSnapshotSchema.parse(source.snapshot.snapshot);
    const preferences = await this.preferences.get(userId);
    const promptInput: ProposalWriterPromptInput = {
      goal,
      context,
      snapshot,
      preferences,
      findings: {
        summary: source.analysis.summary,
        dimensions: jobDimensionScoresSchema.parse(
          source.analysis.dimensionScores,
        ),
        strengths: source.analysis.strengths,
        concerns: source.analysis.concerns,
      },
    };
    return { promptInput };
  }

  private async generateAndValidate(
    prompt: ReturnType<typeof assembleProposalWriterPrompt>,
    factualInputs: ProposalWriterFactualInputs,
    preferences: ProposalPreferencesResponse,
    expectedPositions: number[],
    variantIndex: number,
  ): Promise<ValidatedGeneration> {
    try {
      const selectedModels =
        await this.modelSelections.resolve('proposalWriter');
      const result = await this.models.evaluate({
        capability: 'proposalWriter',
        schema: proposalDraftSchema,
        schemaName: 'proposalDraft',
        system: prompt.system,
        prompt: prompt.prompt,
        temperature: 0.7,
        variantIndex,
        models: selectedModels,
      });
      validatePositions(result.object.answers, expectedPositions);
      const proposalWords = countWords(result.object.proposal);
      const answerWords = result.object.answers.map((answer) => ({
        position: answer.position,
        text: answer.answer.trim(),
        wordCount: countWords(answer.answer),
      }));
      const proposalText = result.object.proposal.trim();
      if (
        proposalText.length === 0 ||
        answerWords.some((answer) => answer.text.length === 0)
      ) {
        throw new DraftDomainValidationError('Draft blocks must not be empty.');
      }
      validateWordCeiling(
        proposalWords,
        resolveWordBudget(preferences.proposalLength).hardCeilingWords,
      );
      const answerCeiling = resolveWordBudget(
        preferences.answerLength,
      ).hardCeilingWords;
      for (const answer of answerWords) {
        validateWordCeiling(answer.wordCount, answerCeiling);
      }
      for (const text of [
        proposalText,
        ...answerWords.map((answer) => answer.text),
      ]) {
        if (
          hasUnsupportedNumericClaim(
            text,
            factualInputs.context,
            factualInputs.snapshot,
            factualInputs.goal,
            factualInputs.findings,
          )
        ) {
          throw new DraftDomainValidationError(
            'Draft contains a numeric claim absent from the factual inputs.',
          );
        }
      }
      validateLanguage(
        [proposalText, ...answerWords.map((answer) => answer.text)],
        preferences.language,
      );

      return {
        proposal: { text: proposalText, wordCount: proposalWords },
        answers: answerWords,
        requestedModelId: result.requestedModelId,
        gateway: result.gateway,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        promptVersion: prompt.promptVersion,
      };
    } catch (error: unknown) {
      if (
        error instanceof AiEvaluationError ||
        error instanceof DraftDomainValidationError
      ) {
        throw draftGenerationFailed(error);
      }
      throw error;
    }
  }
}

function validatePositions(
  answers: Array<{ position: number }>,
  expectedPositions: number[],
): void {
  const returned = answers.map((answer) => answer.position);
  if (
    returned.some(
      (position) => !Number.isFinite(position) || !Number.isInteger(position),
    ) ||
    new Set(returned).size !== returned.length ||
    returned.length !== expectedPositions.length ||
    returned.some((position) => !expectedPositions.includes(position))
  ) {
    throw new DraftDomainValidationError(
      'Screening-answer positions do not match the snapshot.',
    );
  }
}

function validateWordCeiling(wordCount: number, hardCeiling: number): void {
  if (wordCount <= hardCeiling) return;
  throw new DraftDomainValidationError(
    'A generated block exceeds its word ceiling.',
  );
}

export function countWords(value: string): number {
  const words = value.trim().match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu);
  return words?.length ?? 0;
}

function validateLanguage(
  blocks: string[],
  requested: ProposalPreferencesResponse['language'],
): void {
  const meaningfulBlocks = blocks.filter((block) => countWords(block) >= 8);
  for (const block of meaningfulBlocks) {
    if (isInOtherLanguage(block, requested)) {
      throw new DraftDomainValidationError(
        'A generated block does not use the requested language.',
      );
    }
  }
}

function proposalBlock(
  generated: ValidatedGeneration['proposal'],
  variantIndex: number,
): PersistedProposalBlock {
  return {
    blockId: 'proposal',
    text: generated.text,
    wordCount: generated.wordCount,
    variantIndex,
  };
}

function answerBlock(
  generated: ValidatedGeneration['answers'][number],
  question: string,
  variantIndex: number,
): PersistedProposalAnswer {
  return {
    blockId: `answer:${generated.position}`,
    position: generated.position,
    question,
    text: generated.text,
    wordCount: generated.wordCount,
    variantIndex,
  };
}

function resolveTarget(
  blockId: string,
  proposal: PersistedProposalBlock,
  answers: PersistedProposalAnswer[],
  questionCount: number,
): PersistedProposalBlock | PersistedProposalAnswer {
  if (blockId === 'proposal') return proposal;
  const target = answers.find((answer) => answer.blockId === blockId);
  if (target) return target;
  if (questionCount === 0 || blockId.startsWith('answer:')) {
    throw new ConflictException({
      code: 'NO_SCREENING_QUESTIONS',
      message: 'The job does not contain that screening question.',
    });
  }
  throw invalidDraftRequest();
}

function replacementBlocks(
  blockId: string,
  generated: ValidatedGeneration,
  proposal: PersistedProposalBlock,
  answers: PersistedProposalAnswer[],
  snapshot: ProposalWriterPromptInput['snapshot'],
  variantIndex: number,
): { proposal: PersistedProposalBlock; answers: PersistedProposalAnswer[] } {
  if (blockId === 'proposal') {
    return {
      proposal: proposalBlock(generated.proposal, variantIndex),
      answers,
    };
  }
  const position = Number(blockId.slice('answer:'.length));
  const generatedAnswer = generated.answers.find(
    (answer) => answer.position === position,
  );
  const question = snapshot.job.questions.find(
    (candidate) => candidate.position === position,
  );
  if (!generatedAnswer || !question) {
    throw new DraftDomainValidationError('Refined answer position is missing.');
  }
  return {
    proposal,
    answers: answers.map((answer) =>
      answer.position === position
        ? answerBlock(generatedAnswer, question.question, variantIndex)
        : answer,
    ),
  };
}

function normalizeUsage(usage: LanguageModelUsage): AnalysisUsage {
  return analysisUsageSchema.parse(normalizeJobAnalysisUsage(usage));
}

export function toProposalDraftResponse(
  draft: ProposalDraftRow,
): ProposalDraftResponse {
  return {
    id: draft.id,
    jobAnalysisId: draft.jobAnalysisId,
    proposal: proposalBlockSchema.parse(draft.proposal),
    answers: proposalAnswerBlocksSchema.parse(draft.answers),
    versions: {
      prompt: draft.promptVersion,
      requestedModel: draft.requestedModel,
      ...(draft.gateway === null ? {} : { gateway: draft.gateway }),
      provider: draft.provider,
      model: draft.model,
    },
    createdAt: draft.createdAt.toISOString(),
  };
}

function invalidDraftRequest(): BadRequestException {
  return new BadRequestException({
    code: 'BAD_REQUEST',
    message: 'The proposal draft request is invalid.',
  });
}

function draftNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Proposal draft not found.',
  });
}

function draftGenerationFailed(error: unknown): BadGatewayException {
  return new BadGatewayException(
    {
      code: 'DRAFT_GENERATION_FAILED',
      message: 'The proposal draft could not be generated.',
    },
    { cause: error instanceof Error ? error : undefined },
  );
}
