import { afterEach, expect, it, vi } from "vitest";
import { RecordingEngine, type EngineDependencies } from "./engine";
import { defaultSettings } from "../protocol";
import { MemoryChunkStore } from "./memory-store";
import { video } from "../test-fixtures";
import { Uploader } from "./uploader";
import { RecordingError, type EngineHost } from "./host";
function track(kind: "audio" | "video") {
  return Object.assign(new EventTarget(), {
    kind,
    enabled: true,
    stop: vi.fn(),
    getSettings: () => ({ width: 640, height: 480, displaySurface: "browser" }),
  }) as unknown as MediaStreamTrack;
}
function stream(t: MediaStreamTrack) {
  return {
    getTracks: () => [t],
    getAudioTracks: () => (t.kind === "audio" ? [t] : []),
    getVideoTracks: () => (t.kind === "video" ? [t] : []),
  } as unknown as MediaStream;
}
function fixture(overrides: Partial<EngineDependencies> = {}) {
  const store = new MemoryChunkStore(),
    display = track("video"),
    camera = track("video"),
    mic = track("audio");
  let now = 0;
  const api = vi.fn(async (op: string) =>
    op === "create"
      ? {
          video,
          upload: {
            partSizeBytes: 4,
            maxParts: 20,
            maxBytes: 80,
            maxDurationMs: 300000,
          },
        }
      : op === "presignParts"
        ? {
            parts: Array.from({ length: 20 }, (_, n) => ({
              partNumber: n + 1,
              url: `https://storage.test/${n + 1}`,
              expiresAt: new Date(3600000).toISOString(),
            })),
          }
        : op === "listUploadedParts"
          ? { parts: [] }
          : { video: { ...video, status: "processing" } },
  );
  const host = {
    api,
    emitState: vi.fn(),
    now: () => now,
  } as unknown as EngineHost;
  const pause = vi.fn(),
    resume = vi.fn();
  const deps: Partial<EngineDependencies> = {
    store,
    acquireDisplay: vi.fn(async () => stream(display)),
    acquireCamera: vi.fn(async () => stream(camera)),
    acquireMic: vi.fn(async () => stream(mic)),
    compositor: vi.fn(() => ({
      track: display,
      size: { w: 640, h: 480 },
      update: vi.fn(),
      stop: vi.fn(async () => undefined),
    })),
    // The marker check: by default the bubble is not in the capture.
    probe: vi.fn(() => ({
      result: Promise.resolve("no" as const),
      shown: vi.fn(),
      cancel: vi.fn(),
    })),
    playBack: vi.fn(() => async () => undefined),
    mixer: vi.fn(() => ({
      track: mic,
      mute: vi.fn(),
      stop: vi.fn(async () => undefined),
    })),
    mime: () => "video/mp4",
    wait: vi.fn(async () => undefined),
    recorder: vi.fn(
      (_v, _a, _m, _s, id, chunks, assembler, uploader, bytes) => ({
        pause,
        resume,
        stop: vi.fn(async () => {
          const blob = new Blob(["123456"]);
          await chunks.putChunk(id, blob);
          bytes(blob.size);
          for (const part of assembler.push(blob)) uploader.enqueue(part);
          const last = assembler.flush();
          if (last) uploader.enqueue(last);
        }),
      }),
    ),
    uploader: (id, max, host, options) =>
      new Uploader(id, max, host, {
        ...options,
        fetch: vi.fn(
          async () => new Response(null, { headers: { ETag: '"etag"' } }),
        ),
        wait: async () => undefined,
      }),
    ...overrides,
  };
  const engine = new RecordingEngine(host, deps);
  const settings = {
    ...defaultSettings,
    countdown: false,
    cameraDeviceId: "camera",
    micDeviceId: "mic",
  };
  return {
    engine,
    store,
    api,
    host,
    display,
    camera,
    mic,
    settings,
    deps,
    setNow: (value: number) => {
      now = value;
    },
    pause,
    resume,
  };
}
afterEach(() => vi.useRealTimers());
it("records, pauses, uploads contiguous parts, completes, and releases all sources", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.engine.start(f.settings);
  expect(f.engine.state.phase).toBe("recording");
  f.setNow(1000);
  await vi.advanceTimersByTimeAsync(1000);
  f.engine.pause();
  f.setNow(11000);
  await vi.advanceTimersByTimeAsync(10000);
  expect(f.engine.state.elapsedMs).toBe(1000);
  f.engine.resume();
  await f.engine.stop();
  expect(f.engine.state.phase).toBe("done");
  expect(f.engine.state.bytesUploaded).toBe(6);
  expect(f.api).toHaveBeenCalledWith(
    "complete",
    expect.objectContaining({
      parts: [
        { partNumber: 1, etag: '"etag"' },
        { partNumber: 2, etag: '"etag"' },
      ],
    }),
  );
  expect(f.store.sessions.size).toBe(0);
  for (const t of [f.camera, f.mic, f.display])
    expect(t.stop).toHaveBeenCalled();
});
it("finishes and uploads the take by itself when it reaches the time limit", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.engine.start(f.settings);
  f.setNow(299_000);
  await vi.advanceTimersByTimeAsync(250);
  expect(f.engine.state.phase).toBe("recording");
  f.setNow(300_000);
  await vi.advanceTimersByTimeAsync(250);
  expect(f.engine.state.phase).toBe("done");
  expect(f.api).toHaveBeenCalledWith("complete", expect.anything());
});
it("stops at the limit even when the repeating tick is throttled away", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.engine.start(f.settings);
  // A hidden page may run repeating timers once a minute. Drop the interval; pause and resume
  // re-arm only the one-shot deadline, so it alone has to end the take.
  vi.clearAllTimers();
  f.engine.pause();
  f.engine.resume();
  f.setNow(300_100);
  await vi.advanceTimersByTimeAsync(300_100);
  expect(f.engine.state.phase).toBe("done");
});
it("does not count paused time towards the limit", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.engine.start(f.settings);
  f.setNow(200_000);
  await vi.advanceTimersByTimeAsync(250);
  f.engine.pause();
  f.setNow(500_000);
  await vi.advanceTimersByTimeAsync(300_000);
  expect(f.engine.state.phase).toBe("paused");
  f.engine.resume();
  f.setNow(599_000);
  await vi.advanceTimersByTimeAsync(250);
  expect(f.engine.state.phase).toBe("recording");
  f.setNow(600_100);
  await vi.advanceTimersByTimeAsync(101_100);
  expect(f.engine.state.phase).toBe("done");
});
it("picker dismissal and a missing area never create a server row", async () => {
  for (const area of [false, true]) {
    const f = fixture(
      area
        ? {}
        : {
            acquireDisplay: vi
              .fn()
              .mockRejectedValue(
                new DOMException("dismissed", "NotAllowedError"),
              ),
          },
    );
    await f.engine.start({ ...f.settings, mode: area ? "area" : "screen" });
    expect(f.engine.state.phase).toBe(area ? "failed" : "idle");
    if (area) expect(f.engine.state.error?.code).toBe("AREA_REQUIRED");
    expect(f.api).not.toHaveBeenCalledWith("create", expect.anything());
    if (!area) expect(f.camera.stop).toHaveBeenCalled();
  }
});
it("consumes a tab stream id before the camera and mic, and plays the tab back", async () => {
  const order: string[] = [];
  const f = fixture();
  vi.mocked(f.deps.acquireDisplay!).mockImplementation(async () => {
    order.push("display");
    return stream(f.display);
  });
  vi.mocked(f.deps.acquireCamera!).mockImplementation(async () => {
    order.push("camera");
    return stream(f.camera);
  });
  await f.engine.start({
    ...f.settings,
    mode: "tab",
    tabStreamId: "stream-id",
    cameraLayer: "page",
  });
  expect(order).toEqual(["display", "camera"]);
  expect(f.deps.acquireDisplay).toHaveBeenCalledTimes(1);
  expect(f.api).toHaveBeenCalledWith(
    "create",
    expect.objectContaining({ sourceKind: "tab" }),
  );
  expect(f.engine.state.live.cameraLayer).toBe("page");
  expect(f.deps.playBack).toHaveBeenCalledOnce();
  expect(vi.mocked(f.deps.compositor!).mock.calls[0]![3].cameraLayer).toBe(
    "page",
  );
});
it("crops an area from the settings and reports an area source", async () => {
  const f = fixture();
  const rect = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };
  await f.engine.start({
    ...f.settings,
    mode: "area",
    areaRect: rect,
    tabStreamId: "stream-id",
  });
  expect(vi.mocked(f.deps.compositor!).mock.calls[0]![2]).toEqual(rect);
  expect(f.api).toHaveBeenCalledWith(
    "create",
    expect.objectContaining({ sourceKind: "area" }),
  );
});
it("skips the rest of the countdown on request", async () => {
  const f = fixture({
    wait: vi.fn(
      (_ms: number, signal?: AbortSignal) =>
        new Promise<void>((resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
          if (!signal) resolve();
        }),
    ),
  });
  // One-click tab capture: no marker check, so the countdown is the only wait.
  const started = f.engine.start({
    ...f.settings,
    countdown: true,
    tabStreamId: "stream",
  });
  await vi.waitFor(() => expect(f.engine.state.countdown).toBe(3));
  f.engine.skipCountdown();
  await started;
  expect(f.engine.state.phase).toBe("recording");
  expect(f.deps.wait).toHaveBeenCalledTimes(1);
});
it("releases sources when the API refuses the recording", async () => {
  const f = fixture();
  f.api.mockRejectedValueOnce(new RecordingError("VIDEO_NOT_CONFIGURED"));
  await f.engine.start(f.settings);
  expect(f.engine.state.error?.code).toBe("VIDEO_NOT_CONFIGURED");
  expect(f.display.stop).toHaveBeenCalled();
});
it("stops on display-ended and at the server duration limit", async () => {
  for (const limit of [false, true]) {
    vi.useFakeTimers();
    const f = fixture();
    await f.engine.start(f.settings);
    if (limit) {
      f.setNow(300000);
      await vi.advanceTimersByTimeAsync(250);
    } else f.display.dispatchEvent(new Event("ended"));
    await f.engine.stop();
    expect(f.engine.state.phase).toBe("done");
    vi.useRealTimers();
  }
});
it("cancel after create aborts the upload", async () => {
  const f = fixture({
    wait: (_ms, signal) =>
      new Promise((_, reject) =>
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Cancelled", "AbortError")),
        ),
      ),
  });
  const starting = f.engine.start({ ...f.settings, countdown: true });
  await vi.waitFor(() => expect(f.engine.state.phase).toBe("countdown"));
  await f.engine.cancel();
  await starting;
  expect(f.api).toHaveBeenCalledWith("abortUpload", { videoId: video.id });
  expect(f.engine.state.phase).toBe("idle");
  expect(f.store.sessions.size).toBe(0);
});
it("retries completion after a lost response", async () => {
  const f = fixture();
  const original = f.api.getMockImplementation()!;
  let completes = 0;
  f.api.mockImplementation(async (op) => {
    if (op === "complete" && completes++ === 0) throw new TypeError("offline");
    return original(op);
  });
  await f.engine.start(f.settings);
  await f.engine.stop();
  expect(completes).toBe(2);
  expect(f.engine.state.phase).toBe("done");
});
it("releases a late device grant after cancellation", async () => {
  let resolve!: (s: MediaStream) => void;
  const f = fixture({
    acquireCamera: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  const starting = f.engine.start(f.settings);
  await f.engine.cancel();
  resolve(stream(f.camera));
  await starting;
  expect(f.camera.stop).toHaveBeenCalled();
  expect(f.engine.state.phase).toBe("idle");
  expect(f.api).not.toHaveBeenCalled();
});
it.each(["upload", "discard"] as const)(
  "recovers %s from stored chunks",
  async (action) => {
    const f = fixture();
    await f.store.saveSession({
      sessionId: "recover",
      videoId: video.id,
      shareUrl: video.shareUrl,
      partSize: 4,
      nextPartNumber: 1,
      uploaded: [],
      phase: "recording",
      createdAt: 1,
      elapsedMs: 1000,
      bytesRecorded: 0,
      nextSeq: 0,
      committedBytes: 0,
    });
    await f.store.putChunk("recover", new Blob(["123456"]));
    await f.engine.initialize();
    expect(f.engine.state.recoveries).toHaveLength(1);
    await f.engine.recover("recover", action);
    expect(f.engine.state.phase).toBe(action === "upload" ? "done" : "idle");
    expect(f.store.sessions.size).toBe(0);
    expect(f.api).toHaveBeenCalledWith(
      action === "upload" ? "complete" : "abortUpload",
      expect.anything(),
    );
  },
);
it("recovers a chunk spanning an uploaded part boundary without losing bytes", async () => {
  const f = fixture();
  await f.store.saveSession({
    sessionId: "recover",
    videoId: video.id,
    shareUrl: video.shareUrl,
    partSize: 4,
    nextPartNumber: 1,
    uploaded: [],
    phase: "recording",
    createdAt: 1,
    elapsedMs: 1000,
    bytesRecorded: 0,
    nextSeq: 0,
    committedBytes: 0,
  });
  await f.store.putChunk("recover", new Blob(["123"]));
  await f.store.putChunk("recover", new Blob(["456789"]));
  await f.store.markUploaded("recover", 1, '"server"', 4);
  expect(f.store.chunks).toHaveLength(1);
  const original = f.api.getMockImplementation()!;
  f.api.mockImplementation(async (op) =>
    op === "listUploadedParts"
      ? ({
          parts: [{ partNumber: 1, etag: '"server"', sizeBytes: 4 }],
        } as never)
      : original(op),
  );
  await f.engine.recover("recover", "upload");
  expect(f.engine.state.phase).toBe("done");
  expect(f.api).toHaveBeenCalledWith(
    "complete",
    expect.objectContaining({
      parts: [
        { partNumber: 1, etag: '"server"' },
        { partNumber: 2, etag: '"etag"' },
        { partNumber: 3, etag: '"etag"' },
      ],
    }),
  );
});
it("completes recovery when all chunks were already acknowledged before reload", async () => {
  const f = fixture();
  await f.store.saveSession({
    sessionId: "recover",
    videoId: video.id,
    shareUrl: video.shareUrl,
    partSize: 4,
    nextPartNumber: 1,
    uploaded: [],
    phase: "uploading",
    createdAt: 1,
    elapsedMs: 1000,
    bytesRecorded: 0,
    nextSeq: 0,
    committedBytes: 0,
  });
  await f.store.putChunk("recover", new Blob(["123456"]));
  await f.store.markUploaded("recover", 1, '"first"', 4);
  await f.store.markUploaded("recover", 2, '"last"', 2);
  const original = f.api.getMockImplementation()!;
  f.api.mockImplementation(async (op) =>
    op === "listUploadedParts"
      ? ({
          parts: [
            { partNumber: 1, etag: '"first"', sizeBytes: 4 },
            { partNumber: 2, etag: '"last"', sizeBytes: 2 },
          ],
        } as never)
      : original(op),
  );
  await f.engine.recover("recover", "upload");
  expect(f.engine.state.phase).toBe("done");
  expect(f.api).toHaveBeenCalledWith(
    "complete",
    expect.objectContaining({
      parts: [
        { partNumber: 1, etag: '"first"' },
        { partNumber: 2, etag: '"last"' },
      ],
    }),
  );
});
it("resets a finished session to idle and keeps pending recoveries", async () => {
  const f = fixture();
  await f.engine.start(f.settings);
  await f.engine.stop();
  expect(f.engine.state.phase).toBe("done");
  f.engine.reset();
  expect(f.engine.state.phase).toBe("idle");
  expect(f.engine.state.videoId).toBeNull();
  await f.engine.start(f.settings);
  f.engine.reset();
  expect(f.engine.state.phase).toBe("recording");
});
it("releases the shared camera when the recording ends", async () => {
  const releaseCamera = vi.fn();
  const f = fixture({ releaseCamera });
  await f.engine.start(f.settings);
  expect(releaseCamera).not.toHaveBeenCalled();
  await f.engine.stop();
  expect(releaseCamera).toHaveBeenCalledOnce();
});

it("checks a picked source for the page bubble before the first frame", async () => {
  for (const [seen, layer] of [
    ["yes", "page"],
    ["no", "composite"],
    ["unknown", "composite"],
  ] as const) {
    let answer: (value: typeof seen) => void = () => undefined;
    const shown = vi.fn();
    const probe = vi.fn(() => ({
      result: new Promise<typeof seen>((resolve) => (answer = resolve)),
      shown,
      cancel: vi.fn(),
    }));
    const f = fixture({ probe });
    const starting = f.engine.start({ ...f.settings, mode: "window" });
    await vi.waitFor(() =>
      expect(f.engine.state.bubbleInCapture).toBe("probing"),
    );
    expect(probe).toHaveBeenCalledWith(f.display);
    // Nothing is recorded while the answer is out.
    expect(f.deps.compositor).not.toHaveBeenCalled();
    f.engine.markerShown();
    expect(shown).toHaveBeenCalledOnce();
    answer(seen);
    await starting;
    expect(f.engine.state.phase).toBe("recording");
    expect(f.engine.state.bubbleInCapture).toBe(seen);
    expect(f.engine.state.live.cameraLayer).toBe(layer);
    // The compositor starts with the answer, after the marker had time to leave the page.
    expect(vi.mocked(f.deps.compositor!).mock.calls[0]?.[3]).toMatchObject({
      cameraLayer: layer,
    });
    expect(f.deps.wait).toHaveBeenCalledWith(350, expect.anything());
    await f.engine.cancel();
  }
});
it("does not check a one-click tab capture or a take without a camera", async () => {
  const tab = fixture();
  await tab.engine.start({
    ...tab.settings,
    tabStreamId: "stream",
    cameraLayer: "page",
  });
  expect(tab.deps.probe).not.toHaveBeenCalled();
  expect(tab.engine.state.bubbleInCapture).toBe("assumed");
  expect(tab.engine.state.live.cameraLayer).toBe("page");
  await tab.engine.cancel();
  const noCamera = fixture();
  await noCamera.engine.start({
    ...noCamera.settings,
    mode: "window",
    cameraDeviceId: null,
  });
  expect(noCamera.deps.probe).not.toHaveBeenCalled();
  await noCamera.engine.cancel();
});
it("drops the check when the take is cancelled before it answers", async () => {
  const cancel = vi.fn();
  const f = fixture({
    probe: vi.fn(() => ({
      result: new Promise<"no">(() => undefined),
      shown: vi.fn(),
      cancel,
    })),
  });
  void f.engine.start({ ...f.settings, mode: "window" });
  await vi.waitFor(() => expect(f.engine.state.bubbleInCapture).toBe("probing"));
  await f.engine.cancel();
  expect(cancel).toHaveBeenCalled();
  expect(f.engine.state.phase).toBe("idle");
  expect(f.engine.state.bubbleInCapture).toBe("assumed");
  expect(f.deps.compositor).not.toHaveBeenCalled();
});
