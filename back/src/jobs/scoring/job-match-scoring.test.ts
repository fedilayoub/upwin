import { describe, expect, it } from 'vitest';
import type { JobMatchEvaluation } from '../../ai/schemas/job-match.schema';
import type { FreelancerContextFields } from '../../freelancer-context/freelancer-context.schema';
import type { JobSnapshot } from '../../job-snapshots/job-snapshot.schema';
import { inspectJob } from '../analysis/deterministic/job-facts';
import {
  InvalidJobMatchCriterionScoreError,
  redistributeUnavailableWeights,
  scoreJobMatch,
} from './job-match-scoring';
import {
  getJobMatchWeights,
} from './weights/job-match-weights';

const evaluation: JobMatchEvaluation = {
  summary: 'Relevant match.',
  dimensions: [
    dimension('skills', 'skillDepth', 75),
    dimension('domain', 'domainFit', 75),
    dimension('experience', 'experienceRelevance', 75),
    dimension('goalAlignment', 'goalFit', 75),
  ],
  strengths: [],
  concerns: [],
};
const context: FreelancerContextFields = {
  experience: { roles: [] },
  skills: ['React', 'TypeScript'],
  portfolio: [
    { title: 'React dashboard', description: 'TypeScript product interface', skills: ['React'] },
  ],
  preferences: {},
  positioning: {},
};

describe('job match scoring', () => {
  it('is deterministic for identical AI judgments, facts, and weights', () => {
    const facts = inspectJob(jobSnapshot(), context, { targetRate: null });
    const weights = getJobMatchWeights('first-client');

    expect(scoreJobMatch(evaluation, facts, weights)).toEqual(
      scoreJobMatch(evaluation, facts, weights),
    );
  });

  it.each([101, -1, 50.5])(
    'rejects invalid AI criterion score %s before scoring',
    (invalidScore) => {
      const invalid = structuredClone(evaluation);
      const firstCriterion = invalid.dimensions[0]?.criteria[0];
      if (!firstCriterion) throw new Error('Fixture criterion missing.');
      firstCriterion.score = invalidScore;

      expect(() =>
        scoreJobMatch(
          invalid,
          inspectJob(jobSnapshot(), context, { targetRate: null }),
          getJobMatchWeights('first-client'),
        ),
      ).toThrow(InvalidJobMatchCriterionScoreError);
    },
  );

  it('drops unknown budget and redistributes its weight to exactly one', () => {
    const original = getJobMatchWeights('first-client');
    const weights = redistributeUnavailableWeights(
      original,
      ['budget'],
    );

    expect(weights.budget).toBe(0);
    expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(weights.skills).toBeCloseTo(original.skills / 0.9, 12);
    expect(weights.domain).toBeCloseTo(original.domain / 0.9, 12);
    expect(weights.experience).toBeCloseTo(original.experience / 0.9, 12);
    expect(weights.goalAlignment).toBeCloseTo(
      original.goalAlignment / 0.9,
      12,
    );
  });

  it('keeps client reputation and activity outside the match score', () => {
    const original = jobSnapshot();
    const changed: JobSnapshot = {
      ...original,
      job: {
        ...original.job,
        client: {
          paymentVerified: true,
          rating: 1,
          totalSpend: 9_999_999,
          hireRate: 2,
        },
        activity: { applicants: 999, interviewing: 50, hired: 20 },
      },
    };
    const weights = getJobMatchWeights('first-client');
    const first = scoreJobMatch(
      evaluation,
      inspectJob(original, context, { targetRate: null }),
      weights,
    );
    const second = scoreJobMatch(
      evaluation,
      inspectJob(changed, context, { targetRate: null }),
      weights,
    );

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

function dimension(
  id: 'skills' | 'domain' | 'experience' | 'goalAlignment',
  name: 'skillDepth' | 'domainFit' | 'experienceRelevance' | 'goalFit',
  score: number,
): JobMatchEvaluation['dimensions'][number] {
  return {
    id,
    criteria: [{ name, score, reasoning: 'Anchored.', evidence: ['Evidence'] }],
  };
}

function jobSnapshot(): JobSnapshot {
  return {
    source: 'manual',
    capturedAt: '2026-08-23T12:00:00.000Z',
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
      questions: [],
      client: { paymentVerified: null },
      activity: {},
    },
  };
}
