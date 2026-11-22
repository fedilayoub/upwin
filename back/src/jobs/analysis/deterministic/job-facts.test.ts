import { describe, expect, it } from 'vitest';
import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';
import type { JobSnapshot } from '../../../job-snapshots/job-snapshot.schema';
import { inspectJob } from './job-facts';

const context: FreelancerContextFields = {
  experience: { roles: [] },
  skills: ['  REACT  '],
  portfolio: [],
  preferences: {},
  positioning: {},
};

describe('deterministic job facts', () => {
  it('weights mandatory skills double and normalizes case and whitespace', () => {
    const facts = inspectJob(
      snapshotWith({
        skills: [
          { name: 'React', relevance: 'mandatory' },
          { name: 'GraphQL', relevance: 'nice-to-have' },
        ],
      }),
      context,
      { targetRate: null },
    );

    expect(facts.skillCoverage).toMatchObject({
      score: 67,
      matchedSkills: ['React'],
      unmatchedSkills: ['GraphQL'],
    });
  });

  it('counts a skill found only in the newest profile snapshot', () => {
    const facts = inspectJob(
      snapshotWith({
        skills: [{ name: 'TypeScript', relevance: 'mandatory' }],
      }),
      context,
      { targetRate: null },
      [' TypeScript '],
    );

    expect(facts.skillCoverage.score).toBe(100);
  });

  it('puts empty portfolio evidence at the depth ladder floor', () => {
    const facts = inspectJob(snapshotWith({}), context, { targetRate: null });

    expect(facts.evidenceDepth).toEqual({
      score: 0,
      matchingProjects: [],
    });
    expect(facts.budgetFit.score).toBeNull();
  });

  it('uses the stricter confirmed and goal target when scoring a published budget', () => {
    const facts = inspectJob(
      snapshotWith({
        engagement: {
          budgetType: 'fixed',
          fixedBudget: { amount: 80, currency: 'USD' },
        },
      }),
      { ...context, positioning: { targetRate: 100 } },
      { targetRate: { min: 50, max: 70 } },
    );

    expect(facts.budgetFit.score).toBe(80);
  });
});

function snapshotWith(
  job: Partial<JobSnapshot['job']>,
): JobSnapshot {
  return {
    source: 'manual',
    capturedAt: '2026-08-23T12:00:00.000Z',
    job: {
      ciphertext: '~0abc123',
      url: 'https://www.upwork.com/jobs/~0abc123',
      title: 'React dashboard',
      description: 'Build a React dashboard.',
      engagement: { budgetType: 'unknown' },
      skills: [],
      questions: [],
      client: { paymentVerified: null },
      activity: {},
      ...job,
    },
  };
}
