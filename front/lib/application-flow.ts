import {
  PROPOSAL_OUTCOME_STATUSES,
  type ProposalOutcomeStatus,
} from '@/lib/api';

/**
 * Board columns, in render order. Identical to the wire order by construction —
 * the contract makes that order load-bearing, and the test asserts the equality
 * so a ninth status cannot be added on one side only.
 */
export const BOARD_LANES: readonly ProposalOutcomeStatus[] =
  PROPOSAL_OUTCOME_STATUSES;

/** Terminal columns. Nothing moves out of these on its own. */
export const CLOSED_LANES: readonly ProposalOutcomeStatus[] = [
  'hired',
  'declined',
  'no-response',
];

export function isClosed(status: ProposalOutcomeStatus): boolean {
  return CLOSED_LANES.includes(status);
}
