import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { JobAnalysis, JobSnapshot } from '@/types/job';

vi.mock('@/features/proposals/proposal-context', () => ({
  useProposal: vi.fn(),
}));
vi.mock('@/features/connection/connection-context', () => ({
  useConnection: () => ({ getToken: vi.fn() }),
}));

import { AboutJob, JobFlowError, JobMatchResults } from './job-screen';

const snapshot: JobSnapshot = {
  source: 'upwork-dom',
  capturedAt: '2026-08-23T12:00:00.000Z',
  job: {
    ciphertext: '~0def456',
    url: 'https://www.upwork.com/jobs/~0def456',
    title: 'Synthetic SaaS redesign',
    description: 'Redesign a synthetic dashboard.',
    engagement: { budgetType: 'hourly' },
    skills: [{ name: 'Design systems', relevance: 'mandatory' }],
    questions: [],
    client: {
      paymentVerified: true,
      rating: 4.8,
      reviewCount: 12,
    },
    activity: { applicants: 57 },
  },
};

const analysis: JobAnalysis = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa11',
  jobSnapshotId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
  goalId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa12',
  matchScore: 74,
  summary: 'Your systems experience is relevant to this job.',
  dimensions: [
    { id: 'skills', score: 80, criteria: [] },
    {
      id: 'domain',
      score: 75,
      criteria: [
        {
          id: 'domainEvidence',
          label: 'Domain evidence',
          evidence: ['A confirmed SaaS dashboard project.'],
        },
      ],
    },
    { id: 'experience', score: 76, criteria: [] },
    { id: 'budget', score: 60, criteria: [] },
    { id: 'goalAlignment', score: 72, criteria: [] },
  ],
  strengths: ['Relevant design-system work'],
  concerns: ['No published hourly range'],
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

describe('JobMatchResults', () => {
  it('renders score, five dimensions, evidence, strengths, and concerns', () => {
    const markup = renderToStaticMarkup(
      <JobMatchResults analysis={analysis} snapshot={snapshot} />,
    );

    expect(markup).toContain('Match Score');
    expect(markup).toContain('74');
    expect(markup).toContain('A confirmed SaaS dashboard project.');
    expect(markup).toContain('Relevant design-system work');
    expect(markup).toContain('No published hourly range');
    expect(markup).toContain('data-job-results');
    expect(markup).toContain('min-[760px]:grid-cols-12');
    for (const id of ['skills', 'domain', 'experience', 'budget', 'goalAlignment']) {
      expect(markup).toContain(`data-section-id="${id}"`);
    }
  });

  it('keeps applicant count in a separate unscored About this job block', () => {
    const markup = renderToStaticMarkup(
      <JobMatchResults analysis={analysis} snapshot={snapshot} />,
    );

    expect(markup).toContain('About this job');
    expect(markup).toContain('Applicants');
    expect(markup).toContain('57');
    expect(markup).toContain('do not affect the Match Score');
    expect(markup).not.toContain('74% match — 57 applicants');
  });
});

describe('AboutJob', () => {
  it('rounds fractional hire rates and groups large counts for clean display', () => {
    const markup = renderToStaticMarkup(
      <AboutJob
        snapshot={{
          ...snapshot,
          job: {
            ...snapshot.job,
            client: {
              ...snapshot.job.client,
              hires: 1_234,
              hireRate: 54.83870967741935,
            },
            activity: {
              ...snapshot.job.activity,
              applicants: 5_678,
            },
          },
        }}
      />,
    );

    expect(markup).toContain('55%');
    expect(markup).not.toContain('54.83870967741935%');
    expect(markup).toContain('1,234');
    expect(markup).toContain('5,678');
  });
});

describe('JobFlowError', () => {
  it('shows the failure and a retry for the stage that failed', () => {
    const markup = renderToStaticMarkup(
      <JobFlowError
        message="The upwin API could not be reached."
        onRetry={() => undefined}
        stage="analysis"
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('The upwin API could not be reached.');
    expect(markup).toContain('Retry');
  });
});
