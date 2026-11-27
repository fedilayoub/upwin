import type { CreateVideoResponse, Video } from "@/types/video";
import {
  initialState,
  type LiveUpdate,
  type RecordingSettings,
  type SessionState,
} from "../protocol";
import {
  errorCode,
  isRetryable,
  RecordingError,
  type EngineHost,
} from "./host";
import { reduce, type SessionEvent } from "./session-machine";
import {
  IndexedChunkStore,
  type ChunkStore,
  type StoredSession,
} from "./chunk-store";
import * as sources from "./sources";
import { createCompositor, type Composite } from "./compositor";
import { MARKER_CLEAR_MS, probeMarker, type MarkerProbe } from "./marker-probe";
import { mixAudio, type AudioMix } from "./audio-mixer";
import { createRecorder, type Recorder } from "./recorder";
import { PartAssembler } from "./part-assembler";
import { Uploader, wait } from "./uploader";
import { pickMime } from "./mime";
export interface EngineDependencies {
  store: ChunkStore;
  acquireCamera: typeof sources.acquireCamera;
  /** Frees the shared camera the engine took with `acquireCamera`. */
  releaseCamera: () => void;
  acquireMic: typeof sources.acquireMic;
  acquireDisplay: typeof sources.acquireDisplay;
  compositor: typeof createCompositor;
  /** The marker check: is the page bubble inside the picked source? */
  probe: (display: MediaStreamTrack) => MarkerProbe;
  mixer: typeof mixAudio;
  playBack: typeof sources.playBack;
  recorder: typeof createRecorder;
  uploader: (
    id: string,
    maxParts: number,
    host: EngineHost,
    options: ConstructorParameters<typeof Uploader>[3],
  ) => Uploader;
  mime: (audio: boolean) => string | null;
  wait: typeof wait;
}
export class RecordingEngine {
  state: SessionState = { ...initialState };
  private deps: EngineDependencies;
  private settings?: RecordingSettings;
  private streams: MediaStream[] = [];
  private composite?: Composite;
  private audio?: AudioMix;
  private recorder?: Recorder;
  private uploader?: Uploader;
  private timer?: ReturnType<typeof setInterval>;
  /**
   * Fires once when the take reaches its limit. The 250 ms interval alone is not enough: Chrome
   * may batch a hidden page's repeating timers to once a minute after five minutes, which would
   * overshoot the limit (and the server's 5 s grace) by up to a minute.
   */
  private deadline?: ReturnType<typeof setTimeout>;
  private controller = new AbortController();
  private run = 0;
  private lastTick = 0;
  private stopping?: Promise<void>;
  private maximumBytes = Infinity;
  private failing = false;
  private stopPlayback?: () => Promise<void>;
  private holdsCamera = false;
  private countdownSkip?: AbortController;
  private probe?: MarkerProbe;
  constructor(
    private host: EngineHost,
    overrides: Partial<EngineDependencies> = {},
  ) {
    this.deps = {
      store: new IndexedChunkStore(),
      acquireCamera: sources.acquireCamera,
      releaseCamera: () => undefined,
      acquireMic: sources.acquireMic,
      acquireDisplay: sources.acquireDisplay,
      compositor: createCompositor,
      probe: (display) => probeMarker(display),
      mixer: mixAudio,
      playBack: sources.playBack,
      recorder: createRecorder,
      uploader: (id, max, host, options) =>
        new Uploader(id, max, host, options),
      mime: (audio) => pickMime((m) => MediaRecorder.isTypeSupported(m), audio),
      wait,
      ...overrides,
    };
  }
  async initialize() {
    const pending = await this.deps.store.listUnfinished();
    this.patch({
      recoveries: pending.map((s) => ({
        sessionId: s.sessionId,
        createdAt: s.createdAt,
      })),
    });
  }
  private emit() {
    this.state = { ...this.state, updatedAt: this.host.now() };
    this.host.emitState(this.state);
  }
  private patch(update: Partial<SessionState>) {
    this.state = { ...this.state, ...update };
    this.emit();
  }
  private event(
    type: SessionEvent["type"],
    extra: Omit<SessionEvent, "type"> = {},
  ) {
    this.state = reduce(this.state, { type, ...extra });
    this.emit();
  }
  private check(run: number) {
    if (run !== this.run || this.controller.signal.aborted)
      throw new DOMException("Cancelled", "AbortError");
  }
  private async acquire(promise: Promise<MediaStream>, run: number) {
    const stream = await promise;
    if (run !== this.run) {
      sources.releaseAll(stream);
      this.check(run);
    }
    this.streams.push(stream);
    return stream;
  }
  async start(settings: RecordingSettings) {
    if (
      !["idle", "done", "failed"].includes(this.state.phase) ||
      this.state.recoveries.length
    )
      return;
    const run = ++this.run;
    this.controller = new AbortController();
    this.stopping = undefined;
    this.settings = settings;
    this.event("start");
    this.patch({
      sessionId: crypto.randomUUID(),
      live: {
        micMuted: false,
        cameraVisible: !!settings.cameraDeviceId && settings.cameraVisible,
        bubbleCorner: settings.bubbleCorner,
        bubbleSize: settings.bubbleSize,
        bubbleRoundness: settings.bubbleRoundness,
        bubbleZoom: settings.bubbleZoom,
        cameraLayer: settings.cameraLayer,
      },
    });
    try {
      if (settings.mode === "area" && !settings.areaRect)
        throw new RecordingError("AREA_REQUIRED");
      // A tab stream id expires within seconds, so it is consumed before slower device grants.
      const early = settings.tabStreamId
        ? await this.acquire(this.deps.acquireDisplay(settings), run)
        : null;
      this.check(run);
      const camera = settings.cameraDeviceId
        ? await this.acquire(
            this.deps.acquireCamera(settings.cameraDeviceId).then((stream) => {
              this.holdsCamera = true;
              return stream;
            }),
            run,
          )
        : null;
      this.check(run);
      const mic = settings.micDeviceId
        ? await this.acquire(this.deps.acquireMic(settings.micDeviceId), run)
        : null;
      this.check(run);
      this.event("acquired");
      let display: MediaStream;
      try {
        display =
          early ?? (await this.acquire(this.deps.acquireDisplay(settings), run));
      } catch (error: unknown) {
        this.check(run);
        if (
          errorCode(error) === "NotAllowedError" ||
          errorCode(error) === "AbortError"
        ) {
          await this.release();
          this.event("pick-cancelled");
          return;
        }
        throw error;
      }
      this.check(run);
      this.event("picked", { area: false });
      const displayTrack = display.getVideoTracks()[0];
      if (!displayTrack) throw new RecordingError("DISPLAY_ENDED");
      // A source from the browser's picker: nothing says whether the page bubble is inside it.
      // Find out before the first frame, so the camera is in the video exactly once. The
      // answer is applied as soon as it is known, which takes the marker off the page.
      let probed: Promise<number> | null = null;
      if (!settings.tabStreamId && camera && this.state.live.cameraVisible) {
        this.patch({ bubbleInCapture: "probing" });
        const probe = (this.probe = this.deps.probe(displayTrack));
        probed = probe.result.then((seen) => {
          if (run !== this.run || this.probe !== probe) return 0;
          this.probe = undefined;
          this.patch({
            bubbleInCapture: seen,
            live: {
              ...this.state.live,
              cameraLayer: seen === "yes" ? "page" : "composite",
            },
          });
          return this.host.now();
        });
      }
      const crop = settings.mode === "area" ? settings.areaRect : null;
      const micTrack = mic?.getAudioTracks()[0] ?? null,
        displayAudio = display.getAudioTracks()[0] ?? null;
      const mime = this.deps.mime(!!micTrack || !!displayAudio);
      if (!mime) throw new RecordingError("UNSUPPORTED");
      const created = await this.host.api<CreateVideoResponse>("create", {
        ...(settings.title?.trim() ? { title: settings.title.trim() } : {}),
        sourceKind: sources.sourceKind(displayTrack, settings),
        hasCamera: !!camera,
        hasAudio: !!micTrack || !!displayAudio,
        mimeType: "video/mp4",
        jobSnapshotId: settings.jobSnapshotId,
      });
      if (run !== this.run) {
        await this.host.api("abortUpload", { videoId: created.video.id });
        return;
      }
      this.patch({
        videoId: created.video.id,
        shareUrl: created.video.shareUrl,
        maxDurationMs: created.upload.maxDurationMs,
      });
      this.maximumBytes = created.upload.maxBytes;
      await this.deps.store.saveSession({
        sessionId: this.state.sessionId!,
        videoId: created.video.id,
        shareUrl: created.video.shareUrl,
        partSize: created.upload.partSizeBytes,
        nextPartNumber: 1,
        uploaded: [],
        phase: "countdown",
        createdAt: this.host.now(),
        elapsedMs: 0,
        bytesRecorded: 0,
        nextSeq: 0,
        committedBytes: 0,
      });
      this.check(run);
      this.event("created");
      displayTrack.addEventListener(
        "ended",
        () => {
          if (run !== this.run) return;
          if (["recording", "paused"].includes(this.state.phase))
            void this.stop();
          else void this.cancel();
        },
        { once: true },
      );
      for (const [kind, stream] of [
        ["camera", camera],
        ["microphone", mic],
      ] as const)
        stream?.getTracks()[0]?.addEventListener(
          "ended",
          () => {
            if (run === this.run) {
              this.live(
                kind === "camera"
                  ? { cameraVisible: false }
                  : { micMuted: true },
              );
              this.patch({ warnings: [...this.state.warnings, kind] });
            }
          },
          { once: true },
        );
      if (settings.countdown) {
        const skip = (this.countdownSkip = new AbortController());
        for (let n = 3; n > 0 && !skip.signal.aborted; n--) {
          this.patch({ countdown: n });
          await this.deps
            .wait(1000, AbortSignal.any([this.controller.signal, skip.signal]))
            .catch((error: unknown) => {
              if (!skip.signal.aborted) throw error;
            });
          this.check(run);
        }
        this.countdownSkip = undefined;
      }
      if (probed) {
        const answeredAt = await probed;
        this.check(run);
        // The marker, and a bubble that must leave, are off the page before the first frame.
        const rest = MARKER_CLEAR_MS - (this.host.now() - answeredAt);
        if (rest > 0) await this.deps.wait(rest, this.controller.signal);
        this.check(run);
      }
      // The user still hears a captured tab: `tabCapture` mutes it otherwise.
      if (settings.tabStreamId)
        this.stopPlayback = this.deps.playBack(displayAudio);
      this.composite = this.deps.compositor(
        displayTrack,
        camera?.getVideoTracks()[0] ?? null,
        crop,
        this.state.live,
        (error) => void this.fail(error),
        settings.tabStreamId ? sources.tabCaptureSize(settings.tabSize) : null,
        // Matching the page bubble only matters where it can be in the video.
        ["no", "unknown"].includes(this.state.bubbleInCapture)
          ? null
          : settings.pageGeometry,
      );
      this.audio = this.deps.mixer(micTrack, displayAudio);
      this.uploader = this.makeUploader(
        created.video.id,
        created.upload.maxParts,
      );
      this.recorder = this.deps.recorder(
        this.composite.track,
        this.audio.track,
        mime,
        this.composite.size,
        this.state.sessionId!,
        this.deps.store,
        new PartAssembler(created.upload.partSizeBytes),
        this.uploader,
        (bytes) => {
          this.state = {
            ...this.state,
            bytesRecorded: this.state.bytesRecorded + bytes,
          };
          if (this.state.bytesRecorded > this.maximumBytes)
            void this.fail(new RecordingError("VIDEO_TOO_LARGE"));
        },
        (error) => void this.fail(error),
      );
      this.event("countdown-done", { now: this.host.now() });
      this.patch({ countdown: 0 });
      this.lastTick = this.host.now();
      this.timer = setInterval(() => this.tick(), 250);
      this.armDeadline();
    } catch (error: unknown) {
      if (run !== this.run || this.controller.signal.aborted) return;
      await this.fail(error);
    }
  }
  private tick(autoStop = true) {
    const now = this.host.now(),
      delta = now - this.lastTick;
    this.lastTick = now;
    this.state = reduce(this.state, { type: "tick", now: delta });
    if (this.state.phase === "recording" && this.state.maxDurationMs) {
      if (autoStop && this.state.elapsedMs >= this.state.maxDurationMs) {
        void this.stop();
        return;
      }
      if (
        this.state.elapsedMs >= this.state.maxDurationMs - 30_000 &&
        !this.state.warnings.includes("limit")
      )
        this.patch({ warnings: [...this.state.warnings, "limit"] });
    }
    // Persist locally. Tick and chunk callbacks never send worker heartbeats.
    if (
      this.state.sessionId &&
      Math.floor(now / 1000) !== Math.floor((now - delta) / 1000)
    )
      void this.deps.store
        .updateSession(this.state.sessionId, {
          elapsedMs: this.state.elapsedMs,
          phase: this.state.phase,
        })
        .catch((error) => void this.fail(error));
  }
  /** Schedules the auto-stop for the time left in this take; paused time does not count. */
  private armDeadline() {
    this.clearDeadline();
    const max = this.state.maxDurationMs;
    if (this.state.phase !== "recording" || !max) return;
    // A little late on purpose, so the tick it triggers sees the limit reached.
    const remaining = Math.max(0, max - this.state.elapsedMs) + 50;
    this.deadline = setTimeout(() => this.tick(), remaining);
  }
  private clearDeadline() {
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = undefined;
  }
  skipCountdown() {
    this.countdownSkip?.abort();
  }
  /** The page host painted the marker: "not found" now means the bubble is not captured. */
  markerShown() {
    this.probe?.shown();
  }
  /** A finished or failed session goes back to idle, so a reopened recorder starts fresh. */
  reset() {
    if (!["done", "failed"].includes(this.state.phase)) return;
    this.state = { ...initialState, recoveries: this.state.recoveries };
    this.emit();
  }
  pause() {
    if (this.state.phase !== "recording") return;
    this.tick();
    this.clearDeadline();
    this.recorder?.pause();
    this.event("pause");
  }
  resume() {
    if (this.state.phase !== "paused") return;
    this.lastTick = this.host.now();
    this.recorder?.resume();
    this.event("resume");
    this.armDeadline();
  }
  live(update: LiveUpdate) {
    const live = { ...this.state.live, ...update };
    this.audio?.mute(live.micMuted);
    this.composite?.update(live);
    this.patch({ live });
  }
  private makeUploader(id: string, maxParts: number) {
    return this.deps.uploader(id, maxParts, this.host, {
      failed: (error) => void this.fail(error),
      healthy: (uploadHealthy) => this.patch({ uploadHealthy }),
      uploaded: async (part) => {
        if (!this.state.sessionId) return;
        await this.deps.store.markUploaded(
          this.state.sessionId,
          part.partNumber,
          part.etag,
          part.sizeBytes,
        );
        this.patch({
          bytesUploaded: this.state.bytesUploaded + part.sizeBytes,
        });
      },
    });
  }
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    if (!["recording", "paused"].includes(this.state.phase))
      return Promise.resolve();
    return (this.stopping = (async () => {
      const run = this.run;
      try {
        this.tick(false);
        this.event("stop");
        await this.recorder?.stop();
        await this.release();
        this.check(run);
        this.patch({ phase: "uploading" });
        await this.finishUpload();
      } catch (error: unknown) {
        if (run === this.run && !this.controller.signal.aborted)
          await this.fail(error);
      }
    })());
  }
  private async finishUpload() {
    await this.uploader?.drain();
    this.event("parts-drained");
    if (this.state.sessionId)
      await this.deps.store.updateSession(this.state.sessionId, {
        phase: "completing",
        elapsedMs: this.state.elapsedMs,
      });
    let attempt = 0;
    while (!this.controller.signal.aborted) {
      try {
        await this.host.api<{ video: Video }>("complete", {
          videoId: this.state.videoId,
          parts:
            this.uploader?.parts.map(({ partNumber, etag }) => ({
              partNumber,
              etag,
            })) ?? [],
          clientDurationMs: this.state.elapsedMs,
        });
        break;
      } catch (error: unknown) {
        if (!isRetryable(error)) throw error;
        this.patch({ uploadHealthy: false });
        await this.deps.wait(
          Math.min(30_000, 1000 * 2 ** Math.min(attempt++, 5)),
          this.controller.signal,
        );
      }
    }
    this.check(this.run);
    if (this.state.sessionId)
      await this.deps.store.deleteSession(this.state.sessionId);
    this.event("completed");
    this.patch({ uploadHealthy: true, recoveries: [] });
  }
  async cancel() {
    ++this.run;
    this.controller.abort();
    this.uploader?.cancel();
    await this.recorder?.stop().catch(() => undefined);
    await this.release();
    const { videoId, sessionId } = this.state;
    try {
      if (videoId) await this.host.api("abortUpload", { videoId });
      if (sessionId) await this.deps.store.deleteSession(sessionId);
      this.state = { ...initialState };
      await this.initialize();
    } catch (error: unknown) {
      await this.fail(error);
    }
    this.recorder = undefined;
    this.uploader = undefined;
  }
  async recover(sessionId: string, action: "upload" | "discard") {
    if (!["idle", "failed", "done"].includes(this.state.phase)) return;
    const session = (await this.deps.store.listUnfinished()).find(
      (s) => s.sessionId === sessionId,
    );
    if (!session) return;
    ++this.run;
    this.controller = new AbortController();
    this.stopping = undefined;
    this.patch({
      phase: "uploading",
      sessionId,
      videoId: session.videoId,
      shareUrl: session.shareUrl,
      elapsedMs: session.elapsedMs,
      bytesRecorded: session.bytesRecorded,
      error: null,
    });
    try {
      if (action === "discard") {
        try {
          await this.host.api("abortUpload", { videoId: session.videoId });
        } catch (error: unknown) {
          if (errorCode(error) === "VIDEO_NOT_UPLOADING")
            await this.host.api("remove", { videoId: session.videoId });
          else if (errorCode(error) !== "VIDEO_NOT_FOUND") throw error;
        }
        await this.deps.store.deleteSession(sessionId);
        this.state = { ...initialState };
        await this.initialize();
        return;
      }
      this.uploader = this.makeUploader(
        session.videoId,
        Math.max(1, Math.ceil(session.bytesRecorded / session.partSize)),
      );
      let uploaded;
      try {
        uploaded = await this.uploader.resume();
      } catch (error: unknown) {
        if (errorCode(error) !== "VIDEO_NOT_UPLOADING") throw error;
        const { video } = await this.host.api<{ video: Video }>("get", {
          videoId: session.videoId,
        });
        if (video.status !== "processing" && video.status !== "ready")
          throw error;
        await this.deps.store.deleteSession(sessionId);
        this.patch({ phase: "done", recoveries: [] });
        return;
      }
      this.patch({
        bytesUploaded: uploaded.reduce((sum, p) => sum + p.sizeBytes, 0),
      });
      await this.enqueueRecovery(session, uploaded);
      await this.finishUpload();
    } catch (error: unknown) {
      await this.fail(error);
    }
  }
  private async enqueueRecovery(
    session: StoredSession,
    uploaded: { partNumber: number; sizeBytes: number }[],
  ) {
    const chunks = await this.deps.store.readFrom(session.sessionId);
    if (!chunks.length) {
      if (
        uploaded.reduce((sum, part) => sum + part.sizeBytes, 0) !==
        session.bytesRecorded
      )
        throw new RecordingError("RECOVERY_MISSING_PARTS");
      return;
    }
    const firstOffset = chunks[0]?.offset ?? session.bytesRecorded;
    const firstPart = Math.floor(firstOffset / session.partSize) + 1;
    for (let n = 1; n < firstPart; n++)
      if (!uploaded.some((p) => p.partNumber === n))
        throw new RecordingError("RECOVERY_MISSING_PARTS");
    // A retained chunk can start in an acknowledged part. Rebuild from the next full boundary.
    let offset = Math.floor(firstOffset / session.partSize) * session.partSize;
    if (firstOffset > offset) {
      if (!uploaded.some((p) => p.partNumber === firstPart))
        throw new RecordingError("RECOVERY_MISSING_PARTS");
      offset += session.partSize;
    }
    const assembler = new PartAssembler(
      session.partSize,
      Math.floor(offset / session.partSize) + 1,
    );
    for (const chunk of chunks) {
      const start = Math.max(0, offset - chunk.offset);
      if (start >= chunk.blob.size) continue;
      for (const part of assembler.push(chunk.blob.slice(start)))
        this.uploader!.enqueue(part);
    }
    const last = assembler.flush();
    if (last) this.uploader!.enqueue(last);
  }
  async release() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.clearDeadline();
    this.probe?.cancel();
    this.probe = undefined;
    sources.releaseAll(...this.streams);
    this.streams = [];
    if (this.holdsCamera) {
      this.holdsCamera = false;
      this.deps.releaseCamera();
    }
    const composite = this.composite,
      audio = this.audio,
      playback = this.stopPlayback;
    this.composite = undefined;
    this.audio = undefined;
    this.stopPlayback = undefined;
    await Promise.all([composite?.stop(), audio?.stop(), playback?.()]);
  }
  private async fail(error: unknown) {
    if (this.failing) return;
    this.failing = true;
    this.uploader?.cancel();
    await this.recorder?.stop().catch(() => undefined);
    this.recorder = undefined;
    await this.release();
    const code = errorCode(error);
    const pending = await this.deps.store.listUnfinished().catch(() => []);
    this.patch({
      phase: "failed",
      error: { code, messageKey: `video.error.${code}` },
      recoveries: pending.map((s) => ({
        sessionId: s.sessionId,
        createdAt: s.createdAt,
      })),
    });
    this.failing = false;
  }
}
