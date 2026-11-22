import { describe, expect, it } from 'vitest';
import type { JobAnalysis, JobCaptureResult } from '@/types/job';
import { jobCaptureChips, matchChips } from './draft-evidence';

describe('draft evidence', () => {
  it('formats fixed and hourly budgets and omits unknown budgets', () => {
    expect(jobCaptureChips(capture('fixed'))).toContain('$2,500 fixed');
    expect(jobCaptureChips(capture('hourly'))).toContain('$15–$30/hr');
    expect(jobCaptureChips(capture('unknown')).some((chip) => chip.includes('$')))
      .toBe(false);
  });

  it('reports zero questions as a useful fact', () => {
    expect(jobCaptureChips(capture('hourly'))).toContain(
      'No screening questions',
    );
  });

  it.each([false, null] as const)(
    'does not claim payment verification when it is %s',
    (paymentVerified) => {
      const value = capture('hourly');
      value.snapshot.job.client.paymentVerified = paymentVerified;
      expect(jobCaptureChips(value)).not.toContain('Payment verified');
    },
  );

  it('shows payment verification when it is true', () => {
    expect(jobCaptureChips(capture('hourly'))).toContain('Payment verified');
  });

  it('truncates long titles to forty characters', () => {
    const value = capture('hourly');
    value.snapshot.job.title = 'A deliberately long synthetic job title that keeps going';
    const [title] = jobCaptureChips(value);

    expect(title).toBeDefined();
    if (!title) throw new Error('Expected the title chip.');
    expect(title).toHaveLength(40);
    expect(title.endsWith('…')).toBe(true);
  });

  it('shows the match score and two highest-scoring dimensions', () => {
    expect(matchChips(analysis)).toEqual([
      'Match 78/100',
      'Experience 92/100',
      'Skills 88/100',
    ]);
  });
});

function capture(
  budgetType: 'fixed' | 'hourly' | 'unknown',
): JobCaptureResult {
  return {
    snapshot: {
      source: 'upwork-dom',
      capturedAt: '2026-09-04T10:00:00.000Z',
      job: {
        ciphertext: '~0synthetic',
        url: 'https://www.upwork.com/jobs/~0synthetic',
        title: 'Synthetic dashboard redesign',
        description: 'Redesign a synthetic dashboard.',
        engagement: {
          budgetType,
          fixedBudget:
            budgetType === 'fixed'
              ? { amount: 2500, currency: 'USD' }
              : undefined,
          hourlyBudget:
            budgetType === 'hourly'
              ? { currency: 'USD', max: 30, min: 15 }
              : undefined,
        },
        skills: [
          { name: 'React', relevance: 'mandatory' },
          { name: 'TypeScript', relevance: 'nice-to-have' },
        ],
        questions: [],
        client: { country: 'Canada', paymentVerified: true },
        activity: {},
      },
    },
    truncatedFields: ['job.description'],
  };
}

const analysis: JobAnalysis = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa11',
  jobSnapshotId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
  goalId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa12',
  matchScore: 78,
  summary: 'Strong fit.',
  dimensions: [
    { id: 'budget', score: 60, criteria: [] },
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
