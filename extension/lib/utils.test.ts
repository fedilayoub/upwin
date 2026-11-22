import { describe, expect, it } from 'vitest';
import type { GoalObjective } from '@/types/profile';
import { formatGoal } from './utils';

describe('formatGoal', () => {
  it('labels every objective in the frozen five-value goal set', () => {
    const objectives: GoalObjective[] = [
      'first-client',
      'more-clients',
      'more-responses',
      'higher-paying-projects',
      'scale',
    ];

    expect(objectives.map(formatGoal)).toEqual([
      'Get my first client',
      'Win more clients',
      'Increase proposal response rate',
      'Get higher-paying projects',
      'Scale my freelancing business',
    ]);
  });
});
