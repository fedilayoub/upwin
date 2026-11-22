import { describe, expect, it, vi } from 'vitest';
import type { DraftFlowDependencies, DraftFlowState } from './use-draft-flow';
import {
  EMPTY_DRAFT_FLOW_STATE,
  runDraftFlow,
} from './use-draft-flow';
import type { JobAnalysis, JobCaptureResult, JobSnapshotReceipt } from '@/types/job';
import type { Proposal } from '@/types/proposal';
import { ApiClientError } from '@/services/api';

const capture: JobCaptureResult = {
  snapshot: {
    source: 'upwork-dom',
    capturedAt: '2026-08-23T12:00:00.000Z',
    job: {
      ciphertext: '~0def456',
      url: 'https://www.upwork.com/jobs/~0def456',
      title: 'Synthetic job',
      description: 'Synthetic description',
      engagement: { budgetType: 'unknown' },
      skills: [],
      questions: [],
      client: { paymentVerified: null },
      activity: {},
    },
  },
  truncatedFields: [],
};

const receipt: JobSnapshotReceipt = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
  ciphertext: capture.snapshot.job.ciphertext,
  capturedAt: capture.snapshot.capturedAt,
  createdAt: '2026-08-23T12:00:01.000Z',
  truncatedFields: [],
};

const analysis: JobAnalysis = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa11',
  jobSnapshotId: receipt.id,
  goalId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa12',
  matchScore: 74,
  summary: 'A credible match.',
  dimensions: [
    'skills',
    'domain',
    'experience',
    'budget',
    'goalAlignment',
  ].map((id) => ({
    id: id as JobAnalysis['dimensions'][number]['id'],
    score: 74,
    criteria: [],
  })),
  strengths: ['Relevant stack'],
  concerns: ['Budget is unclear'],
  questionCount: 0,
  versions: {
    prompt: 'job-match-v1',
    rubric: 'job-match-rubric-v1',
    scoring: 'job-match-scoring-v1',
    requestedModel: 'gpt-4.1-mini',
    gateway: 'llmgateway',
    provider: 'openai',
    model: 'openai/gpt-4.1-mini',
  },
  createdAt: '2026-08-23T12:00:02.000Z',
};

const draft: Proposal = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa13',
  jobAnalysisId: analysis.id,
  proposal: {
    blockId: 'proposal',
    text: 'A tailored proposal.',
    wordCount: 3,
    variantIndex: 0,
  },
  answers: [],
  versions: {
    prompt: 'proposal-writer-v1',
    requestedModel: 'gpt-4.1-mini',
    gateway: 'llmgateway',
    provider: 'openai',
    model: 'openai/gpt-4.1-mini',
  },
  createdAt: '2026-08-23T12:00:03.000Z',
};

describe('runDraftFlow', () => {
  it('stops a capture failure before any POST', async () => {
    const dependencies = successfulDependencies();
    dependencies.capture = vi.fn().mockRejectedValue(new Error('capture failed'));

    await expect(run(dependencies)).rejects.toThrow('capture failed');
    expect(dependencies.persist).not.toHaveBeenCalled();
    expect(dependencies.analyze).not.toHaveBeenCalled();
    expect(dependencies.draft).not.toHaveBeenCalled();
  });

  it('keeps the captured snapshot when analysis fails', async () => {
    const dependencies = successfulDependencies();
    dependencies.analyze = vi.fn().mockRejectedValue(new Error('analysis failed'));
    let current = EMPTY_DRAFT_FLOW_STATE;

    await expect(
      runDraftFlow(dependencies, current, 'capture', (state) => {
        current = state;
      }),
    ).rejects.toThrow('analysis failed');

    expect(current.capture).toEqual(capture);
    expect(current.receipt).toEqual(receipt);
    expect(current.analysis).toBeNull();
    expect(current.failedStage).toBe('analysis');
  });

  it('keeps the match result when drafting fails', async () => {
    const dependencies = successfulDependencies();
    dependencies.draft = vi.fn().mockRejectedValue(new Error('draft failed'));
    let current = EMPTY_DRAFT_FLOW_STATE;

    await expect(
      runDraftFlow(dependencies, current, 'capture', (state) => {
        current = state;
      }),
    ).rejects.toThrow('draft failed');

    expect(current.analysis).toEqual(analysis);
    expect(current.draft).toBeNull();
    expect(current.failedStage).toBe('draft');
  });

  it('surfaces the error code with the failed draft stage', async () => {
    const dependencies = successfulDependencies();
    dependencies.draft = vi.fn().mockRejectedValue(
      new ApiClientError(
        'The model did not return a usable draft.',
        'POST /job-analyses/:id/draft',
        502,
        'DRAFT_GENERATION_FAILED',
      ),
    );
    let current = EMPTY_DRAFT_FLOW_STATE;

    await expect(
      runDraftFlow(dependencies, current, 'capture', (state) => {
        current = state;
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_GENERATION_FAILED', status: 502 });

    expect(current.errorCode).toBe('DRAFT_GENERATION_FAILED');
    expect(current.failedStage).toBe('draft');
  });

  it('retries only the failed analysis step, then continues to drafting', async () => {
    const dependencies = successfulDependencies();
    const initialState: DraftFlowState = {
      ...EMPTY_DRAFT_FLOW_STATE,
      capture,
      receipt,
      failedStage: 'analysis',
    };

    const result = await runDraftFlow(
      dependencies,
      initialState,
      'analysis',
      () => undefined,
    );

    expect(result.draft).toEqual(draft);
    expect(dependencies.capture).not.toHaveBeenCalled();
    expect(dependencies.persist).not.toHaveBeenCalled();
    expect(dependencies.analyze).toHaveBeenCalledOnce();
    expect(dependencies.draft).toHaveBeenCalledOnce();
  });

  it('issues exactly one request for each of the four successful steps', async () => {
    const dependencies = successfulDependencies();
    const result = await run(dependencies);

    expect(result.draft).toEqual(draft);
    expect(
      dependencies.capture.mock.calls.length +
        dependencies.persist.mock.calls.length +
        dependencies.analyze.mock.calls.length +
        dependencies.draft.mock.calls.length,
    ).toBe(4);
    expect(dependencies.capture).toHaveBeenCalledOnce();
    expect(dependencies.persist).toHaveBeenCalledOnce();
    expect(dependencies.analyze).toHaveBeenCalledOnce();
    expect(dependencies.draft).toHaveBeenCalledOnce();
  });
});

function successfulDependencies() {
  return {
    capture: vi.fn().mockResolvedValue(capture),
    persist: vi.fn().mockResolvedValue(receipt),
    analyze: vi.fn().mockResolvedValue(analysis),
    draft: vi.fn().mockResolvedValue(draft),
  } satisfies Record<keyof DraftFlowDependencies, ReturnType<typeof vi.fn>>;
}

async function run(
  dependencies: ReturnType<typeof successfulDependencies>,
): Promise<DraftFlowState> {
  return runDraftFlow(
    dependencies,
    { ...EMPTY_DRAFT_FLOW_STATE },
    'capture',
    () => undefined,
  );
}
