import { NotFoundException } from '@nestjs/common';
import type { LanguageModelUsage } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { capabilityFixtures } from '../../ai/modes/fixtures/capability-fixtures';
import type { AiModelRegistry } from '../../ai/model-registry';
import { AI_GATEWAY_ID } from '../../ai/model-registry';
import { ModelRegistryService } from '../../ai/model-registry.service';
import type { ModelSelectionsService } from '../../ai/model-selections.service';
import type { JobAnalysisRow, JobSnapshotRow } from '../../database/schema';
import type { FreelancerContextFields } from '../../freelancer-context/freelancer-context.schema';
import type { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import type { GoalResponse, GoalsService } from '../../goals/goals.service';
import type { JobSnapshot } from '../../job-snapshots/job-snapshot.schema';
import type { JobSnapshotsService } from '../../job-snapshots/job-snapshots.service';
import type { ProfileSnapshotsService } from '../../profile-snapshots/profile-snapshots.service';
import type {
  JobAnalysesRepository,
  PersistJobAnalysisInput,
} from './job-analyses.repository';
import { JobMatchService } from './job-match.service';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const SNAPSHOT_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';
const CREATED_AT = new Date('2026-08-23T12:00:00.000Z');

describe('JobMatchService', () => {
  it('computes deterministic dimensions and persists one analysis with provenance', async () => {
    const evaluate = vi.fn().mockResolvedValue({
      object: capabilityFixtures.jobMatchEvaluator.object,
      requestedModelId: 'admin-primary',
      provider: 'openai',
      model: 'openai/served-model',
      gateway: AI_GATEWAY_ID,
      usage: usage(12, 18),
      finishReason: 'stop',
    });
    const persist = vi.fn((input: PersistJobAnalysisInput) =>
      persistedAnalysis(input),
    );
    const service = serviceWith({ evaluate, persist });

    const response = await service.create(USER_ID, { snapshot });

    expect(evaluate).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        jobSnapshotId: SNAPSHOT_ID,
        matchScore: 77,
        questionCount: 1,
        promptVersion: 'job-match-v2',
        rubricVersion: 'job-match-rubric-v1',
        scoringVersion: 'job-match-scoring-v1',
        requestedModel: 'admin-primary',
        usage: { inputTokens: 12, outputTokens: 18, totalTokens: 30 },
      }),
    );
    expect(response.dimensions.map((dimension) => dimension.id)).toEqual([
      'skills',
      'domain',
      'experience',
      'budget',
      'goalAlignment',
    ]);
    expect(response.versions.model).toBe('openai/served-model');
    const evaluationRequest: unknown = evaluate.mock.calls[0]?.[0];
    expect(evaluationRequest).toMatchObject({
      models: {
        primary: 'admin-primary',
        fallback: 'admin-fallback',
      },
    });
  });

  it('persists the admin fallback as requested provenance after primary failover', async () => {
    const evaluate = vi.fn().mockResolvedValue({
      object: capabilityFixtures.jobMatchEvaluator.object,
      requestedModelId: 'admin-fallback',
      provider: 'anthropic',
      model: 'anthropic/admin-fallback',
      gateway: AI_GATEWAY_ID,
      usage: usage(12, 18),
      finishReason: 'stop',
    });
    const persist = vi.fn((input: PersistJobAnalysisInput) =>
      persistedAnalysis(input),
    );
    const service = serviceWith({ evaluate, persist });

    await service.create(USER_ID, { snapshot });

    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ requestedModel: 'admin-fallback' }),
    );
  });

  it('maps off-schema output after SDK retries to JOB_ANALYSIS_FAILED and persists nothing', async () => {
    const primary = new MockLanguageModelV4({
      doGenerate: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ summary: 'invalid', dimensions: 42 }),
          },
        ],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 3, text: 3, reasoning: 0 },
        },
        warnings: [],
        response: { modelId: 'openai/served-model' },
      },
    });
    const fallback = new MockLanguageModelV4({
      doGenerate: () => {
        throw new Error('Schema failures must not invoke fallback.');
      },
    });
    const registry: AiModelRegistry = {
      mode: 'live',
      resolve(_capability, attempt) {
        return {
          model: attempt === 'primary' ? primary : fallback,
          requestedModelId:
            attempt === 'primary' ? 'primary-model' : 'fallback-model',
        };
      },
    };
    const persist = vi.fn();
    const service = serviceWith({
      models: new ModelRegistryService(registry),
      persist,
    });

    await expect(service.create(USER_ID, { snapshot })).rejects.toMatchObject({
      response: { code: 'JOB_ANALYSIS_FAILED' },
      status: 502,
    });
    expect(persist).not.toHaveBeenCalled();
    expect(fallback.doGenerateCalls).toHaveLength(0);
  });

  it('returns 409 when no active goal exists', async () => {
    const evaluate = vi.fn();
    const service = serviceWith({ goal: null, evaluate });

    await expect(service.create(USER_ID, { snapshot })).rejects.toMatchObject({
      response: { code: 'NO_ACTIVE_GOAL' },
      status: 409,
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('returns 409 when the freelancer context is unconfirmed', async () => {
    const evaluate = vi.fn();
    const service = serviceWith({ context: null, evaluate });

    await expect(service.create(USER_ID, { snapshot })).rejects.toMatchObject({
      response: { code: 'CONTEXT_INCOMPLETE' },
      status: 409,
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('returns 404 when the persisted snapshot is not owned by the caller', async () => {
    const evaluate = vi.fn();
    const service = serviceWith({
      snapshotRow: null,
      evaluate,
    });

    await expect(service.create(USER_ID, { snapshot })).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
      status: 404,
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

});

function serviceWith(options: {
  goal?: GoalResponse | null;
  context?: FreelancerContextFields | null;
  snapshotRow?: JobSnapshotRow | null;
  models?: ModelRegistryService;
  evaluate?: ReturnType<typeof vi.fn>;
  persist?: ReturnType<typeof vi.fn>;
}): JobMatchService {
  const goals = {
    findForAnalysis: vi
      .fn()
      .mockResolvedValue(options.goal === undefined ? goal : options.goal),
  } as unknown as GoalsService;
  const contexts = {
    findConfirmedByUserId: vi
      .fn()
      .mockResolvedValue(
        options.context === undefined ? context : options.context,
      ),
  } as unknown as FreelancerContextService;
  const snapshotRows = {
    findOwnedMatching: vi.fn().mockImplementation(() => {
      if (options.snapshotRow === null) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'The persisted job snapshot was not found.',
        });
      }
      return Promise.resolve(options.snapshotRow ?? persistedSnapshot);
    }),
  } as unknown as JobSnapshotsService;
  const profileSnapshots = {
    findLatestSkills: vi.fn().mockResolvedValue(['TypeScript']),
  } as unknown as ProfileSnapshotsService;
  const models =
    options.models ??
    ({
      evaluate: options.evaluate ?? vi.fn(),
    } as unknown as ModelRegistryService);
  const modelSelections = {
    resolve: vi.fn().mockResolvedValue({
      primary: 'admin-primary',
      fallback: 'admin-fallback',
      source: 'selection',
      warnings: [],
    }),
  } as unknown as ModelSelectionsService;
  const repository = {
    persist: options.persist ?? vi.fn(),
  } as unknown as JobAnalysesRepository;
  return new JobMatchService(
    goals,
    contexts,
    snapshotRows,
    profileSnapshots,
    models,
    modelSelections,
    repository,
  );
}

function persistedAnalysis(input: PersistJobAnalysisInput): JobAnalysisRow {
  return {
    id: ANALYSIS_ID,
    ...input,
    createdAt: CREATED_AT,
  };
}

function usage(inputTokens: number, outputTokens: number): LanguageModelUsage {
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputTokenDetails: {
      noCacheTokens: inputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    outputTokenDetails: { textTokens: outputTokens, reasoningTokens: 0 },
  };
}

const goal: GoalResponse = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
  objective: 'first-client',
  targetRole: 'React Developer',
  targetProjectTypes: ['SaaS dashboard'],
  targetClients: ['startups'],
  preferredSkills: ['React', 'TypeScript'],
  targetRate: null,
  isActive: true,
  createdAt: CREATED_AT.toISOString(),
  updatedAt: CREATED_AT.toISOString(),
};
const context: FreelancerContextFields = {
  experience: { years: 5, roles: [] },
  skills: ['React', 'TypeScript'],
  portfolio: [
    {
      title: 'React dashboard',
      description: 'TypeScript dashboard for a product team.',
      skills: ['React', 'TypeScript'],
    },
  ],
  preferences: {},
  positioning: {},
};
const snapshot: JobSnapshot = {
  source: 'manual',
  capturedAt: CREATED_AT.toISOString(),
  job: {
    ciphertext: '~0abc123',
    url: 'https://www.upwork.com/jobs/~0abc123',
    title: 'React dashboard',
    description: 'Build a React and TypeScript dashboard.',
    engagement: { budgetType: 'unknown' },
    skills: [
      { name: 'React', relevance: 'mandatory' },
      { name: 'TypeScript', relevance: 'nice-to-have' },
    ],
    questions: [{ position: 0, question: 'How would you begin?' }],
    client: { paymentVerified: null },
    activity: {},
  },
};
const persistedSnapshot: JobSnapshotRow = {
  id: SNAPSHOT_ID,
  userId: USER_ID,
  ciphertext: snapshot.job.ciphertext,
  url: snapshot.job.url,
  capturedAt: CREATED_AT,
  source: snapshot.source,
  snapshot,
  createdAt: CREATED_AT,
};
