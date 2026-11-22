import type { BubbleCorner, BubbleSize, NormalizedRect } from "./protocol";

export interface Point {
  x: number;
  y: number;
}
export interface Box extends Point {
  w: number;
  h: number;
}
export interface Viewport {
  w: number;
  h: number;
}
/** On-screen bubble diameters in CSS pixels. */
export const BUBBLE_PX: Record<BubbleSize, number> = {
  sm: 120,
  md: 168,
  lg: 232,
};
export const EDGE = 12;
/** The smallest area worth recording, in CSS pixels. */
export const MIN_AREA = { w: 160, h: 90 };

/** Keep a box fully inside the viewport, with a small margin. */
export function clampBox(box: Box, viewport: Viewport, margin = EDGE): Point {
  const maxX = Math.max(margin, viewport.w - box.w - margin),
    maxY = Math.max(margin, viewport.h - box.h - margin);
  return {
    x: Math.round(Math.min(maxX, Math.max(margin, box.x))),
    y: Math.round(Math.min(maxY, Math.max(margin, box.y))),
  };
}
/** The drag grip beside the bar frame, in CSS pixels. */
export const BAR_GRIP = 14;
/** The bar frame's size. `rest` and `full` are its width without and with its hover controls. */
export interface BarSize {
  w: number;
  h: number;
  rest: number;
  full: number;
}
/**
 * Where the bar goes: where the user dragged it, else bottom-center.
 *
 * Its left edge must not depend on whether the hover controls are open, or the buttons slide
 * from under the pointer. So it is centered on the resting width, and kept inside the viewport
 * at the full width: opening the controls only ever adds to the right.
 */
export function barBox(
  point: Point | null,
  size: BarSize,
  viewport: Viewport,
): Point {
  const start = point ?? {
    x: (viewport.w - size.rest - BAR_GRIP) / 2,
    y: viewport.h - size.h - 24,
  };
  return clampBox(
    { ...start, w: Math.max(size.w, size.full) + BAR_GRIP, h: size.h },
    viewport,
  );
}
/**
 * The bar's width with its hover-only controls closed (`rest`) and open (`full`), from what the
 * bar frame can measure: its own width `w`, the control row, the widest line under the row, and
 * how many controls of `unit` width (gap included) are open and closed right now.
 */
export function revealWidths(measured: {
  w: number;
  row: number;
  below: number;
  open: number;
  closed: number;
  unit: number;
}): Pick<BarSize, "rest" | "full"> {
  const { w, row, below, open, closed, unit } = measured;
  const padding = w - Math.max(row, below);
  return {
    rest: padding + Math.max(row - open * unit, below),
    full: padding + Math.max(row + closed * unit, below),
  };
}
/** The corner whose quadrant holds the box's center. The compositor draws the camera there. */
export function nearestCorner(box: Box, viewport: Viewport): BubbleCorner {
  const cx = box.x + box.w / 2,
    cy = box.y + box.h / 2;
  return `${cy < viewport.h / 2 ? "top" : "bottom"}-${
    cx < viewport.w / 2 ? "left" : "right"
  }` as BubbleCorner;
}
/** Where a bubble starts when there is no saved position: the bottom-right corner. */
export function defaultBubble(size: BubbleSize, viewport: Viewport): Point {
  const d = BUBBLE_PX[size];
  return clampBox(
    { x: viewport.w - d - 24, y: viewport.h - d - 120, w: d, h: d },
    viewport,
  );
}
/** A drag from `a` to `b` as a box, clipped to the viewport. */
export function selectionBox(a: Point, b: Point, viewport: Viewport): Box {
  const x1 = Math.max(0, Math.min(a.x, b.x)),
    y1 = Math.max(0, Math.min(a.y, b.y)),
    x2 = Math.min(viewport.w, Math.max(a.x, b.x)),
    y2 = Math.min(viewport.h, Math.max(a.y, b.y));
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}
export function isUsableArea(box: Box) {
  return box.w >= MIN_AREA.w && box.h >= MIN_AREA.h;
}
/**
 * The selection normalized to the viewport. A `tabCapture` frame is the tab's viewport at the
 * device pixel ratio, so the same fractions crop it exactly at any zoom or DPR.
 */
export function normalizeSelection(
  box: Box,
  viewport: Viewport,
): NormalizedRect {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const x = clamp(box.x / viewport.w),
    y = clamp(box.y / viewport.h);
  return {
    x,
    y,
    w: Math.min(1 - x, clamp(box.w / viewport.w)),
    h: Math.min(1 - y, clamp(box.h / viewport.h)),
  };
}

// ---- Camera settings (the cog on the bubble and its panel).

