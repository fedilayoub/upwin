import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { LanguageModelUsage } from 'ai';
import { AiEvaluationError } from '../../ai/model-registry.service';
import { assembleProfileAnalyzerPrompt } from '../../ai/prompts/profile-analyzer/assemble-profile-analyzer-prompt';
import type { AssembledProfileAnalyzerPrompt } from '../../ai/prompts/profile-analyzer/assemble-profile-analyzer-prompt';
import { DEFAULT_ANALYZER_TEMPLATE } from '../../ai/prompts/profile-analyzer/default-analyzer-template';
import type { AnalyzerTemplateContent } from '../../ai/prompts/prompt-template.schema';
import { PromptTemplatesService } from '../../ai/prompt-console/prompt-templates.service';
import type {
  Goal,
  ProfileAnalysisRow,
  ProfileRecommendationRow,
} from '../../database/schema';
import type { FreelancerContextFields } from '../../freelancer-context/freelancer-context.schema';
import { profileSnapshotFromRow } from '../../profile-snapshots/profile-snapshot-row';
import { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import type { GoalResponse } from '../../goals/goals.service';
import { GoalsService } from '../../goals/goals.service';
import {
  inspectProfile,
  targetJobProfileFromGoal,
} from './deterministic/profile-facts';
import { rubricVersion } from './rubric/upwork-profile-v1';
import {
  analysisUsageSchema,
  createProfileAnalysisSchema,
  sectionScoresSchema,
  type AnalysisUsage,
  type ListProfileAnalysesQuery,
} from './profile-analysis.schema';
import {
  type AnalysisListRecord,
  type PreviousAnalysisRecord,
  ProfileAnalysesRepository,
} from './profile-analyses.repository';
import { ProfileEvaluator } from './profile-evaluator.service';
import {
  InvalidRecommendationEvidenceError,
  rankRecommendations,
} from '../recommendations/rank-recommendations';
import {
  attachPreviousOutcomes,
  mergePreviousPriorityOutcomes,
  type RankedRecommendationWithOutcome,
} from '../recommendations/previous-priority-outcomes';
import {
  verifyPreviousPriorities,
  type PriorityOutcomeStatus,
} from '../recommendations/verify-previous-priorities';
import { buildCompletenessRecommendations } from '../recommendations/completeness-recommendations';
import { scoreProfileCompleteness } from '../scoring/profile-completeness';
import {
  InvalidAiCriterionScoreError,
  scoreProfile,
  type SectionScore,
} from '../scoring/profile-scoring';
import {
  getScoringWeights,
  scoringVersion,
} from '../scoring/weights/scoring-weights';
import { PROFILE_SECTION_IDS, type ProfileSectionId } from '../profile-section';

interface AnalysisRecommendationResponseBase {
  id: string;
  section: ProfileSectionId;
  rank: number;
  impact: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  recommendation: string;
  reason: string;
  evidence: string[];
  /**
   * Present only when a previous analysis already raised this same priority,
   * with the verdict on whether the freelancer acted on it. Omitted entirely
   * otherwise, so a client that predates the field still parses the response.
   */
  previousOutcome?: {
    status: PriorityOutcomeStatus;
    note: string;
  };
}

export interface AnalysisFillRecommendationResponse extends AnalysisRecommendationResponseBase {
  kind: 'fill';
  field: null;
  itemIndex: null;
  guidance: string;
  items: string[];
}

export type AnalysisRecommendationResponse =
  AnalysisRecommendationResponseBase | AnalysisFillRecommendationResponse;

export interface ProfileAnalysisResponse {
  id: string;
  createdAt: string;
  winningScore: number;
  completenessScore: number | null;
  previousWinningScore: number | null;
  goal: {
    id: string;
    objective: GoalResponse['objective'];
    targetRole: string;
  };
  summary: string;
  strongestSection: ProfileSectionId;
  biggestOpportunity: ProfileSectionId;
  sectionScores: SectionScore[];
  priorities: AnalysisRecommendationResponse[];
  versions: {
    prompt: string;
    rubric: string;
    scoring: string;
    requestedModel: string;
    provider: string;
    model: string;
    gateway?: string;
  };
}

export interface ProfileAnalysisListResponse {
  items: Array<{
    id: string;
    createdAt: string;
    winningScore: number;
    sectionScores: SectionScore[];
    goal: {
      id: string;
      objective: GoalResponse['objective'];
      targetRole: string;
    };
  }>;
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ProfileAnalysisProgressResponse {
  latest: {
    id: string;
    createdAt: string;
    winningScore: number;
  } | null;
  deltaSinceFirst: number | null;
  trend: Array<{
    id: string;
    createdAt: string;
    winningScore: number;
  }>;
  sectionDeltas: Array<{
    id: ProfileSectionId;
    firstScore: number;
    latestScore: number;
    delta: number | null;
  }>;
}

export interface ComputedProfileAnalysis {
  prompt: AssembledProfileAnalyzerPrompt;
  winningScore: number;
  completenessScore: number | null;
  sectionScores: SectionScore[];
  summary: string;
  requestedModel: string;
  gateway: string | null;
  provider: string;
  model: string;
  usage: AnalysisUsage;
  recommendations: RankedRecommendationWithOutcome[];
}

@Injectable()
export class ProfileAnalysesService {
  constructor(
    private readonly goals: GoalsService,
    private readonly contexts: FreelancerContextService,
    private readonly evaluator: ProfileEvaluator,
    private readonly repository: ProfileAnalysesRepository,
    @Optional() private readonly promptTemplates?: PromptTemplatesService,
  ) {}

  async create(
    authenticatedUserId: string,
    input: unknown,
  ): Promise<ProfileAnalysisResponse> {
    const parsed = createProfileAnalysisSchema.safeParse(input);
    if (!parsed.success) throw invalidSnapshot();

    const goal = await this.goals.findForAnalysis(
      authenticatedUserId,
      parsed.data.goalId,
    );
    if (!goal) {
      if (parsed.data.goalId !== undefined) throw analysisNotFound('Goal');
      throw new ConflictException({
        code: 'NO_ACTIVE_GOAL',
        message: 'Configure an active goal before analyzing your profile.',
      });
    }

    const context =
      await this.contexts.findConfirmedByUserId(authenticatedUserId);
    if (!context) {
      throw new ConflictException({
        code: 'CONTEXT_INCOMPLETE',
        message:
          'Confirm your freelancer context before analyzing your profile.',
      });
    }

    return this.evaluateAndPersist(
      authenticatedUserId,
      goal,
      context,
      parsed.data.snapshot,
    );
  }

  async list(
    authenticatedUserId: string,
    query: ListProfileAnalysesQuery,
  ): Promise<ProfileAnalysisListResponse> {
    const result = await this.repository.list(
      authenticatedUserId,
      query.cursor,
      query.pageSize,
    );

    return {
      items: result.records.map(toListItem),
      pageSize: query.pageSize,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  }

  async progress(
    authenticatedUserId: string,
  ): Promise<ProfileAnalysisProgressResponse> {
    const records = await this.repository.listForProgress(authenticatedUserId);
    const first = records[0];
    const latest = records.at(-1);
    if (!first || !latest) {
      return {
        latest: null,
        deltaSinceFirst: null,
        trend: [],
        sectionDeltas: [],
      };
    }

    const firstScores = scoreMap(first.sectionScores);
    const latestScores = scoreMap(latest.sectionScores);
    const hasComparison = records.length > 1;

    return {
      latest: toTrendItem(latest),
      deltaSinceFirst: hasComparison
        ? latest.winningScore - first.winningScore
        : null,
      trend: records.map(toTrendItem),
      sectionDeltas: PROFILE_SECTION_IDS.map((id) => {
        const firstScore = requiredScore(firstScores, id);
        const latestScore = requiredScore(latestScores, id);

        return {
          id,
          firstScore,
          latestScore,
          delta: hasComparison ? latestScore - firstScore : null,
        };
      }),
    };
  }

  async get(
    authenticatedUserId: string,
    analysisId: string,
  ): Promise<ProfileAnalysisResponse> {
    const record = await this.repository.findById(
      authenticatedUserId,
      analysisId,
    );
    if (!record) throw analysisNotFound('Analysis');
    return toAnalysisResponse(record);
  }

  async computeAnalysis(
    goal: GoalResponse,
    context: FreelancerContextFields,
    snapshot: Parameters<typeof inspectProfile>[0],
    template: AnalyzerTemplateContent,
    revisionNumber: number | null,
    previous: PreviousAnalysisRecord | null = null,
  ): Promise<ComputedProfileAnalysis> {
    const targetJobProfile = targetJobProfileFromGoal(goal);
    const facts = inspectProfile(snapshot, targetJobProfile);
    // Completeness priorities are settled from the new snapshot alone, so only
    // the ones that turn on writing quality are put to the model (spec 14).
    const verified =
      previous === null
        ? null
        : verifyPreviousPriorities(previous.priorities, facts);
    const prompt = assembleProfileAnalyzerPrompt(
      {
        goal,
        context,
        targetJobProfile,
        snapshot,
        facts,
        previousPriorities: verified?.undecided ?? [],
      },
      template,
      revisionNumber,
    );

    let evaluation;
    try {
      evaluation = await this.evaluator.evaluate(prompt);
    } catch (error: unknown) {
      throw aiEvaluationFailed(error);
    }

    const weights = getScoringWeights(goal.objective);
    let score;
    let recommendations: RankedRecommendationWithOutcome[];
    try {
      score = scoreProfile(evaluation.object, facts, weights);
      const completenessRecommendations = buildCompletenessRecommendations(
        facts,
        {
          objective: goal.objective,
          targetRole: goal.targetRole,
        },
      );
      recommendations = rankRecommendations(
        evaluation.object.priorities,
        score.sectionScores,
        weights,
        facts,
        completenessRecommendations,
      );
      if (previous !== null && verified !== null) {
        recommendations = attachPreviousOutcomes(recommendations, facts, {
          analysisId: previous.analysisId,
          priorities: previous.priorities,
          facts: inspectProfile(
            profileSnapshotFromRow(previous.snapshot),
            targetJobProfile,
          ),
          outcomes: mergePreviousPriorityOutcomes(
            verified.decided,
            evaluation.object.previousPriorityReviews,
            prompt.previousPriorityRefs,
          ),
        });
      }
    } catch (error: unknown) {
      if (
        error instanceof AiEvaluationError ||
        error instanceof InvalidAiCriterionScoreError ||
        error instanceof InvalidRecommendationEvidenceError
      ) {
        throw aiEvaluationFailed(error);
      }
      throw error;
    }

    return {
      prompt,
      winningScore: score.winningScore,
      completenessScore: scoreProfileCompleteness(facts).score,
      sectionScores: score.sectionScores,
      summary: evaluation.object.summary,
      requestedModel: evaluation.requestedModelId,
      gateway: evaluation.gateway ?? null,
      provider: evaluation.provider,
      model: evaluation.model,
      usage: normalizeUsage(evaluation.usage),
      recommendations,
    };
  }

  private async evaluateAndPersist(
    userId: string,
    goal: GoalResponse,
    context: FreelancerContextFields,
    snapshot: Parameters<typeof inspectProfile>[0],
  ): Promise<ProfileAnalysisResponse> {
    const resolved = this.promptTemplates
      ? await this.promptTemplates.resolveAnalyzer()
      : {
          content: DEFAULT_ANALYZER_TEMPLATE,
          revisionNumber: null,
          revisionId: null,
        };
    // Read before the AI call and threaded through explicitly. The persist
    // transaction must not re-derive "previous" for itself: that read happens
    // after the model call, so a concurrent analysis landing in between would
    // attach verdicts to the wrong analysis.
    const previous = await this.repository.findPreviousForOutcomes(
      userId,
      goal.id,
    );
    const computed = await this.computeAnalysis(
      goal,
      context,
      snapshot,
      resolved.content,
      resolved.revisionNumber,
      previous,
    );
    const persisted = await this.repository.persist({
      userId,
      goalId: goal.id,
      snapshot,
      winningScore: computed.winningScore,
      completenessScore: computed.completenessScore,
      sectionScores: computed.sectionScores,
      summary: computed.summary,
      promptVersion: computed.prompt.promptVersion,
      promptRevisionId: resolved.revisionId,
      rubricVersion,
      scoringVersion,
      requestedModel: computed.requestedModel,
      gateway: computed.gateway,
      provider: computed.provider,
      model: computed.model,
      usage: computed.usage,
      recommendations: computed.recommendations,
    });

    return toAnalysisResponse({ ...persisted, goal });
  }
}

function normalizeUsage(usage: LanguageModelUsage): AnalysisUsage {
  return analysisUsageSchema.parse({
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
  });
}

interface AnalysisResponseRecord {
  analysis: ProfileAnalysisRow;
  recommendations: ProfileRecommendationRow[];
  previousWinningScore: number | null;
  goal: Pick<Goal, 'id' | 'objective' | 'targetRole'>;
}

function toAnalysisResponse(
  record: AnalysisResponseRecord,
): ProfileAnalysisResponse {
  const sectionScores = sectionScoresSchema.parse(
    record.analysis.sectionScores,
  );
  const strongestSection = extremeSection(sectionScores, 'maximum');
  const biggestOpportunity = extremeSection(sectionScores, 'minimum');
  const priorities = [...record.recommendations]
    .sort((left, right) => left.rank - right.rank)
    .slice(0, 3)
    .map(toRecommendationResponse);

  return {
    id: record.analysis.id,
    createdAt: record.analysis.createdAt.toISOString(),
    winningScore: record.analysis.winningScore,
    completenessScore: record.analysis.completenessScore,
    previousWinningScore: record.previousWinningScore,
    goal: {
      id: record.goal.id,
      objective: record.goal.objective,
      targetRole: record.goal.targetRole,
    },
    summary: record.analysis.summary,
    strongestSection,
    biggestOpportunity,
    sectionScores,
    priorities,
    versions: {
      prompt: record.analysis.promptVersion,
      rubric: record.analysis.rubricVersion,
      scoring: record.analysis.scoringVersion,
      requestedModel: record.analysis.requestedModel,
      provider: record.analysis.provider,
      model: record.analysis.model,
      ...(record.analysis.gateway === null
        ? {}
        : { gateway: record.analysis.gateway }),
    },
  };
}

function toRecommendationResponse(
  recommendation: ProfileRecommendationRow,
): AnalysisRecommendationResponse {
  const base: AnalysisRecommendationResponseBase = {
    id: recommendation.id,
    section: recommendation.section,
    impact: recommendation.impact,
    recommendation: recommendation.recommendation,
    reason: recommendation.reason,
    evidence: recommendation.evidence,
    rank: recommendation.rank,
    estimatedMinutes: recommendation.estimatedMinutes,
    ...(recommendation.outcomeStatus === null ||
    recommendation.outcomeNote === null
      ? {}
      : {
          previousOutcome: {
            status: recommendation.outcomeStatus,
            note: recommendation.outcomeNote,
          },
        }),
  };

  if (
    recommendation.kind === 'fill' &&
    recommendation.variantIndex === null &&
    recommendation.field === null &&
    recommendation.itemIndex === null &&
    recommendation.guidance !== null &&
    recommendation.items !== null
  ) {
    return {
      ...base,
      kind: 'fill',
      field: null,
      itemIndex: null,
      guidance: recommendation.guidance,
      items: recommendation.items,
    };
  }

  return base;
}

function toListItem(
  record: AnalysisListRecord,
): ProfileAnalysisListResponse['items'][number] {
  return {
    id: record.analysis.id,
    createdAt: record.analysis.createdAt.toISOString(),
    winningScore: record.analysis.winningScore,
    sectionScores: sectionScoresSchema.parse(record.analysis.sectionScores),
    goal: {
      id: record.goal.id,
      objective: record.goal.objective,
      targetRole: record.goal.targetRole,
    },
  };
}

function toTrendItem(record: {
  id: string;
  createdAt: Date;
  winningScore: number;
}): ProfileAnalysisProgressResponse['trend'][number] {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    winningScore: record.winningScore,
  };
}

function scoreMap(
  persistedScores: ProfileAnalysisRow['sectionScores'],
): Map<ProfileSectionId, number> {
  return new Map(
    sectionScoresSchema
      .parse(persistedScores)
      .map(({ id, score }) => [id, score]),
  );
}

function requiredScore(
  scores: Map<ProfileSectionId, number>,
  id: ProfileSectionId,
): number {
  const score = scores.get(id);
  if (score === undefined) {
    throw new Error(`Persisted analysis is missing the ${id} section score.`);
  }
  return score;
}

function extremeSection(
  scores: SectionScore[],
  direction: 'minimum' | 'maximum',
): ProfileSectionId {
  const first = scores[0];
  if (!first) throw new Error('Section scores must not be empty.');

  return scores.reduce((selected, candidate) => {
    const shouldReplace =
      direction === 'maximum'
        ? candidate.score > selected.score
        : candidate.score < selected.score;
    return shouldReplace ? candidate : selected;
  }, first).id;
}

function invalidSnapshot(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'SNAPSHOT_INVALID',
    message: 'The profile snapshot is invalid.',
  });
}

function analysisNotFound(resource: string): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: `${resource} not found.`,
  });
}

function aiEvaluationFailed(cause: unknown): BadGatewayException {
  return new BadGatewayException(
    {
      code: 'AI_EVALUATION_FAILED',
      message: 'The AI evaluation could not be completed.',
    },
    { cause },
  );
}
