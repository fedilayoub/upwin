import type { LanguageModelUsage } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { ModelRegistryService } from '../../ai/model-registry.service';
import { AI_GATEWAY_ID, type AiModelRegistry } from '../../ai/model-registry';
import { capabilityFixtures } from '../../ai/modes/fixtures/capability-fixtures';
import { profileEvaluationSchema } from '../../ai/schemas/profile-evaluation.schema';
import type { FreelancerContextFields } from '../../freelancer-context/freelancer-context.schema';
import type { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import type { GoalResponse, GoalsService } from '../../goals/goals.service';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from '../../profile-snapshots/profile-snapshot.schema';
import type { ProfileAnalysesRepository } from './profile-analyses.repository';
import { ProfileAnalysesService } from './profile-analyses.service';
import { ProfileEvaluator } from './profile-evaluator.service';
import type { ModelSelectionsService } from '../../ai/model-selections.service';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const SNAPSHOT_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';
const CREATED_AT = new Date('2026-08-20T12:00:00.000Z');

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
  portfolio: [],
  preferences: {},
  positioning: { targetRole: 'React Developer' },
};
const snapshot: ProfileSnapshot = {
  source: 'manual',
  capturedAt: CREATED_AT.toISOString(),
  completeness: UNREADABLE_PROFILE_COMPLETENESS,
  profile: {
    title: 'React Developer for SaaS startups',
    overview: 'I build reliable TypeScript dashboards for startup teams.',
    skills: ['React', 'TypeScript'],
    portfolio: [{ title: 'SaaS dashboard', skills: ['React'] }],
    employment: [{ title: 'Frontend Developer' }],
    education: [],
    certifications: [],
    languages: [{ name: 'English' }],
  },
};
const request = { snapshot };

