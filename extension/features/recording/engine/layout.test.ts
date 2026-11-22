import { describe, expect, it } from "vitest";
import {
  outputSize,
  sourceRect,
  fitContain,
  bubbleRect,
  cameraSquare,
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
});
