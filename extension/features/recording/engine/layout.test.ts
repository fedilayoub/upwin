import { describe, expect, it } from "vitest";
import {
  outputSize,
  sourceRect,
  fitContain,
  bubbleRect,
  cameraSquare,
  framePxPerCss,
} from "./layout";
describe("fixed recording layout", () => {
  it("fits 4K and rounds odd dimensions without upscaling", () => {
    expect(outputSize({ w: 3840, h: 2160 }, null)).toEqual({
      w: 1920,
      h: 1080,
    });
    expect(outputSize({ w: 641, h: 481 }, null)).toEqual({ w: 640, h: 480 });
  });
  it("crops at source edges and rejects a tiny crop", () => {
    expect(
      sourceRect({ w: 1920, h: 1080 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }),
    ).toEqual({ x: 960, y: 540, w: 960, h: 540 });
    expect(() =>
      outputSize({ w: 1920, h: 1080 }, { x: 0, y: 0, w: 0.01, h: 0.01 }),
    ).toThrow("AREA_TOO_SMALL");
  });
  it("letterboxes an aspect change", () => {
    expect(fitContain({ w: 1000, h: 1000 }, { w: 1920, h: 1080 })).toEqual({
      x: 420,
      y: 0,
      w: 1080,
      h: 1080,
    });
    expect(cameraSquare({ w: 640, h: 480 })).toEqual({
      x: 80,
      y: 0,
      w: 480,
      h: 480,
    });
  });
  for (const corner of [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ] as const)
    for (const size of ["sm", "md", "lg"] as const)
      it(`${corner} ${size} stays inside output`, () => {
        const r = bubbleRect({ w: 640, h: 360 }, corner, size);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(640);
        expect(r.y + r.h).toBeLessThanOrEqual(360);
        expect(r.w).toBe(360 * { sm: 0.18, md: 0.24, lg: 0.32 }[size]);
      });
  it("measures the page against the frame, never the device pixel ratio", () => {
    // A 2x MacBook (1512x982 DIPs) picked as a screen arrives capped at 1662x1080.
    const page = { innerW: 1400, outerW: 1512, screenW: 1512, zoom: 1 };
    const perCss = framePxPerCss("monitor", 1662, page);
    expect(perCss).toBeCloseTo(1662 / 1512, 6);
    // The page bubble (sm, 120 CSS px) and the compositor's camera are the same size.
    expect(bubbleRect({ w: 1662, h: 1080 }, "bottom-right", "sm", perCss).w).toBeCloseTo(
      120 * (1662 / 1512),
      6,
    );
    // A zoomed page draws a bigger bubble, and so does the compositor.
    expect(framePxPerCss("monitor", 1662, { ...page, zoom: 1.25 })).toBeCloseTo(
      1.25 * (1662 / 1512),
      6,
    );
    // A window spans the browser window; a tab spans the viewport, zoom included.
    expect(framePxPerCss("window", 1512, page)).toBe(1);
    expect(framePxPerCss("browser", 2800, page)).toBe(2);
    expect(framePxPerCss(undefined, 2800, { ...page, zoom: 2 })).toBe(2);
  });
  it("sizes a page-sized camera in output pixels", () => {
    for (const [size, css] of [
      ["sm", 120],
      ["md", 168],
      ["lg", 232],
    ] as const) {
      const r = bubbleRect({ w: 1662, h: 1080 }, "bottom-right", size, 1.1);
      expect(r.w).toBeCloseTo(css * 1.1, 6);
      expect(r.x + r.w).toBeLessThanOrEqual(1662);
      expect(r.y + r.h).toBeLessThanOrEqual(1080);
    }
    expect(bubbleRect({ w: 1280, h: 720 }, "top-left", "sm", 1).w).toBe(120);
  });
  it("keeps a page-sized camera inside a small output", () => {
    const r = bubbleRect({ w: 320, h: 180 }, "bottom-left", "lg", 2);
    expect(r.w).toBeCloseTo(180 * 0.94, 6);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.h).toBeLessThanOrEqual(180);
  });
  it("falls back to a share of the output without a page scale", () => {
    expect(bubbleRect({ w: 1920, h: 1080 }, "top-left", "md", null).w).toBe(
      1080 * 0.24,
    );
    expect(bubbleRect({ w: 1920, h: 1080 }, "top-left", "md", 0).w).toBe(
      1080 * 0.24,
    );
  });
});
