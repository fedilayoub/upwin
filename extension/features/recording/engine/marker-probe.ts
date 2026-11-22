import { breakoutBox, type BreakoutBox } from "./compositor";
import { MARKER_DELTA } from "./marker-colors";

/**
 * The marker check: is the page bubble inside what is being captured?
 *
 * The browser's picker never says which window, screen or tab was chosen, so the recorder
 * cannot know whether the bubble on the page will be in the video. Guessing wrong puts the
 * camera in the video twice, or not at all. So, after the pick and before anything is recorded,
 * the page host lays a faint, changing tint over the recorder bar and this probe looks for
 * those changes in the frames (see ./marker-colors.ts for why a change can be found when the
 * tint itself cannot be seen).
 *
 * This is the only read of captured pixels in the extension.
 * It runs on the device, before recording, for a few seconds at most, and looks for nothing but
 * the recorder's own marker. No frame is kept or sent.
 */

/** After the result, this long passes before recording: the marker is off the page by then. */
export const MARKER_CLEAR_MS = 350;

export type MarkerResult = "yes" | "no" | "unknown";

/** Frames are compared as the mean color of 4 x 4 blocks: flat enough to measure a faint step. */
const BLOCK = 4;
/** The host holds each tint for 250 ms. Changes closer than this are something else moving. */
const MIN_GAP_MS = 120;
/** A full turn of the three tints. */
const STEPS_NEEDED = 3;

/**
 * Which tint step a block's change is: 1, 2 or 3 for the dark set, -1, -2 or -3 for the light
 * set (the same steps with the signs flipped), or 0.
 * - 1: red falls and blue rises; 2: red rises alone; 3: blue falls alone. Green holds in all.
 *
 * The bounds are wide on purpose. A capture can scale a step and leak some of it into the
 * other channels (a wide-gamut display, a YUV round trip), but it keeps which channel rises,
 * which falls and which holds.
 */
function stepOf(dr: number, dg: number, db: number, delta: number) {
  const low = 0.4 * delta,
    high = 2 * delta;
  const moved = (value: number) => value >= low && value <= high;
  for (const sign of [1, -1]) {
    const r = sign * dr,
      g = Math.abs(dg),
      b = sign * db;
    if (moved(-r) && moved(b) && g <= 0.5 * Math.min(-r, b)) return sign;
    if (moved(r) && g <= 0.5 * r && Math.abs(b) <= 0.5 * r) return 2 * sign;
    if (moved(-b) && g <= 0.5 * -b && Math.abs(r) <= 0.5 * -b) return 3 * sign;
  }
  return 0;
}

/**
 * Finds the marker in a sequence of RGBA frames: blocks whose color makes the three tint steps
 * in order, each one a single jump with stillness around it.
 *
 * What does not count:
 * - still content, of any color;
 * - content that keeps changing (video, a spinner, a rotating hue): its changes are not apart;
 * - steps in the wrong order, of mixed sets, or broken by any other change;
 * - a patch smaller than the marker can be.
 */
export class MarkerScanner {
  private width = 0;
  private height = 0;
  private cols = 0;
  private rows = 0;
  private means = new Float32Array(0);
  private next = new Float32Array(0);
  /** The last step seen in a block, signed by its set, and how many came in order. */
  private lastStep = new Int8Array(0);
  private steps = new Uint8Array(0);
  private changedAt = new Float64Array(0);
  private primed = false;
  /**
   * `minBlocks`: the patch is at least 320 x 64 device pixels. Scaled into a 1080p frame of a
   * 4K screen that is 160 x 32 pixels: over 250 whole blocks.
   */
  constructor(
    private minBlocks = 32,
    private delta = MARKER_DELTA,
  ) {}
  /** Returns true once the marker has been seen. `timeMs` is the frame's time. */
  push(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    timeMs: number,
  ): boolean {
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.cols = Math.floor(width / BLOCK);
      this.rows = Math.floor(height / BLOCK);
      const blocks = this.cols * this.rows;
      this.means = new Float32Array(blocks * 3);
      this.next = new Float32Array(blocks * 3);
      this.lastStep = new Int8Array(blocks);
      this.steps = new Uint8Array(blocks);
      this.changedAt = new Float64Array(blocks).fill(-Infinity);
      this.primed = false;
    }
    const { cols, rows, next } = this;
    next.fill(0);
    for (let row = 0; row < rows; row++)
      for (let y = row * BLOCK; y < (row + 1) * BLOCK; y++) {
        let p = y * width * 4;
        for (let col = 0; col < cols; col++) {
          const at = (row * cols + col) * 3;
          let r = 0,
            g = 0,
            b = 0;
          for (let x = 0; x < BLOCK; x++, p += 4) {
            r += rgba[p]!;
            g += rgba[p + 1]!;
            b += rgba[p + 2]!;
          }
          next[at] = next[at]! + r;
          next[at + 1] = next[at + 1]! + g;
          next[at + 2] = next[at + 2]! + b;
        }
      }
    const area = BLOCK * BLOCK,
      quiet = 0.2 * this.delta;
    const { means, lastStep, steps, changedAt } = this;
    let hits = 0;
    for (let i = 0, at = 0; i < cols * rows; i++, at += 3) {
      const r = next[at]! / area,
        g = next[at + 1]! / area,
        b = next[at + 2]! / area;
      if (this.primed) {
        const dr = r - means[at]!,
          dg = g - means[at + 1]!,
          db = b - means[at + 2]!;
        if (Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)) >= quiet) {
          const apart = timeMs - changedAt[i]! >= MIN_GAP_MS;
          const step = apart ? stepOf(dr, dg, db, this.delta) : 0;
          const before = lastStep[i]!;
          if (step === 0) steps[i] = 0;
          else {
            // In order, within one set: 1, 2, 3, 1 or -1, -2, -3, -1.
            const inOrder =
              before !== 0 &&
              Math.sign(before) === Math.sign(step) &&
              Math.abs(step) === (Math.abs(before) % 3) + 1;
            steps[i] = inOrder ? Math.min(steps[i]! + 1, STEPS_NEEDED) : 1;
          }
          lastStep[i] = step;
          changedAt[i] = timeMs;
        }
      }
      means[at] = r;
      means[at + 1] = g;
      means[at + 2] = b;
      if (steps[i] === STEPS_NEEDED) hits++;
    }
    this.primed = true;
    return hits >= this.minBlocks;
  }
}

