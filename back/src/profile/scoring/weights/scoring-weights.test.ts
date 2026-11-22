import { describe, expect, it } from 'vitest';
import { GOAL_OBJECTIVES } from '../../../goals/goal.schema';
import { getScoringWeights, SCORING_WEIGHTS } from './scoring-weights';

describe('scoring weights', () => {
  it.each(GOAL_OBJECTIVES)('%s sums to exactly one', (objective) => {
    const sum = Object.values(getScoringWeights(objective)).reduce(
      (total, weight) => total + weight,
      0,
    );
    expect(sum).toBeCloseTo(1, 10);
  });

  it('falls back to first-client for an unknown objective', () => {
    expect(getScoringWeights('future-objective')).toBe(
      SCORING_WEIGHTS['first-client'],
    );
  });
});
