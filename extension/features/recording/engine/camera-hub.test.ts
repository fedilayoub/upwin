import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CameraHub, type BlurStatus } from "./camera-hub";
import type { BlurEffect } from "./background-blur";

class FakeFrame {
  closed = false;
  constructor(readonly label: string) {}
  close() {
    this.closed = true;
  }
}
let written: FakeFrame[] = [];
let feeds: ReadableStreamDefaultController<FakeFrame>[] = [];
beforeEach(() => {
  written = [];
  feeds = [];
  Object.assign(globalThis, {
    MediaStreamTrackProcessor: class {
      readable = new ReadableStream<FakeFrame>({
        start: (controller) => {
          feeds.push(controller);
        },
      });
    },
    MediaStreamTrackGenerator: class {
      readyState = "live";
      writable = new WritableStream<FakeFrame>({
        write: (frame) => {
          written.push(frame);
        },
      });
      clone = () => ({ kind: "video", stop: vi.fn() });
      stop = vi.fn(() => {
        this.readyState = "ended";
      });
    },
    MediaStream: class {
      constructor(readonly tracks: unknown[]) {}
      getTracks = () => this.tracks;
    },
  });
});
afterEach(() => vi.restoreAllMocks());
function deviceStream() {
  const track = { kind: "video", stop: vi.fn() };
  return {
    track,
    stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream,
  };
}
function fixture(blur?: Partial<BlurEffect> | Error) {
  const opened: string[] = [];
  const devices: ReturnType<typeof deviceStream>[] = [];
  const statuses: BlurStatus[] = [];
  const reasons: (string | undefined)[] = [];
  const createBlur = vi.fn(async () => {
    if (blur instanceof Error) throw blur;
    return {
      delegate: "GPU",
      process: (frame: VideoFrame) =>
        new FakeFrame(`blurred:${(frame as unknown as FakeFrame).label}`) as unknown as VideoFrame,
      close: vi.fn(),
      ...blur,
    } as BlurEffect;
  });
  const hub = new CameraHub({
    open: vi.fn(async (id: string) => {
      opened.push(id);
      const device = deviceStream();
      devices.push(device);
      return device.stream;
    }),
    createBlur,
    onBlurStatus: (status, reason) => {
      statuses.push(status);
      reasons.push(reason);
    },
  });
  return { hub, opened, devices, statuses, reasons, createBlur };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it("opens the device once for the preview and the recording, and closes it after both", async () => {
  const f = fixture();
  await f.hub.use("preview", "cam");
  await f.hub.use("engine", "cam");
  expect(f.opened).toEqual(["cam"]);
  f.hub.release("preview");
  expect(f.devices[0]!.track.stop).not.toHaveBeenCalled();
  f.hub.release("engine");
  expect(f.devices[0]!.track.stop).toHaveBeenCalled();
  expect(f.hub.active).toBe(false);
});
it("lets the recording's device win and switches without a new consumer track", async () => {
  const f = fixture();
  await f.hub.use("preview", "front");
  await f.hub.use("engine", "usb");
  await f.hub.use("preview", "front");
  expect(f.opened).toEqual(["front", "usb"]);
  expect(f.devices[0]!.track.stop).toHaveBeenCalled();
});
it("passes frames through, then blurs them once the model is ready", async () => {
  const f = fixture();
  await f.hub.use("preview", "cam");
  feeds[0]!.enqueue(new FakeFrame("a"));
  await flush();
  await f.hub.setBlur(true);
  expect(f.statuses).toEqual(["loading", "on"]);
  feeds[0]!.enqueue(new FakeFrame("b"));
  await flush();
  expect(written.map((frame) => frame.label)).toEqual(["a", "blurred:b"]);
  await f.hub.setBlur(false);
  expect(f.hub.blurStatus).toBe("off");
});
it("reports the blur unavailable when the model cannot load, and keeps the camera", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const f = fixture(new Error("BLUR_UNSUPPORTED"));
  await f.hub.use("preview", "cam");
  await f.hub.setBlur(true);
  expect(f.statuses).toEqual(["loading", "unavailable"]);
  expect(f.reasons.at(-1)).toBe("Error: BLUR_UNSUPPORTED");
  feeds[0]!.enqueue(new FakeFrame("a"));
  await flush();
  expect(written.map((frame) => frame.label)).toEqual(["a"]);
});
it("retries a failed load only after the blur is turned off and on again", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const f = fixture(new Error("NotReadableError"));
  await f.hub.setBlur(true);
  await f.hub.setBlur(true);
  expect(f.hub.blurStatus).toBe("unavailable");
  await f.hub.setBlur(false);
  await f.hub.setBlur(true);
  expect(f.createBlur).toHaveBeenCalledTimes(2);
  expect(f.statuses).toEqual(["loading", "unavailable", "unavailable", "off", "loading", "unavailable"]);
});