export interface MarkerProbe {
  result: Promise<MarkerResult>;
  /** The host painted the marker on a visible page. Without this, "not found" proves nothing. */
  shown(): void;
  cancel(): void;
}
export interface MarkerTiming {
  /** With no confirmation from the host by then, the answer is "unknown". */
  maxMs: number;
  /** Not found this long after the host's confirmation means "no". */
  afterShownMs: number;
}
/** `afterShownMs` leaves room for two full turns of the tints (750 ms each). */
export const MARKER_TIMING: MarkerTiming = { maxMs: 4000, afterShownMs: 2000 };

/**
 * The verdict logic, apart from the frame reading so it can be tested with plain timers:
 * - "yes": the marker was seen in a frame;
 * - "no": the host confirmed the marker, frames were read, and it was not seen in time;
 * - "unknown": anything else (no host, a hidden host, no frames, cancelled).
 */
export function createMarkerVerdict(
  timing: MarkerTiming = MARKER_TIMING,
  onDone: () => void = () => undefined,
) {
  let settle: (result: MarkerResult) => void = () => undefined;
  let done = false,
    frames = 0;
  const result = new Promise<MarkerResult>((resolve) => (settle = resolve));
  const finish = (value: MarkerResult) => {
    if (done) return;
    done = true;
    clearTimeout(cap);
    clearTimeout(afterShown);
    onDone();
    settle(value);
  };
  const cap = setTimeout(() => finish("unknown"), timing.maxMs);
  let afterShown: ReturnType<typeof setTimeout> | undefined;
  return {
    result,
    isDone: () => done,
    /** A frame was scanned; `found` is the scanner's answer for it. */
    frame(found: boolean) {
      frames++;
      if (found) finish("yes");
    },
    shown() {
      if (done || afterShown !== undefined) return;
      afterShown = setTimeout(
        // The capture must be alive. A still surface sends no new frames, and that is fine:
        // a surface holding the cycling marker would not be still.
        () => finish(frames > 0 ? "no" : "unknown"),
        timing.afterShownMs,
      );
    },
    cancel: () => finish("unknown"),
  };
}

/** Reads a copy of the display track until the marker is seen or the verdict times out. */
export function probeMarker(
  display: MediaStreamTrack,
  box: BreakoutBox = breakoutBox(),
  timing: MarkerTiming = MARKER_TIMING,
): MarkerProbe {
  const track = display.clone();
  const reader = new box.MediaStreamTrackProcessor({
    track,
  }).readable.getReader();
  const verdict = createMarkerVerdict(timing, () => {
    void reader.cancel().catch(() => undefined);
    track.stop();
  });
  const scanner = new MarkerScanner();
  let canvas: OffscreenCanvas | null = null,
    context: OffscreenCanvasRenderingContext2D | null = null;
  void (async () => {
    while (!verdict.isDone()) {
      const { value: frame, done } = await reader.read();
      if (done) break;
      try {
        if (verdict.isDone()) break;
        const w = frame.displayWidth,
          h = frame.displayHeight;
        if (!canvas || canvas.width !== w || canvas.height !== h) {
          canvas = new OffscreenCanvas(w, h);
          context = canvas.getContext("2d", { willReadFrequently: true });
        }
        if (!context) break;
        context.drawImage(frame, 0, 0, w, h);
        // The frame's own time (microseconds) when it has one: steps are judged by their spacing.
        const at = Number.isFinite(frame.timestamp)
          ? frame.timestamp / 1000
          : performance.now();
        verdict.frame(
          scanner.push(context.getImageData(0, 0, w, h).data, w, h, at),
        );
      } finally {
        frame.close();
      }
    }
  })()
    .catch(() => undefined)
    // A capture that ended or could not be read proves nothing.
    .finally(() => verdict.cancel());
  return { result: verdict.result, shown: verdict.shown, cancel: verdict.cancel };
}
