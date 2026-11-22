import type { ChunkStore } from "./chunk-store";
import type { PartAssembler } from "./part-assembler";
import type { Uploader } from "./uploader";
import { audioBitrate, bitrateFor } from "./mime";
import type { Size } from "./layout";
export interface Recorder {
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
}
export function createRecorder(
  video: MediaStreamTrack,
  audio: MediaStreamTrack | null,
  mimeType: string,
  size: Size,
  sessionId: string,
  store: ChunkStore,
  assembler: PartAssembler,
  uploader: Uploader,
  onBytes: (bytes: number) => void,
  onError: (error: unknown) => void,
): Recorder {
  const recorder = new MediaRecorder(
    new MediaStream(audio ? [video, audio] : [video]),
    {
      mimeType,
      videoBitsPerSecond: bitrateFor(size),
      audioBitsPerSecond: audioBitrate,
    },
  );
  let writes = Promise.resolve(),
    stopping: Promise<void> | undefined,
    writeError: unknown;
  recorder.ondataavailable = (event) => {
    if (!event.data.size) return;
    writes = writes
      .then(async () => {
        await store.putChunk(sessionId, event.data);
        onBytes(event.data.size);
        for (const part of assembler.push(event.data)) uploader.enqueue(part);
      })
      .catch((error) => {
        writeError = error;
        onError(error);
      });
  };
  recorder.onerror = () => onError(new Error("RECORDER_FAILED"));
  recorder.start(1000);
  return {
    pause() {
      if (recorder.state === "recording") recorder.pause();
    },
    resume() {
      if (recorder.state === "paused") recorder.resume();
    },
    stop() {
      return (stopping ??= (async () => {
        if (recorder.state !== "inactive")
          await new Promise<void>((resolve) => {
            recorder.addEventListener("stop", () => resolve(), { once: true });
            recorder.stop();
          });
        await writes;
        if (writeError) throw writeError;
        const last = assembler.flush();
        if (last) uploader.enqueue(last);
      })());
    },
  };
}
