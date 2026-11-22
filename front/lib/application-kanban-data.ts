import type { ProposalOutcomeListItem, ProposalOutcomeStatus } from '@/lib/api';

/**
 * A board card. `id`, `name`, and `column` are the shape the kanban primitive
 * requires; everything else is ours and rides along untouched.
 */
export type ApplicationCard = {
  id: string;
  name: string;
  column: ProposalOutcomeStatus;
  jobAnalysisId: string;
  jobUrl: string;
  matchScore: number;
  connectsSpent: number | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A board column. Type alias, not interface, for the same reason. */
export type ApplicationColumn = {
  id: ProposalOutcomeStatus;
  name: string;
};

export function toApplicationCards(
  items: readonly ProposalOutcomeListItem[],
): ApplicationCard[] {
  return items.map((item) => ({
    id: item.id,
    name: item.jobTitle,
    column: item.status,
    jobAnalysisId: item.jobAnalysisId,
    jobUrl: item.jobUrl,
    matchScore: item.matchScore,
    connectsSpent: item.connectsSpent,
    sentAt: item.sentAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export interface ApplicationMove {
  id: string;
  jobAnalysisId: string;
  from: ProposalOutcomeStatus;
  to: ProposalOutcomeStatus;
}

/**
 * Which cards changed column relative to what the server last confirmed.
 *
 * The kanban primitive also reorders cards within a column; reordering is not
 * persisted, because the board's order is `createdAt desc` from the server and
 * position carries no meaning in the contract. Only a column change is a move.
 */
export function pendingMoves(
  cards: readonly ApplicationCard[],
  persisted: ReadonlyMap<string, ProposalOutcomeStatus>,
): ApplicationMove[] {
  const moves: ApplicationMove[] = [];
  for (const card of cards) {
    const from = persisted.get(card.id);
    if (from !== undefined && from !== card.column) {
      moves.push({
        id: card.id,
        jobAnalysisId: card.jobAnalysisId,
        from,
        to: card.column,
      });
    }
  }
  return moves;
}

export function countByColumn(
  cards: readonly ApplicationCard[],
  column: ProposalOutcomeStatus,
): number {
  return cards.reduce(
    (total, card) => (card.column === column ? total + 1 : total),
    0,
  );
}
