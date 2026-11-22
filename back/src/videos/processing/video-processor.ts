import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import type { VideoRow } from '../../database/schema';
import { VIDEO_STORAGE, type VideoStorage } from '../storage/video-storage';
import { VideosRepository } from '../videos.repository';
import { assessPlayback, assessRaw } from './assess-media';
import { InvalidMediaError, MEDIA_TOOLS, type MediaTools } from './media-tools';

@Injectable()
export class VideoProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(VideoProcessor.name);
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;
  private stopping = false;
  constructor(
    private readonly repository: VideosRepository,
    @Inject(VIDEO_STORAGE) private readonly storage: VideoStorage | null,
    @Inject(MEDIA_TOOLS) private readonly media: MediaTools,
    private readonly config: ConfigService<Env, true>,
  ) {}
  private enabled() {
    return (
      this.config.get('NODE_ENV', { infer: true }) !== 'test' &&
      this.storage !== null
    );
  }
  onApplicationBootstrap() {
    if (this.enabled())
      this.timer = setInterval(() => {
        void this.kick();
      }, 10000);
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }
  kick(): Promise<void> {
    if (!this.enabled() || this.stopping) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.loop()
      .catch(() => {
        this.logger.warn('Video claim loop failed.');
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }
  private async loop() {
    while (!this.stopping) {
      const row = await this.repository.claim();
      if (!row) return;
      await this.process(row);
    }
  }
  /** Exposed for deterministic pipeline tests; callers in production use kick(). */
  async process(row: VideoRow): Promise<void> {
    if (!this.storage || !row.userId) return;
    const dir = join(tmpdir(), 'upwin-videos', row.id);
    const raw = join(dir, 'raw.mp4');
    const playback = join(dir, 'playback.mp4');
    const poster = join(dir, 'poster.jpg');
    try {
      if (row.processingAttempts > 3) {
        await this.fail(row, 'processing_error');
        return;
      }
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await this.storage.downloadToFile(
        `${row.storagePrefix}raw.mp4`,
        raw,
        row.maxBytes,
      );
      const assessment = assessRaw(await this.media.probe(raw));
      if (!assessment.ok) {
        await this.fail(row, assessment.reason);
        return;
      }
      await this.media.remux(raw, playback, assessment);
      const ready = assessPlayback(await this.media.probe(playback), row);
      if (!ready.ok) {
        await this.fail(row, ready.reason);
        return;
      }
      await this.media.poster(
        playback,
        poster,
        Math.min(1, ready.durationMs / 2000),
      );
      const storage = this.storage;
      await this.repository.withLock(`video:${row.id}`, async () => {
        const beforeUpload = await this.repository.find(row.id);
        if (!beforeUpload || beforeUpload.deletedAt || !beforeUpload.userId) {
          await this.purgeDeleted(row);
          return;
        }
        if (
          beforeUpload.status !== 'processing' ||
          beforeUpload.processingAttempts !== row.processingAttempts
        )
          return;
        await storage.uploadFile(
          `${row.storagePrefix}playback.mp4`,
          playback,
          'video/mp4',
        );
        await storage.uploadFile(
          `${row.storagePrefix}poster.jpg`,
          poster,
          'image/jpeg',
        );
        const latest = await this.repository.find(row.id);
        if (!latest || latest.deletedAt || !latest.userId) {
          await this.purgeDeleted(row);
          return;
        }
        const readyAt = new Date();
        const updated = await this.repository.markReady(
          row.id,
          row.processingAttempts,
          {
            status: 'ready',
            playbackReady: true,
            sizeBytes: (await stat(playback)).size,
            durationMs: ready.durationMs,
            width: ready.width,
            height: ready.height,
            readyAt,
            nextAttemptAt: null,
          },
        );
        if (!updated) {
          const current = await this.repository.find(row.id);
          if (!current || current.deletedAt || !current.userId)
            await this.purgeDeleted(row);
          return;
        }
        try {
          await storage.deletePrefix(`${row.storagePrefix}raw.mp4`);
        } catch {
          this.logger.warn(`Video ${row.id}: raw cleanup failed.`);
        }
      });
    } catch (error: unknown) {
      const latest = await this.repository.find(row.id);
      if (!latest || latest.deletedAt || !latest.userId) {
        await this.repository
          .withLock(`video:${row.id}`, () => this.purgeDeleted(row))
          .catch(() => {
            this.logger.warn(
              `Video ${row.id}: concurrent deletion purge deferred.`,
            );
          });
        return;
      }
      // A newer lease or a committed ready result must never be overwritten.
      if (
        latest.status !== 'processing' ||
        latest.processingAttempts !== row.processingAttempts
      )
        return;
      if (error instanceof InvalidMediaError)
        await this.fail(row, 'invalid_media');
      else if (row.processingAttempts >= 3)
        await this.fail(row, 'processing_error');
      else
        await this.repository.update(row.id, {
          nextAttemptAt: new Date(Date.now() + row.processingAttempts * 60000),
        });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  private async purgeDeleted(row: VideoRow) {
    // A deletion may have purged before the processor finished writing. Reset
    // its marker before cleanup so a failed second purge remains retryable.
    await this.repository.update(row.id, { storagePurgedAt: null });
    await this.storage?.deletePrefix(row.storagePrefix);
    await this.repository.update(row.id, { storagePurgedAt: new Date() });
  }
  private async fail(
    row: VideoRow,
    reason: NonNullable<VideoRow['failureReason']>,
  ) {
    const failed = await this.repository.markFailed(
      row.id,
      row.processingAttempts,
      reason,
    );
    if (!failed) return;
    try {
      await this.storage?.deletePrefix(row.storagePrefix);
      await this.repository.update(row.id, { storagePurgedAt: new Date() });
    } catch {
      this.logger.warn(`Video ${row.id}: failure purge deferred.`);
    }
  }

}