/** The four shapes offered for the camera, from a square (0) to a circle (1). */
export const SHAPES = [
  { id: "square", roundness: 0 },
  { id: "rounded", roundness: 0.35 },
  { id: "soft", roundness: 0.7 },
  { id: "circle", roundness: 1 },
] as const;
export type ShapeId = (typeof SHAPES)[number]["id"];
/** The preset closest to a stored roundness (older builds saved any value from a slider). */
export function nearestShape(roundness: number): ShapeId {
  let best: (typeof SHAPES)[number] = SHAPES[SHAPES.length - 1]!;
  for (const shape of SHAPES)
    if (
      Math.abs(shape.roundness - roundness) <
      Math.abs(best.roundness - roundness)
    )
      best = shape;
  return best.id;
}
/** Camera zoom: 1 shows the whole centered square, 2.5 a 40% crop of it. */
export const ZOOM_RANGE = { min: 1, max: 2.5, step: 0.1 } as const;
/** Zoom moves in 0.05 steps and stays within ZOOM_RANGE. */
export function clampZoom(
  zoom: number,
  min: number = ZOOM_RANGE.min,
  max: number = ZOOM_RANGE.max,
): number {
  if (!Number.isFinite(zoom)) return min;
  return Math.round(Math.min(max, Math.max(min, zoom)) * 20) / 20;
}
/** "1.0×", "1.3×", "1.25×": always one decimal, two when the step needs it. */
export function formatZoom(zoom: number): string {
  const rounded = Math.round(zoom * 100) / 100;
  return `${rounded.toFixed(Math.round(rounded * 10) === rounded * 10 ? 1 : 2)}×`;
}
/**
 * The cog's center, relative to the bubble's top-left: on the shape's edge at 45 degrees, so it
 * hugs a circle and sits on the corner of a square.
 */
export function cogCenter(d: number, roundness: number): Point {
  const r = (Math.min(1, Math.max(0, roundness)) * d) / 2;
  const inset = r * (1 - Math.SQRT1_2);
  return { x: d - inset, y: inset };
}
/**
 * The settings panel goes beside the bubble, on the side with more room, top-aligned with it,
 * and never off screen.
 */
export function panelBox(
  bubble: Box,
  panel: Viewport,
  viewport: Viewport,
  gap = 14,
): Point {
  const roomLeft = bubble.x,
    roomRight = viewport.w - bubble.x - bubble.w;
  const x =
    roomRight >= panel.w + gap || roomRight >= roomLeft
      ? bubble.x + bubble.w + gap
      : bubble.x - panel.w - gap;
  return clampBox({ x, y: bubble.y, w: panel.w, h: panel.h }, viewport);
}

// ---- Area selection editor.

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const HANDLES: readonly Handle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];
/** Aspect presets for the area. `null` is free-form. */
export const RATIOS = [
  { id: "free", label: "Free", value: null },
  { id: "16:9", label: "16:9", value: 16 / 9 },
  { id: "4:3", label: "4:3", value: 4 / 3 },
  { id: "1:1", label: "1:1", value: 1 },
] as const;
export type RatioId = (typeof RATIOS)[number]["id"];
export const ratioValue = (id: RatioId): number | null =>
  RATIOS.find((ratio) => ratio.id === id)?.value ?? null;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
const round = (box: Box): Box => ({
  x: Math.round(box.x),
  y: Math.round(box.y),
  w: Math.round(box.w),
  h: Math.round(box.h),
});

/** Drag the whole selection, kept inside the viewport. */
export function moveBox(
  box: Box,
  dx: number,
  dy: number,
  viewport: Viewport,
): Box {
  return round({
    ...box,
    x: clamp(box.x + dx, 0, Math.max(0, viewport.w - box.w)),
    y: clamp(box.y + dy, 0, Math.max(0, viewport.h - box.h)),
  });
}

/**
 * Resize from a handle: the opposite edge or corner stays put and the box never drops below
 * MIN_AREA. With a ratio, a corner follows the pointer's width; an edge handle keeps the box
 * centered on the other axis. The result always fits the viewport.
 */
