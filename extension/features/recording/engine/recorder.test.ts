import { afterEach, expect, it, vi } from "vitest";
import { createRecorder } from "./recorder";
import { PartAssembler } from "./part-assembler";
import { MemoryChunkStore } from "./memory-store";
import type { Uploader } from "./uploader";
let instance: FakeRecorder;
class FakeRecorder extends EventTarget {
  state = "inactive";
  ondataavailable?: (event: { data: Blob }) => void;
  onerror?: () => void;
  start = vi.fn(() => {
    this.state = "recording";
  });
  pause = vi.fn(() => {
    this.state = "paused";
  });
  resume = vi.fn(() => {
    this.state = "recording";
  });
  constructor() {
    super();
    instance = this;
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["123456"]) });
    this.dispatchEvent(new Event("stop"));
  }
}
afterEach(() => vi.unstubAllGlobals());
it("persists the final dataavailable before flushing and stopping", async () => {
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("MediaStream", class {});
  const store = new MemoryChunkStore();
  await store.saveSession({
    sessionId: "s",
    videoId: "v",
    shareUrl: "",
    partSize: 4,
    nextPartNumber: 1,
    uploaded: [],
    phase: "recording",
    createdAt: 0,
    elapsedMs: 0,
    bytesRecorded: 0,
    nextSeq: 0,
    committedBytes: 0,
  });
  const enqueue = vi.fn(),
    bytes = vi.fn(),
    error = vi.fn(),
    recorder = createRecorder(
      {} as MediaStreamTrack,
      null,
      "video/mp4",
      { w: 640, h: 480 },
      "s",
      store,
      new PartAssembler(4),
      { enqueue } as unknown as Uploader,
      bytes,
      error,
    );
  expect(instance.start).toHaveBeenCalledWith(1000);
  recorder.pause();
  recorder.resume();
  await recorder.stop();
  expect((await store.readFrom("s"))[0]!.blob.size).toBe(6);
  expect(enqueue.mock.calls.map((c) => c[0].blob.size)).toEqual([4, 2]);
  expect(bytes).toHaveBeenCalledWith(6);
  expect(error).not.toHaveBeenCalled();
});
