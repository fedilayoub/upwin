import type { BubbleCorner, BubbleSize, NormalizedRect } from "../protocol";
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
export function bubbleRect(
  out: Size,
  corner: BubbleCorner,
  size: BubbleSize,
): Rect {
  const edge = Math.min(out.w, out.h),
    d = edge * { sm: 0.18, md: 0.24, lg: 0.32 }[size],
    m = edge * 0.03;
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
