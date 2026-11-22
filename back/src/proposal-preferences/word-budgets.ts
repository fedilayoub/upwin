import type {
  AnswerLength,
  ProposalLength,
} from './proposal-preferences.schema';

export const wordBudgetVersion = 'word-budgets-v1';

export interface WordBudget {
  targetWords: number;
  hardCeilingWords: number;
}

const WORD_BUDGETS: Readonly<
  Record<ProposalLength | AnswerLength, Readonly<WordBudget>>
> = {
  short: { targetWords: 120, hardCeilingWords: 240 },
  medium: { targetWords: 200, hardCeilingWords: 400 },
  long: { targetWords: 320, hardCeilingWords: 640 },
  brief: { targetWords: 40, hardCeilingWords: 100 },
  standard: { targetWords: 90, hardCeilingWords: 200 },
  detailed: { targetWords: 160, hardCeilingWords: 340 },
};

export function resolveWordBudget(
  length: ProposalLength | AnswerLength,
): Readonly<WordBudget> {
  return WORD_BUDGETS[length];
}