describe('ProfileAnalysesService', () => {
  it('persists backend scores, all recommendations, and honest per-call provenance', async () => {
    const evaluation = profileEvaluationSchema.parse(
      capabilityFixtures.profileAnalyzer.object,
    );
    const evaluate = vi.fn().mockResolvedValue({
      object: evaluation,
      requestedModelId: 'admin-primary',
      provider: 'served-upstream',
      model: 'served-upstream/served-model',
      gateway: AI_GATEWAY_ID,
      usage: usage(12, 34),
      finishReason: 'stop',
    });
    const persist = vi.fn(persistedAnalysis);
    const service = serviceWith({ evaluate, persist });

    const response = await service.create(USER_ID, request);

    expect(evaluate).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        promptVersion: 'profile-analyzer-v6',
        rubricVersion: 'upwork-profile-v3',
        scoringVersion: 'scoring-v1',
        requestedModel: 'admin-primary',
        gateway: AI_GATEWAY_ID,
        provider: 'served-upstream',
        model: 'served-upstream/served-model',
        usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
      }),
    );
    expect(persist.mock.calls[0]?.[0].recommendations).toHaveLength(4);
    expect(response.priorities).toHaveLength(3);
    expect(response.completenessScore).toBeNull();
    expect(response.previousWinningScore).toBe(61);
    expect(response.versions).toEqual({
      prompt: 'profile-analyzer-v6',
      rubric: 'upwork-profile-v3',
      scoring: 'scoring-v1',
      requestedModel: 'admin-primary',
      provider: 'served-upstream',
      model: 'served-upstream/served-model',
      gateway: AI_GATEWAY_ID,
    });
  });

  it('persists the admin fallback as requested provenance after primary failover', async () => {
    const evaluation = profileEvaluationSchema.parse(
      capabilityFixtures.profileAnalyzer.object,
    );
    const evaluate = vi.fn().mockResolvedValue({
      object: evaluation,
      requestedModelId: 'admin-fallback',
      provider: 'anthropic',
      model: 'anthropic/admin-fallback',
      gateway: AI_GATEWAY_ID,
      usage: usage(12, 34),
      finishReason: 'stop',
    });
    const persist = vi.fn(persistedAnalysis);
    const service = serviceWith({ evaluate, persist });

    await service.create(USER_ID, request);

    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ requestedModel: 'admin-fallback' }),
    );
  });

  it('returns a goal-aware fill for readable missing video but not unreadable video', async () => {
    const evaluation = profileEvaluationSchema.parse(
      capabilityFixtures.profileAnalyzer.object,
    );
    evaluation.priorities = [];
    const evaluate = vi.fn().mockResolvedValue({
      object: evaluation,
      requestedModelId: 'requested-model',
      provider: 'served-upstream',
      model: 'served-upstream/served-model',
      gateway: AI_GATEWAY_ID,
      usage: usage(12, 34),
      finishReason: 'stop',
    });
    const persist = vi.fn(persistedAnalysis);
    const service = serviceWith({ evaluate, persist });

    const missingVideo = await service.create(USER_ID, {
      snapshot: {
        ...snapshot,
        completeness: {
          ...UNREADABLE_PROFILE_COMPLETENESS,
          hasIntroVideo: false,
        },
      },
    });
    const unreadableVideo = await service.create(USER_ID, request);

    expect(missingVideo.completenessScore).toBe(0);
    const videoFill = missingVideo.priorities.find(
      (priority) => 'kind' in priority && priority.kind === 'fill',
    );
    expect(videoFill).toMatchObject({ kind: 'fill', field: null });
    if (videoFill && 'guidance' in videoFill) {
      expect(videoFill.guidance).toContain('React Developer');
    }
    expect(
      unreadableVideo.priorities.some(
        (priority) => 'kind' in priority && priority.kind === 'fill',
      ),
    ).toBe(false);
  });

  it('maps off-schema model output to AI_EVALUATION_FAILED and leaves the analyses table EMPTY', async () => {
    const primary = new MockLanguageModelV4({
      doGenerate: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ summary: 'invalid', sections: 42 }),
          },
        ],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 3, text: 3, reasoning: 0 },
        },
        warnings: [],
        response: { modelId: 'served-upstream/served-model' },
      },
    });
    const fallback = new MockLanguageModelV4({
      doGenerate: () => {
        throw new Error('Validation failures must not invoke the fallback.');
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
    const selections = {
      resolve: vi.fn().mockResolvedValue({
        primary: 'primary-model',
        fallback: 'fallback-model',
        source: 'selection',
        warnings: [],
      }),
    } as unknown as ModelSelectionsService;
    const evaluator = new ProfileEvaluator(
      new ModelRegistryService(registry),
      selections,
    );
    const analysesTable: unknown[] = [];
    const persist = vi.fn((input: unknown) => {
      analysesTable.push(input);
      throw new Error(
        'Persistence must not run after an invalid model response.',
      );
    });
    const service = serviceWith({ evaluator, persist });

    await expect(service.create(USER_ID, request)).rejects.toMatchObject({
      response: {
        code: 'AI_EVALUATION_FAILED',
        message: 'The AI evaluation could not be completed.',
      },
      status: 502,
    });
    expect(analysesTable).toEqual([]);
    expect(persist).not.toHaveBeenCalled();
    expect(fallback.doGenerateCalls).toHaveLength(0);
  });

  it('maps a missing section to AI_EVALUATION_FAILED and persists nothing', async () => {
    const fixture = structuredClone(capabilityFixtures.profileAnalyzer.object);
    const evaluate = vi.fn().mockResolvedValue({
      object: {
        ...fixture,
        sections: fixture.sections.filter((section) => section.id !== 'title'),
      },
      requestedModelId: 'requested-model',
      provider: 'served-upstream',
      model: 'served-upstream/served-model',
      gateway: AI_GATEWAY_ID,
      usage: usage(12, 34),
      finishReason: 'stop',
    });
    const persist = vi.fn();
    const service = serviceWith({ evaluate, persist });

    await expect(service.create(USER_ID, request)).rejects.toMatchObject({
      response: {
        code: 'AI_EVALUATION_FAILED',
        message: 'The AI evaluation could not be completed.',
      },
      status: 502,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed context before evaluation or persistence', async () => {
    const evaluate = vi.fn();
    const persist = vi.fn();
    const service = serviceWith({ context: null, evaluate, persist });

    await expect(service.create(USER_ID, request)).rejects.toMatchObject({
      response: { code: 'CONTEXT_INCOMPLETE' },
      status: 409,
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects a missing active goal before evaluation or persistence', async () => {
    const evaluate = vi.fn();
    const persist = vi.fn();
    const service = serviceWith({
      goal: null,
      evaluate,
      persist,
    });

    await expect(service.create(USER_ID, request)).rejects.toMatchObject({
      response: { code: 'NO_ACTIVE_GOAL' },
      status: 409,
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });




  it('rejects an invalid snapshot before loading user-scoped dependencies', async () => {
    const evaluate = vi.fn();
    const persist = vi.fn();
    const service = serviceWith({ evaluate, persist });

    await expect(
      service.create(USER_ID, {
        snapshot: {
          source: 'manual',
          capturedAt: CREATED_AT.toISOString(),
          profile: { portfolio: [] },
        },
      }),
    ).rejects.toMatchObject({
      response: { code: 'SNAPSHOT_INVALID' },
      status: 422,
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns 404 when an analysis is not owned by the authenticated user', async () => {
    const findById = vi.fn().mockResolvedValue(null);
    const service = serviceWith({ persist: vi.fn(), findById });

    await expect(service.get(USER_ID, ANALYSIS_ID)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND', message: 'Analysis not found.' },
      status: 404,
    });
    expect(findById).toHaveBeenCalledWith(USER_ID, ANALYSIS_ID);
  });
});

function serviceWith(options: {
  goal?: GoalResponse | null;
  context?: FreelancerContextFields | null;
  evaluator?: ProfileEvaluator;
  evaluate?: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
  findPreviousForOutcomes?: ReturnType<typeof vi.fn>;
  findById?: ReturnType<typeof vi.fn>;
}): ProfileAnalysesService {
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
  const evaluator =
    options.evaluator ??
    ({ evaluate: options.evaluate ?? vi.fn() } as unknown as ProfileEvaluator);
  const repository = {
    persist: options.persist,
    findById: options.findById ?? vi.fn(),
    findPreviousForOutcomes:
      options.findPreviousForOutcomes ?? vi.fn().mockResolvedValue(null),
  } as unknown as ProfileAnalysesRepository;

  return new ProfileAnalysesService(
    goals,
    contexts,
    evaluator,
    repository,
  );
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
    raw: undefined,
  };
}

async function persistedAnalysis(
  input: Parameters<ProfileAnalysesRepository['persist']>[0],
) {
  return {
    analysis: {
      id: ANALYSIS_ID,
      userId: USER_ID,
      goalId: goal.id,
      profileSnapshotId: SNAPSHOT_ID,
      winningScore: input.winningScore,
      completenessScore: input.completenessScore,
      sectionScores: input.sectionScores,
      summary: input.summary,
      promptVersion: input.promptVersion,
      rubricVersion: input.rubricVersion,
      scoringVersion: input.scoringVersion,
      requestedModel: input.requestedModel,
      gateway: input.gateway,
      provider: input.provider,
      model: input.model,
      usage: input.usage,
      createdAt: CREATED_AT,
    },
    recommendations: input.recommendations.map((recommendation, index) => {
      const fill =
        'kind' in recommendation && recommendation.kind === 'fill'
          ? recommendation
          : null;
      return {
        id: `018f6a77-4e90-7ab5-a3bf-15c8f850fa2${index}`,
        analysisId: ANALYSIS_ID,
        section: recommendation.section,
        rank: recommendation.rank,
        impact: recommendation.impact,
        estimatedMinutes: recommendation.estimatedMinutes,
        reason: recommendation.reason,
        evidence: recommendation.evidence,
        recommendation: recommendation.recommendation,
        kind: fill?.kind ?? null,
        field: fill?.field ?? null,
        itemIndex: fill?.itemIndex ?? null,
        originalValue: null,
        suggestedValue: null,
        guidance: fill?.guidance ?? null,
        items: fill?.items ?? null,
        suggestionStyle: null,
        variantIndex: null,
        promptVersion: null,
        requestedModel: null,
        gateway: null,
        provider: null,
        model: null,
        usage: null,
        status: 'pending' as const,
        createdAt: CREATED_AT,
      };
    }),
    previousWinningScore: 61,
  };
}
