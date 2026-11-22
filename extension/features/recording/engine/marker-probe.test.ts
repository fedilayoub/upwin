import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkerScanner, createMarkerVerdict } from "./marker-probe";
import { MARKER_ALPHA, MARKER_STEP_MS, MARKER_TINTS } from "./marker-colors";

const W = 160,
  H = 96;
type Rgb = readonly [number, number, number];
type Box = { x: number; y: number; w: number; h: number };
/** Where the host's tint lies in these frames: 12 x 5 whole blocks. */
const PATCH: Box = { x: 32, y: 24, w: 96, h: 40 };
/**
 * A page like any other: pure white, pure black, a dark bar, static red, green and blue
 * areas, and fine detail.
 */
function page(): Rgb[] {
  const pixels: Rgb[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      pixels.push(
        x < 16
          ? [255, 0, 0]
          : x < 32
            ? [0, 255, 0]
            : x < 48
              ? [0, 0, 255]
              : x < 80
                ? [23, 23, 23]
                : x < 104
                  ? [255, 255, 255]
                  : x < 120
                    ? [0, 0, 0]
                    : [(x * 37 + y * 11) % 256, (x * 5 + y * 91) % 256, 128],
      );
  return pixels;
}
type Theme = keyof typeof MARKER_TINTS;
/** The page as the browser paints it with tint number `tint` over `patch` (null: no tint). */
function frame(
  tint: number | null,
  patch: Box = PATCH,
  capture: (pixel: Rgb) => Rgb = (pixel) => pixel,
  theme: Theme = "dark",
) {
  const data = new Uint8ClampedArray(W * H * 4);
  page().forEach((pixel, i) => {
    const x = i % W,
      y = Math.floor(i / W);
    const inside =
      tint !== null &&
      x >= patch.x &&
      x < patch.x + patch.w &&
      y >= patch.y &&
      y < patch.y + patch.h;
    const color = MARKER_TINTS[theme][(tint ?? 0) % 3]!;
    const painted = pixel.map((value, c) =>
      inside
        ? Math.round(value * (1 - MARKER_ALPHA) + color[c]! * MARKER_ALPHA)
        : value,
    ) as unknown as Rgb;
    data.set([...capture(painted), 255], i * 4);
  });
  return data;
}
/**
 * Feeds the scanner what a capture sees: the untinted page, then each tint held for
 * MARKER_STEP_MS, one frame every `every` ms. Returns how many tints were shown when it hit.
 */
function run(
  scanner: MarkerScanner,
  tints: number[],
  options: {
    every?: number;
    patch?: Box;
    capture?: (pixel: Rgb) => Rgb;
    theme?: Theme;
  } = {},
) {
  const every = options.every ?? 33;
  const paint = (tint: number | null) =>
    frame(tint, options.patch, options.capture, options.theme);
  let time = 0;
  scanner.push(paint(null), W, H, time);
  for (const [index, tint] of tints.entries())
    for (let held = 0; held < MARKER_STEP_MS; held += every) {
      time += every;
      const data = paint(tint);
      if (scanner.push(data, W, H, time)) return index + 1;
    }
  return null;
}

describe("the marker scanner", () => {
  it("finds the faint tint once it has made a full turn, over any content", () => {
    // Three tints and back to the first: the three steps. Found on the fourth, not before.
    for (const theme of ["dark", "light"] as const) {
      expect(run(new MarkerScanner(), [0, 1, 2, 0, 1], { theme })).toBe(4);
      expect(run(new MarkerScanner(), [0, 1, 2], { theme })).toBeNull();
    }
  });
  it("does not take steps of the two sets for one turn", () => {
    // Dark step 1, light step 2, dark step 3: in order by number, but not one marker.
    const scanner = new MarkerScanner();
    let time = 0;
    const hold = (theme: Theme, tint: number) => {
      let found = false;
      for (let n = 0; n < 8; n++)
        found =
          scanner.push(frame(tint, PATCH, undefined, theme), W, H, (time += 33)) ||
          found;
      return found;
    };
    scanner.push(frame(null), W, H, 0);
    const seen = [
      hold("dark", 0),
      hold("dark", 1),
      hold("light", 1),
      hold("light", 2),
      hold("dark", 2),
      hold("dark", 0),
    ];
    expect(seen).toEqual([false, false, false, false, false, false]);
  });
  it("picks the turn up at any tint", () => {
    // On some colors the tint's first appearance is already a step: one tint sooner at most.
    for (const tints of [
      [2, 0, 1, 2],
      [1, 2, 0, 1],
    ]) {
      const found = run(new MarkerScanner(), tints);
      expect(found).toBeGreaterThanOrEqual(3);
      expect(found).toBeLessThanOrEqual(4);
    }
  });
  it("ignores a still page, whatever its colors", () => {
    const scanner = new MarkerScanner();
    for (let n = 0; n < 40; n++)
      expect(scanner.push(frame(null), W, H, n * 33)).toBe(false);
  });
  it("ignores tints that step in the wrong order", () => {
    expect(run(new MarkerScanner(), [0, 2, 1, 0, 2, 1, 0])).toBeNull();
  });
  it("ignores a turn broken by another change", () => {
    const scanner = new MarkerScanner();
    expect(run(scanner, [0, 1, 2])).toBeNull();
    // The tint goes away for a while, then one more step: not a full turn.
    for (let n = 0; n < 8; n++) scanner.push(frame(null), W, H, 2000 + n * 33);
    for (let n = 0; n < 8; n++)
      expect(scanner.push(frame(0), W, H, 2300 + n * 33)).toBe(false);
  });
  it("ignores color that changes on every frame, like a rotating hue or a video", () => {
    // The same steps, but one per frame: nothing the host paints moves that fast.
    const scanner = new MarkerScanner();
    scanner.push(frame(null), W, H, 0);
    for (let n = 0; n < 30; n++)
      expect(scanner.push(frame(n % 3), W, H, 33 * (n + 1))).toBe(false);
  });
  it("ignores a patch smaller than the marker can be", () => {
    const small = { x: 32, y: 24, w: 16, h: 16 };
    expect(
      run(new MarkerScanner(), [0, 1, 2, 0, 1, 2], { patch: small }),
    ).toBeNull();
  });
  it("still finds it in a capture running at 5 frames a second", () => {
    expect(run(new MarkerScanner(), [0, 1, 2, 0, 1], { every: 200 })).toBe(4);
  });
  it("still finds it when the capture returns a wide-gamut display's values", () => {
    // sRGB values as a Display P3 screen stores them: the steps shrink and leak into the
    // other channels.
    const p3 = ([r, g, b]: Rgb): Rgb => [
      Math.round(0.8225 * r + 0.1774 * g),
      Math.round(0.0332 * r + 0.9669 * g),
      Math.round(0.0171 * r + 0.0724 * g + 0.9108 * b),
    ];
    for (const theme of ["dark", "light"] as const)
      expect(
        run(new MarkerScanner(), [0, 1, 2, 0, 1], { capture: p3, theme }),
      ).toBe(4);
  });
  it("still finds it after an 8-bit YUV round trip", () => {
    const yuv = ([r, g, b]: Rgb): Rgb => {
      const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b),
        cb = Math.round((b - y) / 1.8556),
        cr = Math.round((r - y) / 1.5748);
      const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)));
      return [
        clamp(y + 1.5748 * cr),
        clamp(y - 0.1873 * cb - 0.4681 * cr),
        clamp(y + 1.8556 * cb),
      ];
    };
    for (const theme of ["dark", "light"] as const)
      expect(
        run(new MarkerScanner(), [0, 1, 2, 0, 1], { capture: yuv, theme }),
      ).toBe(4);
  });
  it("starts over when the frame size changes", () => {
    const scanner = new MarkerScanner();
    expect(run(scanner, [0, 1, 2])).toBeNull();
    scanner.push(new Uint8ClampedArray(64 * 64 * 4).fill(255), 64, 64, 900);
    for (let n = 0; n < 8; n++)
      expect(scanner.push(frame(0), W, H, 1000 + n * 33)).toBe(false);
  });
});

