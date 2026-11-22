import { parseApiData } from "@/features/recording/client";
import { browser } from "wxt/browser";
import { RecordingEngine } from "@/features/recording/engine/engine";
import { Preview } from "@/features/recording/engine/preview";
import { CameraHub } from "@/features/recording/engine/camera-hub";
import { createBlurEffect } from "@/features/recording/engine/background-blur";
import { acquireCamera } from "@/features/recording/engine/sources";
import {
  initialState,
  offscreenSchema,
  type OffscreenMessage,
} from "@/features/recording/protocol";
import type { EngineHost } from "@/features/recording/engine/host";
import { isEngineSupported } from "@/features/recording/support";
import { RecordingError } from "@/features/recording/engine/host";
import { extensionPagePath } from "@/features/recording/senders";
const send = (message: unknown) => browser.runtime.sendMessage(message);
const broadcast = (message: unknown) => {
  void send(message).catch(() => undefined);
};
const host: EngineHost = {
  now: Date.now,
  async api<T>(
    op: Parameters<EngineHost["api"]>[0],
    payload: unknown,
  ): Promise<T> {
    const requestId = crypto.randomUUID();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const response: unknown = await Promise.race([
        send({
          target: "background",
          type: "engine/api",
          requestId,
          op,
          payload,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new RecordingError("API_TIMEOUT")),
            30_000,
          );
        }),
      ]);
      const parsed = offscreenSchema.safeParse(response);
      if (
        !parsed.success ||
        parsed.data.type !== "api/result" ||
        parsed.data.requestId !== requestId
      )
        throw new RecordingError("INVALID_API_RESULT");
      if (!parsed.data.ok)
        throw new RecordingError(parsed.data.error?.code ?? "UNKNOWN");
      return parseApiData(op, parsed.data.data) as T;
    } finally {
      clearTimeout(timer);
    }
  },
  emitState: (state) => {
    void send({ target: "background", type: "engine/state", state }).catch(
      () => undefined,
    );
  },
};
// One camera for the bubble and the recording, with the optional on-device blur.
const camera = new CameraHub({
  open: acquireCamera,
  createBlur: () => createBlurEffect((path) => browser.runtime.getURL(path as "/")),
  onBlurStatus: (status, reason) =>
    broadcast({ target: "recorder", type: "preview/blur", status, reason }),
});
const engine = new RecordingEngine(host, {
  acquireCamera: (id) => camera.use("engine", id),
  releaseCamera: () => camera.release("engine"),
});
const preview = new Preview(
  { toRecorder: broadcast, toBubble: broadcast },
  {
    acquireCamera: (id) => camera.use("preview", id),
    releaseCamera: () => camera.release("preview"),
    setBlur: (on) => camera.setBlur(on),
  },
);

/** MV3 clipboard path: an offscreen document with the CLIPBOARD reason may copy without focus. */
function copy(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

function fromWorker(sender: Browser.runtime.MessageSender) {
  return !sender.url || sender.url.endsWith("/background.js");
}

function handle(m: OffscreenMessage, sender: Browser.runtime.MessageSender) {
  // Only the camera bubble (the page frame, or the fallback recorder tab) may signal a preview.
  if (m.type.startsWith("rtc/")) {
    const page = extensionPagePath(sender);
    if (page !== "/camera-bubble.html" && page !== "/recorder.html") return;
  } else if (!fromWorker(sender)) return;
  switch (m.type) {
    case "recording/start":
      if (isEngineSupported()) void engine.start(m.settings);
      else
        host.emitState({
          ...initialState,
          phase: "failed",
          error: { code: "UNSUPPORTED", messageKey: "video.unsupported" },
        });
      break;
    case "recording/stop":
      void engine.stop();
      break;
    case "recording/pause":
      engine.pause();
      break;
    case "recording/resume":
      engine.resume();
      break;
    case "recording/live":
      engine.live(m.update);
      break;
    case "recording/cancel":
      void engine.cancel();
      break;
    case "recording/skip-countdown":
      engine.skipCountdown();
      break;
    case "recording/marker-shown":
      engine.markerShown();
      break;
    case "recording/reset":
      engine.reset();
      break;
    case "recording/recover":
      void engine.recover(m.sessionId, m.action);
      break;
    case "preview/configure":
      return preview.configure(m.cameraDeviceId, m.micDeviceId, m.blur);
    case "preview/refresh":
      return preview.publishDevices();
    case "clipboard/write":
      return { ok: copy(m.text) };
    case "rtc/hello":
      return preview.hello(m.peer);
    case "rtc/answer":
      return preview.answer(m.peer, m.sdp);
    case "rtc/ice":
      return preview.ice(m.peer, m.candidate);
    case "rtc/bye":
      preview.bye(m.peer);
      break;
    case "recording/get-state":
    case "api/result":
      break;
  }
}

browser.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
  if (sender.id !== browser.runtime.id) return false;
  const parsed = offscreenSchema.safeParse(raw);
  if (!parsed.success) return false;
  if (parsed.data.type === "recording/get-state") {
    if (!fromWorker(sender)) return false;
    respond(engine.state);
    return true;
  }
  void Promise.resolve(handle(parsed.data, sender))
    .catch(() => undefined)
    .then((result) => respond(result ?? { ok: true }));
  return true;
});
window.addEventListener("pagehide", () => {
  preview.stop();
  camera.close();
  void engine.release();
  void send({ target: "background", type: "engine/closed" }).catch(
    () => undefined,
  );
});
void engine.initialize();
