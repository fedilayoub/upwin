import { afterEach, expect, it, vi } from "vitest";
import { createCompositor } from "./compositor";
import { initialState } from "../protocol";
afterEach(() => vi.unstubAllGlobals());
it("closes replaced frames and maintains a fixed output across source changes", async () => {
  const controllers: ReadableStreamDefaultController<VideoFrame>[] = [];
  class Processor {
    readable = new ReadableStream<VideoFrame>({
      start(controller) {
        controllers.push(controller);
      },
    });
  }
  const writes: number[] = [],
    stop = vi.fn();
  class Generator {
    writable = new WritableStream<VideoFrame>({
      write(frame) {
        writes.push(frame.timestamp);
      },
    });
    stop = stop;
  }
  const context = {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    restore: vi.fn(),
    stroke: vi.fn(),
  };
  class Canvas {
    constructor(
      readonly width: number,
      readonly height: number,
    ) {}
    getContext() {
      return context;
    }
  }
  class Frame {
    close = vi.fn();
    timestamp: number;
    constructor(_canvas: unknown, options: { timestamp: number }) {
      this.timestamp = options.timestamp;
    }
  }
  vi.stubGlobal("MediaStreamTrackProcessor", Processor);
  vi.stubGlobal("MediaStreamTrackGenerator", Generator);
  vi.stubGlobal("OffscreenCanvas", Canvas);
  vi.stubGlobal("VideoFrame", Frame);
  const display = {
    getSettings: () => ({ width: 1920, height: 1080 }),
  } as MediaStreamTrack;
  const composite = createCompositor(
    display,
    null,
    null,
    initialState.live,
    vi.fn(),
  );
  const frame = (timestamp: number, width = 1920) =>
    ({
      timestamp,
      displayWidth: width,
      displayHeight: 1080,
      close: vi.fn(),
    }) as unknown as VideoFrame;
  const a = frame(100),
    b = frame(100, 1000);
  controllers[0]!.enqueue(a);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  controllers[0]!.enqueue(b);
  await vi.waitFor(() => expect(writes).toHaveLength(2));
  expect(a.close).toHaveBeenCalledOnce();
  expect(composite.size).toEqual({ w: 1920, h: 1080 });
  expect(writes).toEqual([100, 101]);
  await composite.stop();
  expect(b.close).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledOnce();
});
