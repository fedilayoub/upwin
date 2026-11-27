import { BUBBLE_PX } from "../host-layout";
import type {
  BubbleCorner,
  BubbleSize,
  NormalizedRect,
  RecordingSettings,
} from "../protocol";
export interface Size {
  w: number;
  h: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}
export function sourceRect(src: Size, crop: NormalizedRect | null): Rect {
  return crop
    ? {
        x: crop.x * src.w,
        y: crop.y * src.h,
        w: crop.w * src.w,
        h: crop.h * src.h,
      }
    : { x: 0, y: 0, ...src };
}
export function outputSize(src: Size, crop: NormalizedRect | null): Size {
  const rect = sourceRect(src, crop);
  if (rect.w < 320 || rect.h < 180) throw new Error("AREA_TOO_SMALL");
  const scale = Math.min(1, 1920 / rect.w, 1080 / rect.h);
  return {
    w: Math.floor((rect.w * scale) / 2) * 2,
    h: Math.floor((rect.h * scale) / 2) * 2,
  };
}
export function fitContain(src: Size, out: Size): Rect {
  const scale = Math.min(out.w / src.w, out.h / src.h);
  const w = src.w * scale,
    h = src.h * scale;
  return { x: (out.w - w) / 2, y: (out.h - h) / 2, w, h };
}
export type PageGeometry = NonNullable<RecordingSettings["pageGeometry"]>;
/**
 * How many captured-frame pixels one CSS pixel of the host page covers.
 *
 * The frame's own width is the measure, never the device pixel ratio: a picked source arrives
 * already scaled (getDisplayMedia is capped at 1920×1080, so a 3024-pixel Retina screen comes in
 * at about 1662). What the frame spans depends on the surface:
 * - a tab (one-click `tabCapture`, or a tab from the picker): the viewport, in CSS pixels;
 * - a window: the browser window, `outerWidth` in DIPs;
 * - a monitor: the screen, `screen.width` in DIPs.
 * The tab's zoom turns the page's CSS pixels into DIPs.
 */
export function framePxPerCss(
  surface: string | undefined,
  frameW: number,
  page: PageGeometry,
): number {
  if (surface === "monitor") return (frameW / page.screenW) * page.zoom;
  if (surface === "window") return (frameW / page.outerW) * page.zoom;
  return frameW / page.innerW;
}
/** The camera as a share of the output's shorter edge, when the page's scale is unknown. */
const BUBBLE_SHARE: Record<BubbleSize, number> = { sm: 0.18, md: 0.24, lg: 0.32 };
/**
 * The compositor's camera.
 *
 * `pagePx` is how many output pixels one CSS pixel of the host page covers. With it, the camera
 * is the page bubble's own size, so the video shows the same camera size whether the page bubble
 * or the compositor draws it (a screen capture switches to the compositor when the host tab is
 * hidden). Without it, the camera is a share of the output's shorter edge.
 */
export function bubbleRect(
  out: Size,
  corner: BubbleCorner,
  size: BubbleSize,
  pagePx: number | null = null,
): Rect {
  const edge = Math.min(out.w, out.h),
    m = edge * 0.03,
    d =
      pagePx && pagePx > 0
        ? Math.min(edge - 2 * m, BUBBLE_PX[size] * pagePx)
        : edge * BUBBLE_SHARE[size];
  return {
    x: corner.endsWith("left") ? m : Math.max(0, out.w - m - d),
    y: corner.startsWith("top") ? m : Math.max(0, out.h - m - d),
    w: d,
    h: d,
  };
}
/** Corner radius for a square camera of side `d`: 0 is square, 1 a circle. */
export function bubbleRadius(d: number, roundness: number) {
  return (Math.min(1, Math.max(0, roundness)) * d) / 2;
}
/** The centered square of the camera frame, narrowed by `zoom` (1 = the whole square). */
export function cameraSquare(cam: Size, zoom = 1): Rect {
  const d = Math.min(cam.w, cam.h) / Math.min(4, Math.max(1, zoom));
  return { x: (cam.w - d) / 2, y: (cam.h - d) / 2, w: d, h: d };
}