export function resizeBox(
  start: Box,
  handle: Handle,
  pointer: Point,
  viewport: Viewport,
  ratio: number | null,
): Box {
  const left = handle.includes("w"),
    right = handle.includes("e"),
    top = handle.includes("n"),
    bottom = handle.includes("s");
  const px = clamp(pointer.x, 0, viewport.w),
    py = clamp(pointer.y, 0, viewport.h);
  let x1 = start.x,
    y1 = start.y,
    x2 = start.x + start.w,
    y2 = start.y + start.h;
  if (left) x1 = Math.min(px, x2 - MIN_AREA.w);
  if (right) x2 = Math.max(px, x1 + MIN_AREA.w);
  if (top) y1 = Math.min(py, y2 - MIN_AREA.h);
  if (bottom) y2 = Math.max(py, y1 + MIN_AREA.h);
  if (!ratio) {
    x1 = Math.max(0, x1);
    y1 = Math.max(0, y1);
    x2 = Math.min(viewport.w, x2);
    y2 = Math.min(viewport.h, y2);
    return round({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  }
  // Ratio-locked: one axis leads, the other follows.
  let w = x2 - x1,
    h = y2 - y1;
  if (handle === "n" || handle === "s") w = h * ratio;
  else h = w / ratio;
  if (w < MIN_AREA.w) [w, h] = [MIN_AREA.w, MIN_AREA.w / ratio];
  if (h < MIN_AREA.h) [w, h] = [MIN_AREA.h * ratio, MIN_AREA.h];
  // Anchor: the fixed corner or edge, or the start's center on a free axis.
  const ax = left ? start.x + start.w : right ? start.x : start.x + start.w / 2;
  const ay = top ? start.y + start.h : bottom ? start.y : start.y + start.h / 2;
  const maxW = left
    ? ax
    : right
      ? viewport.w - ax
      : 2 * Math.min(ax, viewport.w - ax);
  const maxH = top
    ? ay
    : bottom
      ? viewport.h - ay
      : 2 * Math.min(ay, viewport.h - ay);
  const scale = Math.min(1, maxW / w, maxH / h);
  w *= scale;
  h *= scale;
  return round({
    x: left ? ax - w : right ? ax : ax - w / 2,
    y: top ? ay - h : bottom ? ay : ay - h / 2,
    w,
    h,
  });
}

/** Apply an aspect ratio around the selection's center, keeping about the same area. */
export function fitRatio(
  box: Box,
  ratio: number,
  viewport: Viewport,
  margin = EDGE,
): Box {
  const size = Math.sqrt(Math.max(1, box.w * box.h));
  let w = size * Math.sqrt(ratio),
    h = size / Math.sqrt(ratio);
  const scale = Math.min(
    1,
    (viewport.w - 2 * margin) / w,
    (viewport.h - 2 * margin) / h,
  );
  w *= scale;
  h *= scale;
  const cx = box.x + box.w / 2,
    cy = box.y + box.h / 2;
  return moveBox(round({ x: cx - w / 2, y: cy - h / 2, w, h }), 0, 0, viewport);
}

/** The selection as viewport pixels (the reverse of `normalizeSelection`). */
export function denormalize(rect: NormalizedRect, viewport: Viewport): Box {
  return round({
    x: rect.x * viewport.w,
    y: rect.y * viewport.h,
    w: rect.w * viewport.w,
    h: rect.h * viewport.h,
  });
}

/** The area toolbar: centered under the selection, else above it, else inside its bottom. */
export function areaToolbarBox(
  sel: Box,
  bar: Viewport,
  viewport: Viewport,
  gap = 12,
): Point {
  const x = clamp(
    sel.x + sel.w / 2 - bar.w / 2,
    8,
    Math.max(8, viewport.w - bar.w - 8),
  );
  const below = sel.y + sel.h + gap;
  if (below + bar.h <= viewport.h - 8)
    return { x: Math.round(x), y: Math.round(below) };
  const above = sel.y - gap - bar.h;
  if (above >= 8) return { x: Math.round(x), y: Math.round(above) };
  return { x: Math.round(x), y: Math.round(sel.y + sel.h - bar.h - gap) };
}

/**
 * Where the camera goes when an area is recorded: where the user left it, pulled just far
 * enough to sit inside the area (and smaller only if it would not fit).
 */
export function keepBubbleInArea(
  current: Point,
  size: BubbleSize,
  sel: Box,
): { size: BubbleSize; point: Point } {
  const fits = (s: BubbleSize) =>
    BUBBLE_PX[s] + 2 * EDGE <= Math.min(sel.w, sel.h);
  const next: BubbleSize = fits(size)
    ? size
    : size === "lg" && fits("md")
      ? "md"
      : "sm";
  const d = BUBBLE_PX[next];
  return {
    size: next,
    point: {
      x: Math.round(
        clamp(
          current.x,
          sel.x + EDGE,
          Math.max(sel.x + EDGE, sel.x + sel.w - d - EDGE),
        ),
      ),
      y: Math.round(
        clamp(
          current.y,
          sel.y + EDGE,
          Math.max(sel.y + EDGE, sel.y + sel.h - d - EDGE),
        ),
      ),
    },
  };
}

/** Drawing a new selection from an anchor; with a ratio the larger drag axis leads. */
export function drawBox(
  anchor: Point,
  pointer: Point,
  viewport: Viewport,
  ratio: number | null,
): Box {
  if (!ratio) return round(selectionBox(anchor, pointer, viewport));
  const dx = pointer.x - anchor.x,
    dy = pointer.y - anchor.y;
  let w = Math.max(Math.abs(dx), Math.abs(dy) * ratio),
    h = w / ratio;
  const maxW = dx < 0 ? anchor.x : viewport.w - anchor.x,
    maxH = dy < 0 ? anchor.y : viewport.h - anchor.y;
  const scale = Math.min(1, maxW / Math.max(w, 1), maxH / Math.max(h, 1));
  w *= scale;
  h *= scale;
  return round({
    x: dx < 0 ? anchor.x - w : anchor.x,
    y: dy < 0 ? anchor.y - h : anchor.y,
    w,
    h,
  });
}
