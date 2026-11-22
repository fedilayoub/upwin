import type {
  ListUploadedPartsResponse,
  PresignPartsResponse,
} from "@/types/video";
import type { EngineHost } from "./host";
import { RecordingError, isRetryable } from "./host";
import type { Part } from "./part-assembler";
interface Options {
  fetch?: typeof fetch;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
  healthy?: (healthy: boolean) => void;
  failed?: (error: unknown) => void;
  uploaded?: (part: {
    partNumber: number;
    etag: string;
    sizeBytes: number;
  }) => Promise<void>;
}
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const aborted = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", aborted);
      resolve();
    }, ms);
    signal?.addEventListener("abort", aborted, { once: true });
  });
}
export class Uploader {
  private queue: Part[] = [];
  private active = 0;
  private urls = new Map<number, PresignPartsResponse["parts"][number]>();
  private signing?: Promise<void>;
  private acknowledged = new Map<
    number,
    { partNumber: number; etag: string; sizeBytes: number }
  >();
  private pending = new Set<number>();
  private retries = new Set<number>();
  private fatal: unknown;
  private stopped = new AbortController();
  private drains: { resolve: () => void; reject: (error: unknown) => void }[] =
    [];
  constructor(
    private videoId: string,
    private maxParts: number,
    private host: EngineHost,
    private options: Options = {},
  ) {}
  enqueue(part: Part) {
    if (part.partNumber > this.maxParts) {
      this.fail(new RecordingError("VIDEO_TOO_LARGE"));
      return;
    }
    if (
      this.acknowledged.has(part.partNumber) ||
      this.pending.has(part.partNumber)
    )
      return;
    this.queue.push(part);
    this.pending.add(part.partNumber);
    this.pump();
  }
  get parts() {
    return [...this.acknowledged.values()].sort(
      (a, b) => a.partNumber - b.partNumber,
    );
  }
  async resume() {
    const response = await this.host.api<ListUploadedPartsResponse>(
      "listUploadedParts",
      { videoId: this.videoId },
    );
    this.acknowledged.clear();
    for (const part of response.parts)
      this.acknowledged.set(part.partNumber, part);
    return response.parts;
  }
  drain(): Promise<void> {
    if (this.fatal) return Promise.reject(this.fatal);
    if (!this.active && !this.queue.length) return Promise.resolve();
    return new Promise((resolve, reject) =>
      this.drains.push({ resolve, reject }),
    );
  }
  cancel() {
    this.stopped.abort();
    this.fail(new DOMException("Cancelled", "AbortError"));
    this.urls.clear();
    this.queue = [];
  }
  private fail(error: unknown) {
    if (!this.fatal && !this.stopped.signal.aborted)
      this.options.failed?.(error);
    this.fatal ??= error;
    this.queue = [];
    for (const d of this.drains.splice(0)) d.reject(this.fatal);
  }
  private pump() {
    if (this.fatal || this.stopped.signal.aborted) return;
    while (this.active < 2 && this.queue.length) {
      const part = this.queue.shift()!;
      this.active++;
      void this.send(part)
        .catch((error) => this.fail(error))
        .finally(() => {
          this.active--;
          this.pending.delete(part.partNumber);
          if (!this.active && !this.queue.length)
            for (const d of this.drains.splice(0))
              this.fatal ? d.reject(this.fatal) : d.resolve();
          this.pump();
        });
    }
  }
  private async url(part: number) {
    const valid = () => {
      const url = this.urls.get(part);
      return url && Date.parse(url.expiresAt) - this.host.now() > 300_000
        ? url.url
        : null;
    };
    if (valid()) return valid()!;
    if (this.signing) await this.signing;
    if (valid()) return valid()!;
    this.signing = (async () => {
      const partNumbers = Array.from(
        { length: Math.min(10, this.maxParts - part + 1) },
        (_, n) => part + n,
      );
      const response = await this.host.api<PresignPartsResponse>(
        "presignParts",
        { videoId: this.videoId, partNumbers },
      );
      for (const entry of response.parts)
        this.urls.set(entry.partNumber, entry);
    })();
    try {
      await this.signing;
    } finally {
      this.signing = undefined;
    }
    const url = valid();
    if (!url) throw new RecordingError("VIDEO_STORAGE_ERROR");
    return url;
  }
  private async send(part: Part) {
    let attempt = 0;
    while (!this.stopped.signal.aborted) {
      try {
        const url = await this.url(part.partNumber);
        const response = await (this.options.fetch ?? globalThis.fetch)(url, {
          method: "PUT",
          body: part.blob,
          signal: this.stopped.signal,
        });
        if (response.status === 403) {
          this.urls.delete(part.partNumber);
          throw new TypeError("Expired upload URL");
        }
        if (response.status >= 500) throw new TypeError("Storage unavailable");
        if (!response.ok) throw new RecordingError("UPLOAD_REJECTED");
        const etag = response.headers.get("ETag");
        if (!etag) throw new RecordingError("UPLOAD_CORS");
        const ack = {
          partNumber: part.partNumber,
          etag,
          sizeBytes: part.blob.size,
        };
        await this.options.uploaded?.(ack);
        this.acknowledged.set(part.partNumber, ack);
        this.retries.delete(part.partNumber);
        this.options.healthy?.(this.retries.size === 0);
        return;
      } catch (error: unknown) {
        if (this.stopped.signal.aborted || !isRetryable(error)) throw error;
        this.retries.add(part.partNumber);
        this.options.healthy?.(false);
        const delay =
          Math.min(30_000, 1000 * 2 ** Math.min(attempt++, 5)) *
          (0.8 + (this.options.random ?? Math.random)() * 0.4);
        await (this.options.wait ?? wait)(delay, this.stopped.signal);
      }
    }
  }
}
