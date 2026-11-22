import { describe, expect, it } from 'vitest';
import { resolveWordBudget, wordBudgetVersion } from './word-budgets';

const CASES = [
  ['short', 120, 240],
  ['medium', 200, 400],
  ['long', 320, 640],
  ['brief', 40, 100],
  ['standard', 90, 200],
  ['detailed', 160, 340],
] as const;

describe('word budget resolver', () => {
  it('keeps the first budget version stable', () => {
    expect(wordBudgetVersion).toBe('word-budgets-v1');
  });

  it.each(CASES)(
    'resolves %s to target %i and hard ceiling %i',
    (length, targetWords, hardCeilingWords) => {
      const budget = resolveWordBudget(length);

      expect(budget).toEqual({ targetWords, hardCeilingWords });
      expect(budget.hardCeilingWords).toBeGreaterThan(budget.targetWords);
    },
  );
});
