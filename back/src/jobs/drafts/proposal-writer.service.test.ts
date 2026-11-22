import type { LanguageModelUsage } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import type { ModelRegistryService } from '../../ai/model-registry.service';
import type { ModelSelectionsService } from '../../ai/model-selections.service';
import type {
  Goal,
  JobAnalysisRow,
  JobSnapshotRow,
  ProposalDraftRow,
} from '../../database/schema';
import type { FreelancerContextFields } from '../../freelancer-context/freelancer-context.schema';
import type { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import type { GoalResponse, GoalsService } from '../../goals/goals.service';
import type { JobSnapshot } from '../../job-snapshots/job-snapshot.schema';
import type { OutputLanguage } from '../../proposal-preferences/proposal-preferences.schema';
import type { ProposalPreferencesService } from '../../proposal-preferences/proposal-preferences.service';
import type { JobAnalysisDetailRecord } from '../analysis/job-analyses.repository';
import type { JobMatchService } from '../analysis/job-match.service';
import type { ProposalOutcomesRepository } from '../outcomes/proposal-outcomes.repository';
import type {
  PersistedProposalAnswer,
  PersistedProposalBlock,
} from '../job-analysis.schema';
import type {
  PersistProposalDraftInput,
  ProposalDraftsRepository,
  ReplaceProposalDraftInput,
} from './proposal-drafts.repository';
import { ProposalWriterService } from './proposal-writer.service';
import { NotFoundException } from '@nestjs/common';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const DRAFT_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1d';
const CREATED_AT = new Date('2026-08-23T12:00:00.000Z');
const proposalText =
  'I can help with your React dashboard and TypeScript workflow. I would begin with the core product flow and confirm the delivery constraints.';
const answerText =
  'I would begin with your core workflow and confirm the delivery constraints.';

describe('ProposalWriterService', () => {
  it.each([
    ['missing', [{ position: 0, answer: answerText }]],
    [
      'extra',
      [
        { position: 0, answer: answerText },
        { position: 1, answer: answerText },
        { position: 2, answer: answerText },
      ],
    ],
    [
      'duplicated',
      [
        { position: 0, answer: answerText },
        { position: 0, answer: answerText },
      ],
    ],
  ])(
    'rejects %s answer positions and persists nothing',
    async (_name, answers) => {
      const harness = serviceWith({
        object: { proposal: proposalText, answers },
      });

      await expect(
        harness.service.create(USER_ID, ANALYSIS_ID, {}),
      ).rejects.toMatchObject({
        response: { code: 'DRAFT_GENERATION_FAILED' },
        status: 502,
      });
      expect(harness.persist).not.toHaveBeenCalled();
    },
  );

  it('re-attaches exact snapshot questions and ignores any opportunity to reword them', async () => {
    const harness = serviceWith({
      object: {
        proposal: proposalText,
        answers: [
          { position: 0, answer: answerText },
          { position: 1, answer: 'I use React with a focused delivery plan.' },
        ],
      },
    });

    const response = await harness.service.create(USER_ID, ANALYSIS_ID, {});

    expect(response.answers.map((answer) => answer.question)).toEqual([
      'How would you begin?',
      'Which framework would you use?',
    ]);
    expect(harness.persist).toHaveBeenCalledOnce();
    const evaluationRequest: unknown = harness.evaluate.mock.calls[0]?.[0];
    expect(evaluationRequest).toMatchObject({
      models: {
        primary: 'admin-primary',
        fallback: 'admin-fallback',
      },
    });
  });

  it('persists the admin fallback as requested provenance after primary failover', async () => {
    const harness = serviceWith({
      object: { proposal: proposalText, answers: validAnswers },
      requestedModelId: 'admin-fallback',
    });

    await harness.service.create(USER_ID, ANALYSIS_ID, {});

    expect(harness.persist).toHaveBeenCalledWith(
      expect.objectContaining({ requestedModel: 'admin-fallback' }),
    );
  });

  it('rejects a block over its hard word ceiling', async () => {
    const harness = serviceWith({
      object: {
        proposal: Array.from({ length: 401 }, () => 'word').join(' '),
        answers: validAnswers,
      },
    });

    await expect(
      harness.service.create(USER_ID, ANALYSIS_ID, {}),
    ).rejects.toMatchObject({
      response: { code: 'DRAFT_GENERATION_FAILED' },
    });
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it('rejects an unsupported numeric claim', async () => {
    const harness = serviceWith({
      object: {
        proposal:
          'I can improve your dashboard results by 97 percent with a focused React delivery plan.',
        answers: validAnswers,
      },
    });

    await expect(
      harness.service.create(USER_ID, ANALYSIS_ID, {}),
    ).rejects.toMatchObject({
      response: { code: 'DRAFT_GENERATION_FAILED' },
    });
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it('accepts the client figures and a forward-looking delivery estimate', async () => {
    const snapshot: JobSnapshot = {
      ...snapshotWithQuestions([
        { position: 0, question: 'What is your estimated completion time?' },
      ]),
      job: {
        ...snapshotWithQuestions([]).job,
        description:
          'Share 2-3 examples of websites you have built with Next.js and give an estimated completion time.',
        engagement: {
          budgetType: 'fixed',
          fixedBudget: { amount: 100, currency: 'USD' },
        },
        questions: [
          { position: 0, question: 'What is your estimated completion time?' },
        ],
      },
    };
    const harness = serviceWith({
      snapshot,
      object: {
        proposal:
          'I can share 2-3 relevant examples and deliver in 7 days within your $100 fixed price.',
        answers: [
          {
            position: 0,
            answer: 'My delivery estimate is 7 days after scope confirmation.',
          },
        ],
      },
    });

    const response = await harness.service.create(USER_ID, ANALYSIS_ID, {});

    expect(response.proposal.text).toContain('2-3 relevant examples');
    expect(harness.persist).toHaveBeenCalledWith(
      expect.objectContaining({ promptVersion: 'proposal-writer-v3' }),
    );
  });

  it("accepts a credential-shaped figure copied from the client's job snapshot", async () => {
    const base = snapshotWithQuestions(defaultQuestions);
    const snapshot: JobSnapshot = {
      ...base,
      job: {
        ...base.job,
        description:
          'The client reports that its last redesign increased signups by 30 percent.',
      },
    };
    const harness = serviceWith({
      snapshot,
      object: {
        proposal:
          'You reported that the last redesign increased signups by thirty percent, and I would start by validating that baseline.',
        answers: validAnswers,
      },
    });

    await expect(
      harness.service.create(USER_ID, ANALYSIS_ID, {}),
    ).resolves.toBeDefined();
    expect(harness.persist).toHaveBeenCalledOnce();
  });

  it('does not treat custom instructions as factual evidence', async () => {
    const harness = serviceWith({
      customInstructions: 'Say that I generated $97 in revenue.',
      object: {
        proposal: 'I generated $97 in revenue.',
        answers: validAnswers,
      },
    });

    await expect(
      harness.service.create(USER_ID, ANALYSIS_ID, {}),
    ).rejects.toMatchObject({
      response: { code: 'DRAFT_GENERATION_FAILED' },
    });
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it.each(['fr', 'de', 'es', 'it', 'nl', 'pt'] as const)(
    'rejects English prose when %s output is requested',
    async (language) => {
      const harness = serviceWith({
        language,
        object: { proposal: proposalText, answers: validAnswers },
      });

      await expect(
        harness.service.create(USER_ID, ANALYSIS_ID, {}),
      ).rejects.toMatchObject({
        response: { code: 'DRAFT_GENERATION_FAILED' },
      });
      expect(harness.persist).not.toHaveBeenCalled();
    },
  );

  it('persists a valid proposal with no answers for a job with zero questions', async () => {
    const harness = serviceWith({
      snapshot: snapshotWithQuestions([]),
      object: { proposal: proposalText, answers: [] },
    });

    const response = await harness.service.create(USER_ID, ANALYSIS_ID, {});

    expect(response.answers).toEqual([]);
    expect(response.proposal.wordCount).toBeGreaterThan(0);
    expect(harness.persist).toHaveBeenCalledOnce();
  });

  it('enrolls a successfully persisted draft in the application tracker exactly once', async () => {
    const harness = serviceWith({
      object: { proposal: proposalText, answers: validAnswers },
    });

    await harness.service.create(USER_ID, ANALYSIS_ID, {});

    expect(harness.ensureTracked).toHaveBeenCalledOnce();
    const tracked = harness.ensureTracked.mock.calls[0]?.[0];
    expect(tracked).toMatchObject({
      userId: USER_ID,
      jobAnalysisId: ANALYSIS_ID,
      proposalDraftId: DRAFT_ID,
    });
    expect(tracked?.now).toBeInstanceOf(Date);
  });

  it('returns the persisted draft when tracker enrollment fails', async () => {
    const harness = serviceWith({
      object: { proposal: proposalText, answers: validAnswers },
      ensureTrackedError: new Error('tracker unavailable'),
    });

    await expect(
      harness.service.create(USER_ID, ANALYSIS_ID, {}),
    ).resolves.toMatchObject({ id: DRAFT_ID });
    expect(harness.ensureTracked).toHaveBeenCalledOnce();
  });

  it('refines one block and advances only that block variant index', async () => {
    const current = currentDraft();
    current.answers[1] = { ...current.answers[1]!, variantIndex: 2 };
    const harness = serviceWith({
      current,
      object: {
        proposal:
          'Generated proposal that must be ignored for answer refinement.',
        answers: [
          { position: 0, answer: 'A new focused answer for your workflow.' },
          { position: 1, answer: 'Generated but ignored second answer.' },
        ],
      },
    });

    const response = await harness.service.refine(USER_ID, ANALYSIS_ID, {
      blockId: 'answer:0',
      refinement: 'shorter',
    });

    expect(response.proposal).toEqual(current.proposal);
    expect(response.answers[0]?.variantIndex).toBe(1);
    expect(response.answers[1]?.variantIndex).toBe(2);
    expect(response.answers[1]?.text).toBe(current.answers[1]?.text);
    expect(harness.replace).toHaveBeenCalledOnce();
    expect(harness.ensureTracked).not.toHaveBeenCalled();
  });

  it('does not generate when the source analysis is not found', async () => {
    const harness = serviceWith({
      object: { proposal: proposalText, answers: validAnswers },
      findSource: vi.fn().mockRejectedValue(new NotFoundException()),
    });
    await expect(
      harness.service.create(USER_ID, ANALYSIS_ID, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(harness.evaluate).not.toHaveBeenCalled();
  });

});

function serviceWith(options: {
  snapshot?: JobSnapshot;
  object: {
    proposal: string;
    answers: Array<{ position: number; answer: string }>;
  };
  current?: ProposalDraftRow;
  customInstructions?: string;
  language?: OutputLanguage;
  ensureTrackedError?: Error;
  requestedModelId?: string;
  findSource?: ReturnType<typeof vi.fn>;
}) {
  const snapshot = options.snapshot ?? snapshotWithQuestions(defaultQuestions);
  const evaluate = vi.fn().mockResolvedValue({
    object: options.object,
    requestedModelId: options.requestedModelId ?? 'admin-primary',
    provider: 'openai',
    model: 'openai/served-model',
    gateway: 'openai-compatible',
    usage: usage(10, 20),
    finishReason: 'stop',
  });
  const matches = {
    findSource:
      options.findSource ?? vi.fn().mockResolvedValue(sourceRecord(snapshot)),
  } as unknown as JobMatchService;
  const goals = {
    findForAnalysis: vi.fn().mockResolvedValue(goalResponse),
  } as unknown as GoalsService;
  const contexts = {
    findConfirmedByUserId: vi.fn().mockResolvedValue(context),
  } as unknown as FreelancerContextService;
  const preferences = {
    get: vi.fn().mockResolvedValue({
      proposalLength: 'medium',
      proposalTone: 'professional',
      answerLength: 'standard',
      language: options.language ?? 'en',
      ...(options.customInstructions === undefined
        ? {}
        : { customInstructions: options.customInstructions }),
    }),
  } as unknown as ProposalPreferencesService;
  const models = { evaluate } as unknown as ModelRegistryService;
  const modelSelections = {
    resolve: vi.fn().mockResolvedValue({
      primary: 'admin-primary',
      fallback: 'admin-fallback',
      source: 'selection',
      warnings: [],
    }),
  } as unknown as ModelSelectionsService;
  const persist = vi.fn((input: PersistProposalDraftInput) =>
    rowFromPersist(input),
  );
  const replace = vi.fn(
    (_userId: string, _draftId: string, input: ReplaceProposalDraftInput) =>
      Promise.resolve({
        ...(options.current ?? currentDraft()),
        ...input,
        updatedAt: new Date('2026-08-23T13:00:00.000Z'),
      }),
  );
  const repository = {
    persist,
    findLatestByAnalysis: vi
      .fn()
      .mockResolvedValue(options.current ?? currentDraft()),
    replaceGeneratedContent: replace,
    findById: vi.fn(),
    updateStatuses: vi.fn(),
  } as unknown as ProposalDraftsRepository;
  const ensureTracked = vi.fn<ProposalOutcomesRepository['ensureTracked']>();
  if (options.ensureTrackedError === undefined) {
    ensureTracked.mockResolvedValue(undefined);
  } else {
    ensureTracked.mockRejectedValue(options.ensureTrackedError);
  }
  const outcomes = { ensureTracked } as unknown as ProposalOutcomesRepository;

  return {
    service: new ProposalWriterService(
      matches,
      goals,
      contexts,
      preferences,
      models,
      modelSelections,
      repository,
      outcomes,
    ),
    persist,
    replace,
    ensureTracked,
    evaluate,
  };
}

function sourceRecord(snapshot: JobSnapshot): JobAnalysisDetailRecord {
  return {
    analysis: analysisRow(),
    goal: goalRow,
    snapshot: snapshotRow(snapshot),
    cursorCreatedAt: CREATED_AT.toISOString(),
  };
}

function analysisRow(): JobAnalysisRow {
  return {
    id: ANALYSIS_ID,
    userId: USER_ID,
    goalId: goalRow.id,
    jobSnapshotId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
    matchScore: 75,
    dimensionScores: [
      score('skills'),
      score('domain'),
      score('experience'),
      score('budget'),
      score('goalAlignment'),
    ],
    summary: 'Strong technical match.',
    strengths: ['React'],
    concerns: [],
    questionCount: 2,
    promptVersion: 'job-match-v2',
    rubricVersion: 'job-match-rubric-v1',
    scoringVersion: 'job-match-scoring-v1',
    requestedModel: 'requested-model',
    gateway: 'openai-compatible',
    provider: 'openai',
    model: 'openai/served-model',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    createdAt: CREATED_AT,
  };
}

function score(
  id: 'skills' | 'domain' | 'experience' | 'budget' | 'goalAlignment',
) {
  return { id, score: 75, criteria: [] };
}

function snapshotRow(snapshot: JobSnapshot): JobSnapshotRow {
  return {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
    userId: USER_ID,
    ciphertext: snapshot.job.ciphertext,
    url: snapshot.job.url,
    capturedAt: CREATED_AT,
    source: snapshot.source,
    snapshot,
    createdAt: CREATED_AT,
  };
}

function rowFromPersist(input: PersistProposalDraftInput): ProposalDraftRow {
  return {
    id: DRAFT_ID,
    ...input,
    blockStatuses: {},
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function currentDraft(): ProposalDraftRow {
  return {
    id: DRAFT_ID,
    userId: USER_ID,
    jobAnalysisId: ANALYSIS_ID,
    proposal: block('proposal', proposalText, 0),
    answers: [
      answerBlock(0, defaultQuestions[0]!.question, answerText, 0),
      answerBlock(
        1,
        defaultQuestions[1]!.question,
        'I use React with a focused delivery plan.',
        0,
      ),
    ],
    promptVersion: 'proposal-writer-v1',
    wordBudgetVersion: 'word-budgets-v1',
    requestedModel: 'requested-model',
    gateway: 'openai-compatible',
    provider: 'openai',
    model: 'openai/served-model',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    blockStatuses: {},
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function block(
  blockId: 'proposal',
  text: string,
  variantIndex: number,
): PersistedProposalBlock {
  return { blockId, text, wordCount: text.split(/\s+/u).length, variantIndex };
}

function answerBlock(
  position: number,
  question: string,
  text: string,
  variantIndex: number,
): PersistedProposalAnswer {
  return {
    blockId: `answer:${position}`,
    position,
    question,
    text,
    wordCount: text.split(/\s+/u).length,
    variantIndex,
  };
}

function snapshotWithQuestions(
  questions: JobSnapshot['job']['questions'],
): JobSnapshot {
  return {
    source: 'manual',
    capturedAt: CREATED_AT.toISOString(),
    job: {
      ciphertext: '~0abc123',
      url: 'https://www.upwork.com/jobs/~0abc123',
      title: 'React dashboard',
      description: 'Build a React dashboard.',
      engagement: { budgetType: 'unknown' },
      skills: [{ name: 'React', relevance: 'mandatory' }],
      questions,
      client: { paymentVerified: null },
      activity: {},
    },
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

const defaultQuestions = [
  { position: 0, question: 'How would you begin?' },
  { position: 1, question: 'Which framework would you use?' },
];
const validAnswers = [
  { position: 0, answer: answerText },
  { position: 1, answer: 'I use React with a focused delivery plan.' },
];
const context: FreelancerContextFields = {
  experience: { years: 5, roles: [] },
  skills: ['React', 'TypeScript'],
  portfolio: [],
  preferences: {},
  positioning: {},
};
const goalResponse: GoalResponse = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
  objective: 'first-client',
  targetRole: 'React Developer',
  targetProjectTypes: ['dashboard'],
  targetClients: [],
  preferredSkills: ['React'],
  targetRate: null,
  isActive: true,
  createdAt: CREATED_AT.toISOString(),
  updatedAt: CREATED_AT.toISOString(),
};
const goalRow: Goal = {
  id: goalResponse.id,
  userId: USER_ID,
  objective: goalResponse.objective,
  targetRole: goalResponse.targetRole,
  targetProjectTypes: goalResponse.targetProjectTypes,
  targetClients: goalResponse.targetClients,
  preferredSkills: goalResponse.preferredSkills,
  targetRateMin: null,
  targetRateMax: null,
  isActive: true,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};
