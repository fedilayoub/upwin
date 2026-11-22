/**
 * What the page host paints for the marker check, and what the engine looks for
 * (see ./marker-probe.ts). Kept apart so the injected host imports nothing else.
 *
 * The marker is a tint too faint to notice, laid over the recorder bar. It steps through three
 * colors. The engine does not look for the colors: it looks for the change between two tints.
 * Blending `tint` at `alpha` over any pixel `p` gives `p * (1 - alpha) + tint * alpha`, so
 * going from one tint to the next moves every pixel by `(next - previous) * alpha`, whatever is
 * underneath. That fixed step is what the scanner finds.
 *
 * How it stays out of sight:
 * - **No green.** The eye takes most of its brightness from green. The steps move only red and
 *   blue, so the bar's brightness changes by about 1%.
 * - **One channel at a time, toward where there is room.** A dark bar can only get lighter and a
 *   light one darker. Each theme has its own three tints, so a tint moves the bar by one small
 *   step in one channel (two for the third tint), never by a wash over all of them.
 * - **Only the bar.** The patch has the bar's own shape.
 */

type Rgb = readonly [number, number, number];
/**
 * The tints, in the order the host cycles through them. Both sets make the same three steps,
 * the light set with the signs flipped:
 * 1. red down, blue up; 2. red up; 3. blue down.
 */
export const MARKER_TINTS: Record<"dark" | "light", readonly [Rgb, Rgb, Rgb]> = {
  // On a dark bar: red, blue, magenta. Each adds a little light.
  dark: [
    [255, 0, 0],
    [0, 0, 255],
    [255, 0, 255],
  ],
  // On a light bar: cyan, yellow, green. Each takes a little light away.
  light: [
    [0, 255, 255],
    [255, 255, 0],
    [0, 255, 0],
  ],
};
/** Each tint's opacity: a step of about 8 levels out of 255. */
export const MARKER_ALPHA = 0.03;
/** The size of one step in a channel: what the scanner expects to see change. */
export const MARKER_DELTA = 255 * MARKER_ALPHA;
/**
 * How long the host holds each tint. Long enough that a capture running at only 5 frames a
 * second still sees every one: a skipped tint would break the order.
 */
export const MARKER_STEP_MS = 250;
/**
 * The least size of the tinted patch, in device pixels. The bar is larger than this except at a
 * strong zoom-out; then the patch grows past the bar. The host divides by `devicePixelRatio`.
 */
export const MARKER_DEVICE_SIZE = { w: 320, h: 64 } as const;
