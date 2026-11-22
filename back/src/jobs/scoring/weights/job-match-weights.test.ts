import { describe, expect, it } from 'vitest';
import { JOB_MATCH_WEIGHTS } from './job-match-weights';

describe('job match weights', () => {
  it('keeps every objective row at exactly one whole score', () => {
    for (const weights of Object.values(JOB_MATCH_WEIGHTS)) {
      expect(
        Object.values(weights).reduce((sum, value) => sum + value, 0),
      ).toBeCloseTo(1, 12);
    }
  });
});
