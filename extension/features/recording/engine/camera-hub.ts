import { breakoutBox } from "./compositor";
import type { BlurEffect } from "./background-blur";

export type CameraUser = "preview" | "engine";
export type BlurStatus = "off" | "loading" | "on" | "unavailable";
export interface CameraHubDependencies {
  open: (deviceId: string) => Promise<MediaStream>;
  createBlur: () => Promise<BlurEffect>;
  /** `reason` is set with "unavailable": a short technical cause, for support. */
  onBlurStatus: (status: BlurStatus, reason?: string) => void;
}

/**
 * The one camera of the offscreen document. It opens the device once and serves every
 * consumer (the bubble preview and the recording) a clone of one generated track. So:
 * - the bubble and the video always show the same picture, blurred or not;
 * - switching the device or toggling the blur never replaces the consumers' track.
 */
export class CameraHub {
  private users = new Map<CameraUser, string>();
  private deviceId: string | null = null;
  private source: MediaStream | null = null;
  private generator: (MediaStreamTrack & { writable: WritableStream<VideoFrame> }) | null =
    null;
  private writer: WritableStreamDefaultWriter<VideoFrame> | null = null;
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private pump = 0;
  private wantBlur = false;
  private blur: BlurEffect | null = null;
  private loadingBlur: Promise<void> | null = null;
  private blurFailed = false;
  private blurFailure: string | undefined;
  constructor(private deps: CameraHubDependencies) {}

  get active() {
    return this.users.size > 0;
  }
  get blurStatus(): BlurStatus {
    if (!this.wantBlur) return "off";
    if (this.blurFailed) return "unavailable";
    return this.blur ? "on" : "loading";
  }

  /** A consumer starts using the camera. Returns its own clone of the shared track. */
  async use(user: CameraUser, deviceId: string): Promise<MediaStream> {
    this.users.set(user, deviceId);
    // The recording's device wins when the two disagree.
    const wanted = this.users.get("engine") ?? deviceId;
    if (wanted !== this.deviceId || !this.source) await this.open(wanted);
    if (!this.generator) throw new DOMException("Camera unavailable", "NotReadableError");
    return new MediaStream([this.generator.clone()]);
  }

  /** A consumer stops. The device closes when nobody uses it. */
  release(user: CameraUser) {
    this.users.delete(user);
    if (!this.users.size) this.stop();
  }

  async setBlur(on: boolean) {
    this.wantBlur = on;
    if (!on) {
      // A failure is not final: turning the blur off and on again retries the load.
      if (!this.loadingBlur) this.blurFailed = false;
      this.deps.onBlurStatus("off");
      return;
    }
    if (this.blur || this.blurFailed) {
      this.report();
      return;
    }
    this.deps.onBlurStatus("loading");
    this.loadingBlur ??= this.deps
      .createBlur()
      .then((effect) => {
        this.blur = effect;
      })
      .catch((error: unknown) => {
        // Diagnostics only: the offscreen console and the bar's tooltip, never the network.
        console.warn("upwin: background blur unavailable", error);
        this.blurFailure = describe(error);
        this.blurFailed = true;
      })
      .finally(() => {
        this.loadingBlur = null;
      });
    await this.loadingBlur;
    this.report();
  }

  private report() {
    const status = this.blurStatus;
    this.deps.onBlurStatus(status, status === "unavailable" ? this.blurFailure : undefined);
  }

  private async open(deviceId: string) {
    const run = ++this.pump;
    const next = await this.deps.open(deviceId);
    if (run !== this.pump) {
      for (const track of next.getTracks()) track.stop();
      return;
    }
    await this.reader?.cancel().catch(() => undefined);
    for (const track of this.source?.getTracks() ?? []) track.stop();
    this.source = next;
    this.deviceId = deviceId;
    const { MediaStreamTrackProcessor, MediaStreamTrackGenerator } = breakoutBox();
    if (!this.generator || this.generator.readyState === "ended") {
      this.generator = new MediaStreamTrackGenerator({ kind: "video" });
      this.writer = this.generator.writable.getWriter();
    }
    const track = next.getVideoTracks()[0];
    if (!track) throw new DOMException("Camera unavailable", "NotReadableError");
    this.reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
    void this.run(run, this.reader);
  }

  private async run(run: number, reader: ReadableStreamDefaultReader<VideoFrame>) {
    try {
      while (run === this.pump) {
        const { value: frame, done } = await reader.read();
        if (done) break;
        if (run !== this.pump || !this.writer) {
          frame.close();
          break;
        }
        let output = frame;
        if (this.wantBlur && this.blur)
          try {
            output = this.blur.process(frame);
          } catch {
            // A failed frame passes through untouched; the next one tries again.
            output = frame;
          }
        try {
          await this.writer.write(output);
        } finally {
          if (output !== frame) output.close();
          frame.close();
        }
      }
    } catch {
      // The source ended or the generator closed: nothing left to pump.
    }
  }

  private stop() {
    ++this.pump;
    void this.reader?.cancel().catch(() => undefined);
    for (const track of this.source?.getTracks() ?? []) track.stop();
    void this.writer?.close().catch(() => undefined);
    this.generator?.stop();
    this.source = this.generator = null;
    this.writer = this.reader = null;
    this.deviceId = null;
  }

  /** Tear everything down, including the model (the offscreen document is closing). */
  close() {
    this.users.clear();
    this.stop();
    this.blur?.close();
    this.blur = null;
  }
}

function describe(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.slice(0, 200);
}
