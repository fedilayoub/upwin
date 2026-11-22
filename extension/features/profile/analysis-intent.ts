import { storage } from '#imports';

/**
 * A pending request to analyse the profile, written by the worker when the user
 * clicks the on-page Analyze shortcut and read by the side panel.
 *
 * A stored intent rather than a message because the panel is usually closed at
 * the moment of the click: there is nothing listening yet, and the worker
 * cannot await the panel's boot without spending the user gesture that
 * `sidePanel.open()` needs. The panel watches the item instead, so the same
 * path serves a cold open and a panel that is already on screen.
 *
 * `session:` so an intent never survives the browser session. Capture must stay
 * one-shot and user-initiated, which is also why the panel deletes the
 * intent as it acts on it: a later panel open must never re-capture on its own.
 */
export interface ProfileAnalysisIntent {
  requestedAt: number;
}

export const profileAnalysisIntentItem =
  storage.defineItem<ProfileAnalysisIntent | null>(
    'session:profile-analysis-intent',
    { fallback: null },
  );

/**
 * How long a click stays actionable. Long enough to cover a panel boot that
 * waits on sign-in, short enough that an intent nobody consumed — the panel
 * never opened, the user navigated away — cannot fire an unexpected capture
 * later in the session.
 */
export const PROFILE_ANALYSIS_INTENT_TTL_MS = 60_000;

export function isActionableAnalysisIntent(
  intent: ProfileAnalysisIntent | null,
  now: number,
): intent is ProfileAnalysisIntent {
  if (intent === null) return false;

  const age = now - intent.requestedAt;
  // A negative age means the clock moved backwards between the worker's write
  // and this read. Treat it as fresh rather than dropping a real user click.
  return age <= PROFILE_ANALYSIS_INTENT_TTL_MS;
}
