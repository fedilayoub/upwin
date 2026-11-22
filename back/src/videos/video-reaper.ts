import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { VIDEO_STORAGE, type VideoStorage } from './storage/video-storage';
import { VideosRepository } from './videos.repository';

@Injectable()
export class VideoReaper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(VideoReaper.name);
  private interval?: ReturnType<typeof setInterval>;
  private bootTimer?: ReturnType<typeof setTimeout>;
  private inFlight?: Promise<void>;
  constructor(
    private readonly repository: VideosRepository,
    @Inject(VIDEO_STORAGE) private readonly storage: VideoStorage | null,
    private readonly config: ConfigService<Env, true>,
  ) {}
  onApplicationBootstrap() {
    if (
      this.config.get('NODE_ENV', { infer: true }) === 'test' ||
      !this.storage
    )
      return;
    this.bootTimer = setTimeout(() => {
      void this.run();
    }, 60000);
    this.interval = setInterval(() => {
      void this.run();
    }, 3600000);
  }
  async onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
    if (this.bootTimer) clearTimeout(this.bootTimer);
    await this.inFlight;
  }
  run(): Promise<void> {
    if (!this.storage) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.repository
      .withReaperLock(() => this.reap())
      .then(() => undefined)
      .catch(() => {
        this.logger.warn('Video reaper pass failed.');
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }
  private async reap() {
    const storage = this.storage;
    if (!storage) return;
    for (const task of [
      'abandoned',
      'orphans',
      'purge',
      'housekeeping',
    ] as const) {
      for (const row of await this.repository.candidates(task)) {
        try {
          await this.repository.withLock(`video:${row.id}`, async () => {
            const current = await this.repository.find(row.id);
            if (!current) return;
            if (task === 'abandoned') {
              if (current.status !== 'uploading' || current.deletedAt) return;
              if (current.uploadId)
                await storage.abortMultipartUpload(
                  `${current.storagePrefix}raw.mp4`,
                  current.uploadId,
                );
              await storage.deletePrefix(current.storagePrefix);
              await this.repository.update(current.id, {
                status: 'failed',
                failureReason: 'upload_abandoned',
                uploadId: null,
                storagePurgedAt: new Date(),
              });
            } else if (task === 'orphans') {
              if (current.userId) return;
              if (current.uploadId)
                await storage.abortMultipartUpload(
                  `${current.storagePrefix}raw.mp4`,
                  current.uploadId,
                );
              await storage.deletePrefix(current.storagePrefix);
              await this.repository.hardDelete(current.id);
            } else if (task === 'purge') {
              if (!current.deletedAt && current.status !== 'failed') return;
              if (!current.storagePurgedAt) {
                if (current.uploadId)
                  await storage.abortMultipartUpload(
                    `${current.storagePrefix}raw.mp4`,
                    current.uploadId,
                  );
                await storage.deletePrefix(current.storagePrefix);
                await this.repository.update(current.id, {
                  storagePurgedAt: new Date(),
                  uploadId: null,
                });
              }
            } else await this.repository.hardDelete(current.id);
          });
        } catch {
          this.logger.warn(`Video ${row.id}: ${task} deferred.`);
        }
      }
    }
  }
}
