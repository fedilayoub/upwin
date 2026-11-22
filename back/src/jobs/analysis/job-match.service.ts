import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AiEvaluationError,
  ModelRegistryService,
} from '../../ai/model-registry.service';
import { assembleJobMatchPrompt } from '../../ai/prompts/job-match/assemble-job-match-prompt';
import { jobMatchSchema } from '../../ai/schemas/job-match.schema';
import { ModelSelectionsService } from '../../ai/model-selections.service';
import type { JobAnalysisRow, JobSnapshotRow } from '../../database/schema';
import { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import { GoalsService } from '../../goals/goals.service';
import type { JobSnapshot } from '../../job-snapshots/job-snapshot.schema';
import { JobSnapshotsService } from '../../job-snapshots/job-snapshots.service';
import { ProfileSnapshotsService } from '../../profile-snapshots/profile-snapshots.service';
import {
  createJobAnalysisSchema,
  jobDimensionScoresSchema,
  type ListJobAnalysesQuery,
} from '../job-analysis.schema';
import { inspectJob } from './deterministic/job-facts';
import {
  JobAnalysesRepository,
  normalizeJobAnalysisUsage,
  type JobAnalysisDetailRecord,
} from './job-analyses.repository';
import { jobMatchRubricVersion } from './rubric/job-match-v1';
import {
  InvalidJobMatchCriterionScoreError,
  scoreJobMatch,
  type JobDimensionScore,
} from '../scoring/job-match-scoring';
import {
  getJobMatchWeights,
  jobMatchScoringVersion,
} from '../scoring/weights/job-match-weights';

export interface JobMatchResponse {
  id: string;
  jobSnapshotId: string;
  goalId: string;
  matchScore: number;
  summary: string;
  dimensions: JobDimensionScore[];
  strengths: string[];
  concerns: string[];
  questionCount: number;
  versions: {
    prompt: string;
    rubric: string;
    scoring: string;
    requestedModel: string;
    gateway?: string;
    provider: string;
    model: string;
  };
  createdAt: string;
}

export interface JobMatchListResponse {
  items: JobMatchResponse[];
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

@Injectable()
export class JobMatchService {
  constructor(
    private readonly goals: GoalsService,
    private readonly contexts: FreelancerContextService,
    private readonly jobSnapshots: JobSnapshotsService,
    private readonly profileSnapshots: ProfileSnapshotsService,
    private readonly models: ModelRegistryService,
    private readonly modelSelections: ModelSelectionsService,
    private readonly repository: JobAnalysesRepository,
  ) {}

  async create(userId: string, input: unknown): Promise<JobMatchResponse> {
    const parsed = createJobAnalysisSchema.safeParse(input);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        code: 'JOB_SNAPSHOT_INVALID',
        message: 'The job snapshot is invalid.',
      });
    }

    const goal = await this.goals.findForAnalysis(userId, parsed.data.goalId);
    if (!goal) {
      if (parsed.data.goalId !== undefined) throw jobResourceNotFound('Goal');
      throw new ConflictException({
        code: 'NO_ACTIVE_GOAL',
        message: 'Configure an active goal before analyzing this job.',
      });
    }
    const context = await this.contexts.findConfirmedByUserId(userId);
    if (!context) {
      throw new ConflictException({
        code: 'CONTEXT_INCOMPLETE',
        message: 'Confirm your freelancer context before analyzing this job.',
      });
    }
    const persistedSnapshot = await this.jobSnapshots.findOwnedMatching(
      userId,
      parsed.data.snapshot,
    );
    const newestProfileSkills =
      await this.profileSnapshots.findLatestSkills(userId);
    const facts = inspectJob(
      parsed.data.snapshot,
      context,
      goal,
      newestProfileSkills,
    );
    const prompt = assembleJobMatchPrompt({
      goal,
      context,
      newestProfileSkills,
      facts,
      snapshot: parsed.data.snapshot,
    });
    let evaluation;
    try {
      const selectedModels =
        await this.modelSelections.resolve('jobMatchEvaluator');
      evaluation = await this.models.evaluate({
        capability: 'jobMatchEvaluator',
        schema: jobMatchSchema,
        schemaName: 'jobMatchEvaluation',
        system: prompt.system,
        prompt: prompt.prompt,
        temperature: 0.2,
        models: selectedModels,
      });
    } catch (error: unknown) {
      throw jobAnalysisFailed(error);
    }

    let score;
    try {
      score = scoreJobMatch(
        evaluation.object,
        facts,
        getJobMatchWeights(goal.objective),
      );
    } catch (error: unknown) {
      if (
        error instanceof AiEvaluationError ||
        error instanceof InvalidJobMatchCriterionScoreError
      ) {
        throw jobAnalysisFailed(error);
      }
      throw error;
    }

    const analysis = await this.repository.persist({
      userId,
      goalId: goal.id,
      jobSnapshotId: persistedSnapshot.id,
      matchScore: score.matchScore,
      dimensionScores: score.dimensionScores,
      summary: evaluation.object.summary,
      strengths: evaluation.object.strengths,
      concerns: evaluation.object.concerns,
      questionCount: parsed.data.snapshot.job.questions.length,
      promptVersion: prompt.promptVersion,
      rubricVersion: jobMatchRubricVersion,
      scoringVersion: jobMatchScoringVersion,
      requestedModel: evaluation.requestedModelId,
      gateway: evaluation.gateway ?? null,
      provider: evaluation.provider,
      model: evaluation.model,
      usage: normalizeJobAnalysisUsage(evaluation.usage),
    });

    return toJobMatchResponse(analysis);
  }

  async list(
    userId: string,
    query: ListJobAnalysesQuery,
  ): Promise<JobMatchListResponse> {
    const result = await this.repository.list(
      userId,
      query.cursor,
      query.pageSize,
    );
    return {
      items: result.records.map((record) =>
        toJobMatchResponse(record.analysis),
      ),
      pageSize: query.pageSize,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  }

  async get(userId: string, analysisId: string): Promise<JobMatchResponse> {
    const record = await this.repository.findById(userId, analysisId);
    if (!record) throw jobResourceNotFound('Job analysis');
    return toJobMatchResponse(record.analysis);
  }

  async findSource(
    userId: string,
    analysisId: string,
  ): Promise<JobAnalysisDetailRecord> {
    const record = await this.repository.findById(userId, analysisId);
    if (!record) throw jobResourceNotFound('Job analysis');
    return record;
  }
}

