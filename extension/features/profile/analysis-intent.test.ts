import { describe, expect, it, vi } from 'vitest';

vi.mock('#imports', () => ({
  storage: { defineItem: () => ({}) },
}));

import {
  isActionableAnalysisIntent,
  PROFILE_ANALYSIS_INTENT_TTL_MS,
} from './analysis-intent';

const now = 1_800_000_000_000;

describe('isActionableAnalysisIntent', () => {
  it('acts on a click the panel picked up while it was booting', () => {
    expect(isActionableAnalysisIntent({ requestedAt: now - 3_000 }, now)).toBe(
      true,
    );
  });

  it('ignores an absent intent, so opening the panel never captures on its own', () => {
    expect(isActionableAnalysisIntent(null, now)).toBe(false);
  });

  it('ignores an intent nobody consumed in time', () => {
    // An unconsumed click must not fire an unexpected capture later in the
    // session — capture stays one-shot and user-initiated.
    expect(
      isActionableAnalysisIntent(
        { requestedAt: now - PROFILE_ANALYSIS_INTENT_TTL_MS - 1 },
        now,
      ),
    ).toBe(false);
  });

  it('still acts when the clock moved backwards between write and read', () => {
    expect(isActionableAnalysisIntent({ requestedAt: now + 500 }, now)).toBe(
      true,
    );
  });
});
