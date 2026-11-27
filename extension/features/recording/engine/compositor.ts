import type { LiveUpdate, NormalizedRect } from "../protocol";
import {
  bubbleRadius,
  bubbleRect,
  cameraSquare,
  fitContain,
  framePxPerCss,
  outputSize,
  type PageGeometry,
  sourceRect,
  type Size,
} from "./layout";
export interface BreakoutBox {
  MediaStreamTrackProcessor: new (options: { track: MediaStreamTrack }) => {
    readable: ReadableStream<VideoFrame>;
  };
  MediaStreamTrackGenerator: new (options: {
    kind: "video";
  }) => MediaStreamTrack & { writable: WritableStream<VideoFrame> };
}
export const breakoutBox = () => globalThis as unknown as BreakoutBox;
export interface Composite {
  track: MediaStreamTrack;
  size: Size;
  update(live: Required<LiveUpdate>): void;
  stop(): Promise<void>;
}
export function createCompositor(
  display: MediaStreamTrack,
  camera: MediaStreamTrack | null,
  crop: NormalizedRect | null,
  initial: Required<LiveUpdate>,
  onError: (error: unknown) => void,
  /** Tab capture tracks may report no size; the requested tab size is the source size then. */
  sourceSize: { w: number; h: number } | null = null,
  /** The host page's geometry: the camera then matches the page bubble's size. */
  page: PageGeometry | null = null,
): Composite {
  const { MediaStreamTrackProcessor, MediaStreamTrackGenerator } =
    breakoutBox();
  const settings = display.getSettings(),
    surface = settings.displaySurface,
    size = outputSize(
      {
        w: settings.width ?? sourceSize?.w ?? 1920,
        h: settings.height ?? sourceSize?.h ?? 1080,
      },
      crop,
    );
  const canvas = new OffscreenCanvas(size.w, size.h),
    context = canvas.getContext("2d");
  if (!context) throw new Error("UNSUPPORTED");
  const track = new MediaStreamTrackGenerator({ kind: "video" }),
    writer = track.writable.getWriter();
  const displayReader = new MediaStreamTrackProcessor({
    track: display,
  }).readable.getReader();
  const cameraReader = camera
    ? new MediaStreamTrackProcessor({ track: camera }).readable.getReader()
    : null;
  let latestDisplay: VideoFrame | null = null,
    latestCamera: VideoFrame | null = null,
    live = initial,
    stopped = false,
    drawing = false,
    timestamp = -1;
  let pendingDraw: Promise<void> = Promise.resolve();
  // With `cameraLayer: "page"` the live page bubble is in the captured tab already.
  const drawsCamera = () =>
    !!camera && live.cameraVisible && live.cameraLayer === "composite";
  function draw() {
    if (stopped || drawing || !latestDisplay) return;
    drawing = true;
    pendingDraw = (async () => {
      const src = sourceRect(
          { w: latestDisplay!.displayWidth, h: latestDisplay!.displayHeight },
          crop,
        ),
        dest = fitContain(src, size);
      context!.fillStyle = "#000";
      context!.fillRect(0, 0, size.w, size.h);
      context!.drawImage(
        latestDisplay!,
        src.x,
        src.y,
        src.w,
        src.h,
        dest.x,
        dest.y,
        dest.w,
        dest.h,
      );
      if (drawsCamera() && latestCamera) {
        // Output pixels per CSS pixel of the page: frame pixels per CSS pixel, then scaled to
        // the output like the rest of the frame.
        const pagePx = page
            ? framePxPerCss(surface, latestDisplay!.displayWidth, page) *
              (dest.w / src.w)
            : null,
          bubble = bubbleRect(size, live.bubbleCorner, live.bubbleSize, pagePx),
          square = cameraSquare(
            { w: latestCamera.displayWidth, h: latestCamera.displayHeight },
            live.bubbleZoom,
          );
        context!.save();
        // The same shape as the on-page bubble: square to circle, no border.
        context!.beginPath();
        context!.roundRect(
          bubble.x,
          bubble.y,
          bubble.w,
          bubble.h,
          bubbleRadius(bubble.w, live.bubbleRoundness),
        );
        context!.clip();
        // Mirrored, like the on-page bubble, so the camera looks the same in every mode.
        context!.translate(bubble.x * 2 + bubble.w, 0);
        context!.scale(-1, 1);
        context!.drawImage(
          latestCamera,
          square.x,
          square.y,
          square.w,
          square.h,
          bubble.x,
          bubble.y,
          bubble.w,
          bubble.h,
        );
        context!.restore();
      }
      timestamp = Math.max(
        timestamp + 1,
        latestDisplay!.timestamp ?? Math.round(performance.now() * 1000),
      );
      const frame = new VideoFrame(canvas, { timestamp });
      try {
        await writer.write(frame);
      } finally {
        frame.close();
      }
    })()
      .catch((error) => {
        if (!stopped) onError(error);
      })
      .finally(() => {
        drawing = false;
      });
  }
  async function read(
    reader: ReadableStreamDefaultReader<VideoFrame>,
    kind: "display" | "camera",
  ) {
    try {
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        if (stopped) {
          value.close();
          break;
        }
        if (kind === "display") {
          latestDisplay?.close();
          latestDisplay = value;
          if (!drawsCamera()) draw();
        } else {
          latestCamera?.close();
          latestCamera = value;
          if (drawsCamera()) draw();
        }
      }
    } catch (error: unknown) {
      if (!stopped) onError(error);
    }
  }
  const reads = [
    read(displayReader, "display"),
    ...(cameraReader ? [read(cameraReader, "camera")] : []),
  ];
  return {
    track,
    size,
    update: (update) => {
      live = update;
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await Promise.all([displayReader.cancel(), cameraReader?.cancel()]);
      await Promise.all(reads);
      await pendingDraw;
      latestDisplay?.close();
      latestCamera?.close();
      latestDisplay = latestCamera = null;
      await writer.close().catch(() => undefined);
      track.stop();
    },
  };
}
