import { describe, expect, it } from 'vitest';
import type { ProposalOutcomeListItem, ProposalOutcomeStatus } from '@/lib/api';
import {
  countByColumn,
  pendingMoves,
  toApplicationCards,
  type ApplicationCard,
} from '@/lib/application-kanban-data';

function outcome(
  overrides: Partial<ProposalOutcomeListItem> = {},
): ProposalOutcomeListItem {
  return {
    id: 'outcome-1',
    jobAnalysisId: 'analysis-1',
    jobTitle: 'Senior React Developer',
    jobUrl: 'https://www.upwork.com/jobs/~021',
    matchScore: 91,
    status: 'in-progress',
    connectsSpent: null,
    sentAt: null,
    respondedAt: null,
    decidedAt: null,
    note: null,
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-08-20T09:00:00.000Z',
    ...overrides,
  };
}

function card(overrides: Partial<ApplicationCard> = {}): ApplicationCard {
  return { ...toApplicationCards([outcome()])[0]!, ...overrides };
}

describe('toApplicationCards', () => {
  it('seeds each card into the column its stored status names', () => {
    // This is what makes a revisit land every job in the right column: the
    // column is the persisted status, not anything the browser remembered.
    const cards = toApplicationCards([
      outcome({ id: 'a', status: 'in-progress' }),
      outcome({ id: 'b', status: 'hired' }),
      outcome({ id: 'c', status: 'messaged' }),
    ]);
    expect(cards.map((entry) => entry.column)).toEqual([
      'in-progress',
      'hired',
      'messaged',
    ]);
  });

  it('carries a null sentAt through instead of coercing it to a date', () => {
    expect(toApplicationCards([outcome({ sentAt: null })])[0]?.sentAt).toBeNull();
  });
});

describe('pendingMoves', () => {
  const persisted = new Map<string, ProposalOutcomeStatus>([
    ['a', 'in-progress'],
    ['b', 'sent'],
  ]);

  it('reports only the cards whose column actually changed', () => {
    const moves = pendingMoves(
      [
        card({ id: 'a', jobAnalysisId: 'ja-a', column: 'sent' }),
        card({ id: 'b', jobAnalysisId: 'ja-b', column: 'sent' }),
      ],
      persisted,
    );
    expect(moves).toEqual([
      { id: 'a', jobAnalysisId: 'ja-a', from: 'in-progress', to: 'sent' },
    ]);
  });

  it('ignores reordering inside a column', () => {
    // The kanban primitive reorders on every drop. Position carries no meaning
    // in the contract, so persisting it would fire a write for nothing.
    const moves = pendingMoves(
      [
        card({ id: 'b', column: 'sent' }),
        card({ id: 'a', column: 'in-progress' }),
      ],
      persisted,
    );
    expect(moves).toEqual([]);
  });

  it('ignores a card the server has not confirmed yet', () => {
    expect(pendingMoves([card({ id: 'unknown', column: 'hired' })], persisted))
      .toEqual([]);
  });
});

describe('countByColumn', () => {
  it('counts the cards currently sitting in a column', () => {
    const cards = [
      card({ id: 'a', column: 'sent' }),
      card({ id: 'b', column: 'sent' }),
      card({ id: 'c', column: 'hired' }),
    ];
    expect(countByColumn(cards, 'sent')).toBe(2);
    expect(countByColumn(cards, 'viewed')).toBe(0);
  });
});
