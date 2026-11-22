import { describe, expect, it } from 'vitest';
import { PROPOSAL_OUTCOME_STATUSES } from '@/lib/api';
import { BOARD_LANES, CLOSED_LANES, isClosed } from '@/lib/application-flow';

describe('application flow', () => {
  it('renders columns in the contract wire order', () => {
    // The contract makes the array order load-bearing. If a ninth status is
    // added on one side only, this is what catches it.
    expect([...BOARD_LANES]).toEqual([...PROPOSAL_OUTCOME_STATUSES]);
  });

  it('starts at in-progress and ends at the terminal states', () => {
    expect(BOARD_LANES[0]).toBe('in-progress');
    expect(BOARD_LANES.slice(-3)).toEqual(['hired', 'declined', 'no-response']);
  });

  it('classifies exactly the terminal statuses as closed', () => {
    for (const status of PROPOSAL_OUTCOME_STATUSES) {
      expect(isClosed(status)).toBe(CLOSED_LANES.includes(status));
    }
  });
});
