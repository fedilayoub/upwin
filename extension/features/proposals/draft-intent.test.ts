import { describe, expect, it, vi } from 'vitest';

vi.mock('#imports', () => ({
  storage: { defineItem: () => ({}) },
}));

import {
  consumeDraftIntent,
  isActionableDraftIntent,
  PROPOSAL_DRAFT_INTENT_TTL_MS,
} from './draft-intent';

const now = 1_800_000_000_000;
const intent = { requestedAt: now - 500, ciphertext: '~0def456' };

describe('proposal draft intent', () => {
  it('rejects an intent older than its TTL', () => {
    expect(
      isActionableDraftIntent(
        {
          ...intent,
          requestedAt: now - PROPOSAL_DRAFT_INTENT_TTL_MS - 1,
        },
        now,
      ),
    ).toBe(false);
  });

  it('deletes an actionable intent before acting on it', async () => {
    const order: string[] = [];
    await expect(
      consumeDraftIntent(intent, now, {
        remove: vi.fn(async () => {
          order.push('remove');
        }),
        act: vi.fn(() => {
          order.push('act');
        }),
      }),
    ).resolves.toBe(true);

    expect(order).toEqual(['remove', 'act']);
  });

  it('does not capture on a second panel open with no fresh intent', async () => {
    const capture = vi.fn();
    const remove = vi.fn().mockResolvedValue(undefined);

    await consumeDraftIntent(intent, now, { act: capture, remove });
    capture.mockClear();
    await consumeDraftIntent(null, now, { act: capture, remove });

    expect(capture).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
  });
});
