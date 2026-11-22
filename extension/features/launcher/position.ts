/**
 * Where the launcher bar sits on the right edge of the viewport.
 *
 * The stored value is a fraction of the *track* — the run of pixels the bar's
 * top edge may occupy between the two edge margins — rather than a raw pixel
 * offset. A fraction survives a window resize and a move to a different-sized
 * screen: pixels would leave the bar hanging off a shorter viewport.
 *
 * No browser globals here on purpose, so the maths is testable and the hook is
 * the only part that needs a DOM.
 */

/** Gap kept between the bar and the top/bottom viewport edges. */
export const LAUNCHER_EDGE_MARGIN = 8;

/** Vertically centred, matching where the bar sat before it could be moved. */
export const DEFAULT_LAUNCHER_FRACTION = 0.5;

/**
 * Pointer travel that turns a press into a drag. Below it the gesture is
 * still a click, so nudging the mouse while clicking the toggle does not
 * swallow the click.
 */
export const LAUNCHER_DRAG_THRESHOLD = 4;

/** Pixels the bar's top edge can move through. Zero on a viewport too short. */
export function launcherTrackHeight(
  viewportHeight: number,
  barHeight: number,
): number {
  return Math.max(0, viewportHeight - barHeight - LAUNCHER_EDGE_MARGIN * 2);
}

export function clampLauncherFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return DEFAULT_LAUNCHER_FRACTION;
  return Math.min(1, Math.max(0, fraction));
}

/**
 * Fraction -> `top` in CSS pixels for the bar's top edge.
 *
 * On a viewport shorter than the bar the track collapses and every fraction
 * lands on the top margin, which keeps the toggle reachable instead of
 * pushing it off-screen.
 */
export function launcherTopFromFraction(
  fraction: number,
  viewportHeight: number,
  barHeight: number,
): number {
  return (
    LAUNCHER_EDGE_MARGIN +
    clampLauncherFraction(fraction) *
      launcherTrackHeight(viewportHeight, barHeight)
  );
}

/** Inverse of {@link launcherTopFromFraction}; clamps out-of-range drags. */
export function launcherFractionFromTop(
  top: number,
  viewportHeight: number,
  barHeight: number,
): number {
  const track = launcherTrackHeight(viewportHeight, barHeight);
  if (track === 0) return 0;
  return clampLauncherFraction((top - LAUNCHER_EDGE_MARGIN) / track);
}