export function snapshotFromJobRow(row: JobSnapshotRow): JobSnapshot {
  return row.snapshot;
}

export function toJobMatchResponse(analysis: JobAnalysisRow): JobMatchResponse {
  return {
    id: analysis.id,
    jobSnapshotId: analysis.jobSnapshotId,
    goalId: analysis.goalId,
    matchScore: analysis.matchScore,
    summary: analysis.summary,
    dimensions: jobDimensionScoresSchema.parse(analysis.dimensionScores),
    strengths: analysis.strengths,
    concerns: analysis.concerns,
    questionCount: analysis.questionCount,
    versions: {
      prompt: analysis.promptVersion,
      rubric: analysis.rubricVersion,
      scoring: analysis.scoringVersion,
      requestedModel: analysis.requestedModel,
      ...(analysis.gateway === null ? {} : { gateway: analysis.gateway }),
      provider: analysis.provider,
      model: analysis.model,
    },
    createdAt: analysis.createdAt.toISOString(),
  };
}

function jobResourceNotFound(resource: string): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: `${resource} not found.`,
  });
}

function jobAnalysisFailed(error: unknown): BadGatewayException {
  return new BadGatewayException(
    {
      code: 'JOB_ANALYSIS_FAILED',
      message: 'The job analysis could not be completed.',
    },
    { cause: error instanceof Error ? error : undefined },
  );
}
