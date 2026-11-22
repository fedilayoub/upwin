import type { RecordingSettings } from "../protocol";
import { RecordingError } from "./host";
interface DisplayOptions extends DisplayMediaStreamOptions {
  selfBrowserSurface: "exclude";
  surfaceSwitching: "include";
  systemAudio: "include" | "exclude";
  monitorTypeSurfaces: "include";
}
/** Chromium's legacy constraint shape for consuming a `tabCapture` stream id. */
interface TabConstraint {
  mandatory: {
    chromeMediaSource: "tab";
    chromeMediaSourceId: string;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    maxFrameRate?: number;
  };
}
/** Even pixel sizes, capped at 4K, keeping the tab's aspect ratio. */
export function tabCaptureSize(size: { w: number; h: number } | null) {
  if (!size) return { w: 1920, h: 1080 };
  const scale = Math.min(1, 3840 / size.w, 2160 / size.h);
  return {
    w: Math.max(2, Math.floor((size.w * scale) / 2) * 2),
    h: Math.max(2, Math.floor((size.h * scale) / 2) * 2),
  };
}
export function tabConstraints(
  streamId: string,
  audio: boolean,
  size: { w: number; h: number } | null = null,
): { video: TabConstraint; audio: TabConstraint | false } {
  // Exactly the tab's own pixels. Asking for more makes Chrome letterbox the frames and render
  // the tab at a capture scale, which also broke clicks in the recorder's frames.
  const { w, h } = tabCaptureSize(size);
  return {
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        minWidth: w,
        minHeight: h,
        maxWidth: w,
        maxHeight: h,
        maxFrameRate: 30,
      },
    },
    audio: audio
      ? {
          mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
        }
      : false,
  };
}
export function displaySurfaceFor(
  mode: RecordingSettings["mode"],
): "monitor" | "window" | "browser" {
  return mode === "screen" ? "monitor" : mode === "window" ? "window" : "browser";
}
export function acquireDisplay(
  settings: RecordingSettings,
): Promise<MediaStream> {
  if (settings.tabStreamId)
    // A stream id is single-use and expires within seconds: acquire it first.
    return navigator.mediaDevices.getUserMedia(
      tabConstraints(
        settings.tabStreamId,
        settings.includeDisplayAudio,
        settings.tabSize,
      ) as unknown as MediaStreamConstraints,
    );
  // An area is a crop of the invoking tab, which only `tabCapture` can identify.
  if (settings.mode === "area")
    return Promise.reject(new RecordingError("TAB_CAPTURE_REQUIRED"));
  const options: DisplayOptions = {
    video: {
      displaySurface: displaySurfaceFor(settings.mode),
      frameRate: { ideal: 30, max: 30 },
      width: { max: 1920 },
      height: { max: 1080 },
    },
    audio: settings.includeDisplayAudio,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: settings.includeDisplayAudio ? "include" : "exclude",
    monitorTypeSurfaces: "include",
  };
  return navigator.mediaDevices.getDisplayMedia(options);
}
export const acquireCamera = (id: string) =>
  navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: id },
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    },
  });
export const acquireMic = (id: string) =>
  navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: id },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
export function releaseAll(...streams: (MediaStream | null | undefined)[]) {
  for (const stream of streams)
    for (const track of stream?.getTracks() ?? []) track.stop();
}
export function sourceKind(
  track: MediaStreamTrack,
  settings: Pick<RecordingSettings, "mode" | "tabStreamId">,
): "screen" | "window" | "tab" | "area" {
  if (settings.mode === "area") return "area";
  if (settings.tabStreamId) return "tab";
  const surface = track.getSettings().displaySurface;
  return surface === "browser"
    ? "tab"
    : surface === "window"
      ? "window"
      : "screen";
}
/**
 * `tabCapture` mutes the captured tab for the user. Play its audio back locally so they still
 * hear the page while it is recorded.
 */
export function playBack(track: MediaStreamTrack | null): () => Promise<void> {
  if (!track) return async () => undefined;
  const context = new AudioContext();
  const source = context.createMediaStreamSource(new MediaStream([track]));
  source.connect(context.destination);
  if (context.state !== "running") void context.resume();
  return async () => {
    source.disconnect();
    await context.close().catch(() => undefined);
  };
}
