import { describe, expect, it } from "vitest";
import {
  BUBBLE_PX,
  clampBox,
  areaToolbarBox,
  barBox,
  keepBubbleInArea,
  clampZoom,
  denormalize,
  drawBox,
  fitRatio,
  moveBox,
  resizeBox,
  revealWidths,
  formatZoom,
  cogCenter,
  nearestShape,
  panelBox,
  defaultBubble,
  isUsableArea,
  nearestCorner,
  normalizeSelection,
  selectionBox,
} from "./host-layout";
import { hostToWorkerSchema, rectSchema } from "./protocol";
import { cameraSquare, outputSize, sourceRect } from "./engine/layout";

const viewport = { w: 1280, h: 800 };
describe("recorder host layout", () => {
  it("keeps dragged boxes inside the viewport", () => {
    expect(clampBox({ x: -50, y: -10, w: 100, h: 100 }, viewport)).toEqual({
      x: 12,
      y: 12,
    });
    expect(clampBox({ x: 5000, y: 5000, w: 100, h: 100 }, viewport)).toEqual({
      x: 1168,
      y: 688,
    });
  });
  it("opens the bar's hover controls without moving what is already there", () => {
    // The compact pill, then the same pill hovered: four 42px controls open on its right.
    const closed = { w: 300, h: 52, rest: 300, full: 468 },
      open = { w: 468, h: 52, rest: 300, full: 468 };
    const centered = barBox(null, closed, viewport);
    expect(centered).toEqual({ x: (1280 - 300 - 14) / 2, y: 800 - 52 - 24 });
    expect(barBox(null, open, viewport)).toEqual(centered);
    // Dragged against the right edge: room for the open pill is kept from the start.
    const dragged = barBox({ x: 5000, y: 100 }, closed, viewport);
    expect(dragged).toEqual({ x: 1280 - 468 - 14 - 12, y: 100 });
    expect(barBox({ x: 5000, y: 100 }, open, viewport)).toEqual(dragged);
    // A bar with no hover controls is centered on its own width, as before.
    expect(
      barBox(null, { w: 560, h: 96, rest: 560, full: 560 }, viewport),
    ).toEqual({ x: (1280 - 560 - 14) / 2, y: 800 - 96 - 24 });
  });
  it("reports the same resting and full widths whether the controls are open or not", () => {
    const base = { below: 0, unit: 42 };
    const expected = { rest: 300, full: 468 };
    expect(
      revealWidths({ ...base, w: 300, row: 280, open: 0, closed: 4 }),
    ).toEqual(expected);
    expect(
      revealWidths({ ...base, w: 468, row: 448, open: 4, closed: 0 }),
    ).toEqual(expected);
    // Muted: the mic control is out for good, so it belongs to the resting width.
    expect(
      revealWidths({ ...base, w: 342, row: 322, open: 0, closed: 3 }),
    ).toEqual({ rest: 342, full: 468 });
    // A warning line wider than the row sets the width in both states.
    expect(
      revealWidths({ w: 420, row: 280, below: 400, open: 0, closed: 4, unit: 42 }),
    ).toEqual({ rest: 420, full: 468 });
    expect(
      revealWidths({ w: 468, row: 448, below: 400, open: 4, closed: 0, unit: 42 }),
    ).toEqual({ rest: 420, full: 468 });
  });
  it("maps a bubble to the corner of its quadrant", () => {
    expect(nearestCorner({ x: 10, y: 10, w: 100, h: 100 }, viewport)).toBe(
      "top-left",
    );
    expect(nearestCorner({ x: 1100, y: 650, w: 100, h: 100 }, viewport)).toBe(
      "bottom-right",
    );
    expect(nearestCorner({ x: 1100, y: 10, w: 100, h: 100 }, viewport)).toBe(
      "top-right",
    );
  });
  it("places a new bubble bottom-right, above the bar", () => {
    const point = defaultBubble("md", viewport);
    expect(point.x + BUBBLE_PX.md).toBeLessThanOrEqual(viewport.w);
    expect(nearestCorner({ ...point, w: 168, h: 168 }, viewport)).toBe(
      "bottom-right",
    );
  });
  it("normalizes a drag in any direction, clipped to the viewport", () => {
    const box = selectionBox({ x: 900, y: 500 }, { x: 100, y: -40 }, viewport);
    expect(box).toEqual({ x: 100, y: 0, w: 800, h: 500 });
    expect(isUsableArea(box)).toBe(true);
    expect(isUsableArea({ x: 0, y: 0, w: 100, h: 400 })).toBe(false);
    const rect = normalizeSelection(box, viewport);
    expect(rectSchema.safeParse(rect).success).toBe(true);
    expect(rect).toEqual({ x: 0.078125, y: 0, w: 0.625, h: 0.625 });
  });
  it.each([1, 1.25, 2])(
    "crops the same region of a tab frame at device pixel ratio %s",
    (dpr) => {
      const rect = normalizeSelection(
        { x: 320, y: 200, w: 640, h: 400 },
        viewport,
      );
      const frame = { w: viewport.w * dpr, h: viewport.h * dpr };
      expect(sourceRect(frame, rect)).toEqual({
        x: 320 * dpr,
        y: 200 * dpr,
        w: 640 * dpr,
        h: 400 * dpr,
      });
      const out = outputSize(frame, rect);
      expect(out.w % 2).toBe(0);
      expect(out.w / out.h).toBeCloseTo(640 / 400, 1);
    },
  );
});
describe("camera roundness", () => {
  it("maps 0 to a square and 1 to a circle, clamped", async () => {
    const { bubbleRadius } = await import("./engine/layout");
    expect(bubbleRadius(200, 0)).toBe(0);
    expect(bubbleRadius(200, 1)).toBe(100);
    expect(bubbleRadius(200, 0.5)).toBe(50);
    expect(bubbleRadius(200, 3)).toBe(100);
    expect(bubbleRadius(200, -1)).toBe(0);
  });
  it("accepts roundness from the host and rejects values outside 0..1", async () => {
    const { hostToWorkerSchema } = await import("./protocol");
    const bubble = { type: "bubble", corner: "top-left", size: "md" };
    expect(
      hostToWorkerSchema.safeParse({ ...bubble, roundness: 0.25 }).success,
    ).toBe(true);
    expect(
      hostToWorkerSchema.safeParse({ ...bubble, roundness: 1.5 }).success,
    ).toBe(false);
  });
});
describe("camera settings", () => {
  it("snaps a stored roundness to the nearest shape", () => {
    expect(nearestShape(0)).toBe("square");
    expect(nearestShape(0.3)).toBe("rounded");
    expect(nearestShape(0.62)).toBe("soft");
    expect(nearestShape(0.95)).toBe("circle");
  });
  it("keeps zoom in range, to a 0.05 step", () => {
    expect(clampZoom(0.4)).toBe(1);
    expect(clampZoom(1.234)).toBe(1.25);
    expect(clampZoom(9)).toBe(2.5);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect([1, 1.3, 1.25, 2.5].map(formatZoom)).toEqual([
      "1.0×",
      "1.3×",
      "1.25×",
      "2.5×",
    ]);
  });
  it("puts the cog on the shape's edge at 45 degrees", () => {
    expect(cogCenter(168, 0)).toEqual({ x: 168, y: 0 });
    const circle = cogCenter(168, 1);
    // On the circle: its distance from the center is the radius.
    expect(Math.hypot(circle.x - 84, circle.y - 84)).toBeCloseTo(84, 5);
  });
  it("opens the panel on the side with room, inside the viewport", () => {
    const panel = { w: 248, h: 300 };
    expect(
      panelBox({ x: 1080, y: 600, w: 168, h: 168 }, panel, viewport),
    ).toEqual({
      x: 1080 - 248 - 14,
      y: 800 - 300 - 12,
    });
    expect(panelBox({ x: 40, y: 40, w: 168, h: 168 }, panel, viewport).x).toBe(
      40 + 168 + 14,
    );
  });
  it("crops the camera square by the zoom, centered", () => {
    expect(cameraSquare({ w: 640, h: 480 }, 2)).toEqual({
      x: 200,
      y: 120,
      w: 240,
      h: 240,
    });
    expect(cameraSquare({ w: 640, h: 480 }, 1)).toEqual({
      x: 80,
      y: 0,
      w: 480,
      h: 480,
    });
  });
  it("accepts a zoom from the host and defaults it for older hosts", () => {
    const bubble = {
      type: "bubble",
      corner: "top-left",
      size: "md",
      roundness: 1,
    };
    const parsed = hostToWorkerSchema.parse(bubble);
    expect(parsed.type === "bubble" && parsed.zoom).toBe(1);
    expect(hostToWorkerSchema.safeParse({ ...bubble, zoom: 2 }).success).toBe(
      true,
    );
    expect(hostToWorkerSchema.safeParse({ ...bubble, zoom: 4 }).success).toBe(
      false,
    );
  });
});
describe("area editor", () => {
  const vp = { w: 1280, h: 800 };
  const sel = { x: 200, y: 100, w: 640, h: 360 };
  it("moves the selection, never off screen", () => {
    expect(moveBox(sel, 50, 20, vp)).toEqual({ ...sel, x: 250, y: 120 });
    expect(moveBox(sel, 5000, -5000, vp)).toEqual({ ...sel, x: 640, y: 0 });
  });
  it("resizes free-form from any handle, keeping the opposite side and a minimum size", () => {
    expect(resizeBox(sel, "se", { x: 1000, y: 600 }, vp, null)).toEqual({
      x: 200,
      y: 100,
      w: 800,
      h: 500,
    });
    expect(resizeBox(sel, "w", { x: 100, y: 0 }, vp, null)).toEqual({
      x: 100,
      y: 100,
      w: 740,
      h: 360,
    });
    // Past the opposite edge: stops at the minimum instead of flipping.
    expect(resizeBox(sel, "e", { x: 0, y: 0 }, vp, null).w).toBe(160);
    expect(resizeBox(sel, "se", { x: 9999, y: 9999 }, vp, null)).toEqual({
      x: 200,
      y: 100,
      w: 1080,
      h: 700,
    });
  });
  it("keeps a locked ratio while resizing, inside the viewport", () => {
    const r = resizeBox(sel, "se", { x: 1040, y: 0 }, vp, 16 / 9);
    expect(r.x).toBe(200);
    expect(r.w / r.h).toBeCloseTo(16 / 9, 1);
    const huge = resizeBox(sel, "se", { x: 99999, y: 0 }, vp, 16 / 9);
    expect(huge.x + huge.w).toBeLessThanOrEqual(1280);
    expect(huge.y + huge.h).toBeLessThanOrEqual(800);
    const edge = resizeBox(sel, "s", { x: 0, y: 600 }, vp, 1);
    expect(edge.w).toBe(edge.h);
    expect(edge.x + edge.w / 2).toBeCloseTo(520, 0);
  });
  it("draws free-form, or with a locked ratio in any direction", () => {
    expect(drawBox({ x: 100, y: 100 }, { x: 50, y: 300 }, vp, null)).toEqual({
      x: 50,
      y: 100,
      w: 50,
      h: 200,
    });
    const r = drawBox({ x: 600, y: 400 }, { x: 300, y: 380 }, vp, 16 / 9);
    expect(r.x + r.w).toBe(600);
    expect(r.w / r.h).toBeCloseTo(16 / 9, 1);
    const clamped = drawBox({ x: 1200, y: 700 }, { x: 1279, y: 799 }, vp, 1);
    expect(clamped.x + clamped.w).toBeLessThanOrEqual(1280);
    expect(clamped.y + clamped.h).toBeLessThanOrEqual(800);
  });
  it("applies a ratio around the center", () => {
    const square = fitRatio(sel, 1, vp);
    expect(square.w).toBe(square.h);
    expect(square.x + square.w / 2).toBeCloseTo(520, 0);
    expect(square.y + square.h / 2).toBeCloseTo(280, 0);
  });
  it("round-trips a normalized selection", () => {
    expect(denormalize(normalizeSelection(sel, vp), vp)).toEqual(sel);
  });
  it("puts the toolbar under the selection, above it, or inside it", () => {
    const bar = { w: 420, h: 48 };
    expect(areaToolbarBox(sel, bar, vp).y).toBe(472);
    expect(areaToolbarBox({ x: 0, y: 300, w: 1280, h: 480 }, bar, vp).y).toBe(
      240,
    );
    expect(areaToolbarBox({ x: 0, y: 0, w: 1280, h: 800 }, bar, vp).y).toBe(
      740,
    );
  });
  it("keeps the camera where it is, pulled inside the area only as far as needed", () => {
    // Already inside: unchanged.
    expect(keepBubbleInArea({ x: 300, y: 150 }, "md", sel)).toEqual({
      size: "md",
      point: { x: 300, y: 150 },
    });
    // Outside to the right and below: moved to the nearest spot inside.
    expect(keepBubbleInArea({ x: 1100, y: 640 }, "md", sel)).toEqual({
      size: "md",
      point: { x: 200 + 640 - 168 - 12, y: 100 + 360 - 168 - 12 },
    });
    expect(
      keepBubbleInArea({ x: 0, y: 0 }, "lg", { x: 0, y: 0, w: 400, h: 200 })
        .size,
    ).toBe("md");
    expect(
      keepBubbleInArea({ x: 0, y: 0 }, "md", { x: 0, y: 0, w: 300, h: 150 })
        .size,
    ).toBe("sm");
  });
});