describe("the marker verdict", () => {
  const timing = { maxMs: 4000, afterShownMs: 2000 };
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());
  const settled = async (result: Promise<string>) => {
    let value: string | undefined;
    void result.then((v) => (value = v));
    await vi.advanceTimersByTimeAsync(0);
    return value;
  };

  it("says yes as soon as a frame holds the marker, and stops reading", async () => {
    const stop = vi.fn();
    const verdict = createMarkerVerdict(timing, stop);
    verdict.frame(false);
    expect(await settled(verdict.result)).toBeUndefined();
    verdict.frame(true);
    expect(await settled(verdict.result)).toBe("yes");
    expect(stop).toHaveBeenCalledOnce();
    expect(verdict.isDone()).toBe(true);
  });
  it("says no only after the host confirmed the marker and frames were read", async () => {
    const verdict = createMarkerVerdict(timing);
    verdict.frame(false);
    verdict.shown();
    await vi.advanceTimersByTimeAsync(1999);
    expect(await settled(verdict.result)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled(verdict.result)).toBe("no");
  });
  it("still says yes when the marker turns up after the confirmation", async () => {
    const verdict = createMarkerVerdict(timing);
    verdict.shown();
    await vi.advanceTimersByTimeAsync(800);
    verdict.frame(true);
    expect(await settled(verdict.result)).toBe("yes");
  });
  it("does not know without the host's confirmation", async () => {
    const verdict = createMarkerVerdict(timing);
    verdict.frame(false);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await settled(verdict.result)).toBe("unknown");
  });
  it("does not know when the capture sent no frame at all", async () => {
    const verdict = createMarkerVerdict(timing);
    verdict.shown();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await settled(verdict.result)).toBe("unknown");
  });
  it("does not know when cancelled, and answers only once", async () => {
    const stop = vi.fn();
    const verdict = createMarkerVerdict(timing, stop);
    verdict.cancel();
    verdict.frame(true);
    verdict.shown();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await settled(verdict.result)).toBe("unknown");
    expect(stop).toHaveBeenCalledOnce();
  });
});
