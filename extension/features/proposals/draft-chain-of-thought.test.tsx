import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { JobAnalysis, JobCaptureResult } from '@/types/job';
import type { Proposal } from '@/types/proposal';
import {
  DRAFT_FLOW_STAGES,
  DraftChainOfThought,
} from './draft-chain-of-thought';
import type { DraftFlowStage } from './use-draft-flow';

describe('DraftChainOfThought', () => {
  it.each(DRAFT_FLOW_STAGES)(
    'maps the %s active stage to complete, active, and pending steps',
    (stage) => {
      const markup = renderDraftChain({ stage });
      const activeIndex = DRAFT_FLOW_STAGES.indexOf(stage);

      DRAFT_FLOW_STAGES.forEach((flowStage, index) => {
        expect(statusFor(markup, flowStage)).toBe(
          index < activeIndex
            ? 'complete'
            : index === activeIndex
              ? 'active'
              : 'pending',
        );
      });
    },
  );

  it('keeps the failed stage pending and earlier stages complete', () => {
    const markup = renderDraftChain({ failedStage: 'analysis', stage: null });

    expect(statusFor(markup, 'capture')).toBe('complete');
    expect(statusFor(markup, 'persist')).toBe('complete');
    expect(statusFor(markup, 'analysis')).toBe('pending');
    expect(statusFor(markup, 'draft')).toBe('pending');
    expect(markup).not.toContain('data-status="active"');
  });

  it('shows no capture chips before capture data exists', () => {
    const markup = renderDraftChain({ capture: null, stage: 'capture' });

    expect(markup).not.toContain('Synthetic dashboard redesign');
    expect(markup).not.toContain('Payment verified');
  });

  it('marks every step complete and shows draft evidence when ready', () => {
    const markup = renderDraftChain({
      draft,
      onViewProposal: vi.fn(),
      stage: null,
    });

    for (const stage of DRAFT_FLOW_STAGES) {
      expect(statusFor(markup, stage)).toBe('complete');
    }
    expect(markup).toContain('Draft ready');
    expect(markup).toContain('145 words');
    expect(markup).toContain('1 answer');
    expect(markup).toContain('View proposal and answers');
    expect(markup).not.toContain('fixed');
    expect(markup.indexOf('data-proposal-ready-action')).toBeGreaterThan(
      markup.indexOf('data-flow-stage="draft"'),
    );
  });
});

function renderDraftChain(
  overrides: Partial<{
    analysis: JobAnalysis | null;
    capture: JobCaptureResult | null;
    draft: Proposal | null;
    failedStage: DraftFlowStage | null;
    onViewProposal: () => void;
    stage: DraftFlowStage | null;
  }> = {},
): string {
  return renderToStaticMarkup(
    <DraftChainOfThought
      analysis={overrides.analysis ?? analysis}
      capture={'capture' in overrides ? (overrides.capture ?? null) : capture}
      draft={overrides.draft ?? null}
      failedStage={overrides.failedStage ?? null}
      onViewProposal={overrides.onViewProposal}
      stage={'stage' in overrides ? (overrides.stage ?? null) : 'capture'}
    />,
  );
}

function statusFor(markup: string, stage: DraftFlowStage): string | undefined {
  return markup.match(
    new RegExp(`data-status="([^"]+)" data-flow-stage="${stage}"`),
  )?.[1];
}

const capture: JobCaptureResult = {
  snapshot: {
    source: 'upwork-dom',
    capturedAt: '2026-09-04T10:00:00.000Z',
    job: {
      ciphertext: '~0synthetic',
      url: 'https://www.upwork.com/jobs/~0synthetic',
      title: 'Synthetic dashboard redesign',
      description: 'Redesign a synthetic dashboard.',
      engagement: {
        budgetType: 'hourly',
        hourlyBudget: { currency: 'USD', max: 30, min: 15 },
      },
      skills: [{ name: 'React', relevance: 'mandatory' }],
      questions: [],
      client: { country: 'Canada', paymentVerified: true },
      activity: {},
    },
  },
  truncatedFields: [],
};

const analysis: JobAnalysis = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa11',
  jobSnapshotId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
  goalId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa12',
  matchScore: 78,
  summary: 'Strong fit.',
  dimensions: [
    { id: 'skills', score: 88, criteria: [] },
    { id: 'experience', score: 92, criteria: [] },
  ],
  strengths: [],
  concerns: [],
  questionCount: 0,
  versions: {
    prompt: 'job-match-v1',
    rubric: 'job-match-rubric-v1',
    scoring: 'job-match-scoring-v1',
    requestedModel: 'gpt-4.1-mini',
    provider: 'openai',
    model: 'openai/gpt-4.1-mini',
  },
  createdAt: '2026-09-04T10:00:02.000Z',
};

const draft: Proposal = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa13',
  jobAnalysisId: analysis.id,
  proposal: {
    blockId: 'proposal',
    text: 'A synthetic proposal.',
    wordCount: 145,
    variantIndex: 0,
  },
  answers: [
    {
      blockId: 'answer:0',
      position: 0,
      question: 'How would you approach the redesign?',
      text: 'With a focused audit.',
      wordCount: 5,
      variantIndex: 0,
    },
  ],
  versions: {
    prompt: 'proposal-writer-v1',
    requestedModel: 'gpt-4.1-mini',
    provider: 'openai',
    model: 'openai/gpt-4.1-mini',
  },
  createdAt: '2026-09-04T10:00:03.000Z',
};
