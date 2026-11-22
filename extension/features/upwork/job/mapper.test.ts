import { describe, expect, it } from 'vitest';
import { mapExtractedJob, type RawJobDom } from './mapper';
import type { RawJob } from './payload';

const DOM: RawJobDom = {
  title: 'DOM title',
  description: 'DOM description',
  questions: [],
  skills: [],
  client: { paymentVerified: null },
};

describe('job mapper', () => {
  it.each([
    [1, 'entry'],
    [2, 'intermediate'],
    [3, 'expert'],
  ] as const)('maps contractor tier %s to %s', (tier, expected) => {
    const result = mapExtractedJob(
      input({ ...payload(), contractorTier: tier }),
    );

    expect(result.snapshot.job.engagement.experienceLevel).toBe(expected);
  });

  it('omits hourly budget when Upwork says the range was not provided', () => {
    const result = mapExtractedJob(
      input({
        ...payload(),
        hourlyBudgetType: 'NOT_PROVIDED',
        hourlyBudgetMin: null,
        hourlyBudgetMax: null,
      }),
    );

    expect(result.snapshot.job.engagement.budgetType).toBe('hourly');
    expect(result.snapshot.job.engagement.hourlyBudget).toBeUndefined();
  });

  it('prefers payload fields and maps relevance labels without scoring logic', () => {
    const result = mapExtractedJob(
      input({
        ...payload(),
        title: 'Payload title',
        skills: [
          { name: 'TypeScript', relevance: 'MANDATORY' },
          { name: 'PostgreSQL', relevance: 'NICE_TO_HAVE' },
        ],
      }),
    );

    expect(result.snapshot.source).toBe('upwork-payload');
    expect(result.snapshot.job.title).toBe('Payload title');
    expect(result.snapshot.job.skills).toEqual([
      { name: 'TypeScript', relevance: 'mandatory' },
      { name: 'PostgreSQL', relevance: 'nice-to-have' },
    ]);
  });
});

function payload(): RawJob {
  return {
    title: 'Payload title',
    description: 'Payload description',
    hourlyBudgetType: 'DEFAULT',
    hourlyBudgetMin: 15,
    hourlyBudgetMax: 30,
    budgetCurrency: 'USD',
    questions: [],
    skills: [],
    client: {},
    activity: {},
  };
}

function input(payloadValue: RawJob) {
  return {
    payload: payloadValue,
    dom: DOM,
    ciphertext: '~0def456',
    url: 'https://www.upwork.com/jobs/~0def456',
    capturedAt: '2026-08-23T12:00:00.000Z',
  };
}
