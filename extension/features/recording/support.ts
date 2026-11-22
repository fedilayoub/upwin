import { browser } from "wxt/browser";
import { pickMime } from "./engine/mime";
export function isRecordingSupported(): boolean {
  return (
    import.meta.env.BROWSER !== "firefox" &&
    typeof MediaRecorder !== "undefined" &&
    pickMime((m) => MediaRecorder.isTypeSupported(m), false) !== null &&
    "MediaStreamTrackProcessor" in globalThis &&
    "MediaStreamTrackGenerator" in globalThis &&
    "offscreen" in browser
  );
}
export function isEngineSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    pickMime((m) => MediaRecorder.isTypeSupported(m), false) !== null &&
    "MediaStreamTrackProcessor" in globalThis &&
    "MediaStreamTrackGenerator" in globalThis
  );
}
