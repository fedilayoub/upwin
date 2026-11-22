import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  digestToken,
  extractBearerToken,
  tokenMatches,
} from '../auth/local-access';
import type { Env } from '../config/env.schema';
import type { VideoRow } from '../database/schema';
import { VideoProcessor } from './processing/video-processor';
import { generateVideoSlug } from './slug';
import { VIDEO_STORAGE, type VideoStorage } from './storage/video-storage';
import { videoDto } from './video-dto';
import {
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_MS,
  VIDEO_PART_SIZE_BYTES,
} from './video-limits';
import { defaultVideoTitle } from './video-title';
import { videoError } from './video.errors';
import {
  NO_WATCH_STATS,
  VideosRepository,
  type VideoCursor,
  type VideoWatchStats,
} from './videos.repository';
import {
  type CompleteVideoDto,
  type CreateVideoDto,
  type VideoListDto,
  videoCursorSchema,
  viewProgressSchema,
} from './videos.schema';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly ownerTokenDigest: Buffer | null;
  constructor(
    private readonly repository: VideosRepository,
    private readonly processor: VideoProcessor,
    @Inject(VIDEO_STORAGE) private readonly storage: VideoStorage | null,
    private readonly config: ConfigService<Env, true>,
  ) {
    // Blank means unset; see LocalAuthGuard.
    const token = config.get('API_TOKEN', { infer: true });
    this.ownerTokenDigest = token ? digestToken(token) : null;
  }
  private requireStorage(): VideoStorage {
    if (!this.storage) throw videoError('VIDEO_NOT_CONFIGURED');
    return this.storage;
  }
  private async dto(row: VideoRow, stats?: VideoWatchStats) {
    return videoDto(
      row,
      this.config.getOrThrow('APP_URL', { infer: true }),
      this.storage,
      stats ??
        (await this.repository.watchStats([row.id])).get(row.id) ??
        NO_WATCH_STATS,
    );
  }
  private async owned(userId: string, id: string) {
    if (!z.uuid().safeParse(id).success) throw videoError('VIDEO_NOT_FOUND');
    const row = await this.repository.findOwned(userId, id);
    if (!row) throw videoError('VIDEO_NOT_FOUND');
    return row;
  }
  private uploading(row: VideoRow): string {
    if (row.status !== 'uploading' || !row.uploadId)
      throw videoError('VIDEO_NOT_UPLOADING');
    return row.uploadId;
  }
  async limits(userId: string) {
    return {
      available: this.storage !== null,
      storage: { usedBytes: await this.repository.storageUsed(userId) },
      maxDurationMs: VIDEO_MAX_DURATION_MS,
      maxBytes: VIDEO_MAX_BYTES,
    };
  }
  async create(userId: string, input: CreateVideoDto) {
    const storage = this.requireStorage();
    return this.repository.withLock(`video-owner:${userId}`, async () => {
      if (
        input.jobSnapshotId &&
        !(await this.repository.ownsJob(userId, input.jobSnapshotId))
      )
        throw videoError('VIDEO_NOT_FOUND');
      const id = randomUUID();
      const prefix = `videos/${userId}/${id}/`;
      let uploadId: string | undefined;
      let row: VideoRow;
      try {
        uploadId = (
          await storage.createMultipartUpload(`${prefix}raw.mp4`, 'video/mp4')
        ).uploadId;
        const title =
          input.title ??
          defaultVideoTitle(
            await this.repository.ownerName(userId),
            Boolean(input.jobSnapshotId),
          );
        for (let attempt = 0; ; attempt++) {
          try {
            row = await this.repository.insert({
              id,
              userId,
              slug: generateVideoSlug(),
              title,
              status: 'uploading',
              sourceKind: input.sourceKind,
              hasCamera: input.hasCamera,
              hasAudio: input.hasAudio,
              jobSnapshotId: input.jobSnapshotId ?? null,
              storagePrefix: prefix,
              uploadId,
              partSizeBytes: VIDEO_PART_SIZE_BYTES,
              maxBytes: VIDEO_MAX_BYTES,
              maxDurationMs: VIDEO_MAX_DURATION_MS,
            });
            break;
          } catch (error: unknown) {
            if (attempt >= 3 || !isSlugCollision(error)) throw error;
          }
        }
      } catch (error: unknown) {
        try {
          if (uploadId)
            await storage.abortMultipartUpload(`${prefix}raw.mp4`, uploadId);
        } catch {
          this.logger.warn(`Video ${id}: create abort failed.`);
        }
        throw error;
      }
      return {
        video: await this.dto(row, NO_WATCH_STATS),
        upload: {
          partSizeBytes: row.partSizeBytes,
          maxParts: row.maxBytes / row.partSizeBytes,
          maxBytes: row.maxBytes,
          maxDurationMs: row.maxDurationMs,
        },
      };
    });
  }
  async presignParts(userId: string, id: string, numbers: number[]) {
    const storage = this.requireStorage();
    const row = await this.owned(userId, id);
    const uploadId = this.uploading(row);
    if (
      numbers.length < 1 ||
      numbers.length > 10 ||
      new Set(numbers).size !== numbers.length ||
      numbers.some(
        (n) =>
          !Number.isInteger(n) || n < 1 || n > row.maxBytes / row.partSizeBytes,
      )
    )
      throw videoError('VIDEO_TOO_LARGE');
    return {
      parts: await Promise.all(
        numbers.map(async (partNumber) => ({
          partNumber,
          url: await storage.presignUploadPart(
            `${row.storagePrefix}raw.mp4`,
            uploadId,
            partNumber,
            3600,
          ),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        })),
      ),
    };
  }
  async listParts(userId: string, id: string) {
    const storage = this.requireStorage();
    const row = await this.owned(userId, id);
    return {
      parts: await storage.listParts(
        `${row.storagePrefix}raw.mp4`,
        this.uploading(row),
      ),
    };
  }
  async complete(userId: string, id: string, input: CompleteVideoDto) {
    const storage = this.requireStorage();
    return this.repository.withLock(`video:${id}`, async () => {
      const row = await this.owned(userId, id);
      if (row.status === 'processing' || row.status === 'ready')
        return { video: await this.dto(row) };
      const uploadId = this.uploading(row);
      const parts = await storage.listParts(
        `${row.storagePrefix}raw.mp4`,
        uploadId,
      );
      const total = parts.reduce((sum, p) => sum + p.sizeBytes, 0);
      if (total > row.maxBytes) {
        await this.repository.update(id, {
          status: 'failed',
          failureReason: 'invalid_media',
        });
        try {
          await storage.abortMultipartUpload(
            `${row.storagePrefix}raw.mp4`,
            uploadId,
          );
          await storage.deletePrefix(row.storagePrefix);
          await this.repository.update(id, {
            storagePurgedAt: new Date(),
            uploadId: null,
          });
        } catch {
          this.logger.warn(`Video ${id}: oversized purge deferred.`);
        }
        throw videoError('VIDEO_TOO_LARGE');
      }
      if (
        !parts.length ||
        parts.length !== input.parts.length ||
        parts.some(
          (p, i) =>
            p.partNumber !== i + 1 ||
            input.parts[i]?.partNumber !== p.partNumber ||
            input.parts[i]?.etag !== p.etag ||
            p.sizeBytes <= 0 ||
            p.sizeBytes > row.partSizeBytes ||
            (i < parts.length - 1 && p.sizeBytes !== row.partSizeBytes),
        )
      )
        throw videoError('VIDEO_UPLOAD_INVALID');
      await storage.completeMultipartUpload(
        `${row.storagePrefix}raw.mp4`,
        uploadId,
        parts,
      );
      const updated = await this.repository.update(id, {
        status: 'processing',
        rawSizeBytes: total,
        uploadId: null,
        nextAttemptAt: new Date(),
      });
      if (!updated) throw videoError('VIDEO_NOT_FOUND');
      void this.processor.kick();
      return { video: await this.dto(updated) };
    });
  }
  async abort(userId: string, id: string) {
    const storage = this.requireStorage();
    await this.repository.withLock(`video:${id}`, async () => {
      const row = await this.owned(userId, id);
      await storage.abortMultipartUpload(
        `${row.storagePrefix}raw.mp4`,
        this.uploading(row),
      );
      await storage.deletePrefix(row.storagePrefix);
      await this.repository.hardDelete(id);
    });
  }
  async list(userId: string, query: VideoListDto) {
    let cursor: VideoCursor | undefined;
    if (query.cursor) {
      try {
        cursor = videoCursorSchema.parse(
          JSON.parse(
            Buffer.from(query.cursor, 'base64url').toString(),
          ) as unknown,
        );
      } catch {
        throw videoError('VALIDATION_FAILED');
      }
    }
    const rows = await this.repository.list(
      userId,
      query.limit,
      cursor,
      query.jobSnapshotId,
    );
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const stats = await this.repository.watchStats(items.map((row) => row.id));
    return {
      items: await Promise.all(
        items.map((row) => this.dto(row, stats.get(row.id) ?? NO_WATCH_STATS)),
      ),
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(
              JSON.stringify({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }
  async get(userId: string, id: string) {
    return { video: await this.dto(await this.owned(userId, id)) };
  }
  async update(userId: string, id: string, title: string) {
    return this.repository.withLock(`video:${id}`, async () => {
      await this.owned(userId, id);
      const row = await this.repository.update(id, { title });
      if (!row) throw videoError('VIDEO_NOT_FOUND');
      return { video: await this.dto(row) };
    });
  }
  async delete(userId: string, id: string) {
    await this.repository.withLock(`video:${id}`, async () => {
      const row = await this.owned(userId, id);
      await this.repository.update(id, { deletedAt: new Date() });
      await this.purge(row);
    });
  }
  private async purge(row: VideoRow) {
    if (!this.storage) return;
    try {
      if (row.uploadId)
        await this.storage.abortMultipartUpload(
          `${row.storagePrefix}raw.mp4`,
          row.uploadId,
        );
      await this.storage.deletePrefix(row.storagePrefix);
      await this.repository.update(row.id, {
        storagePurgedAt: new Date(),
        uploadId: null,
      });
    } catch {
      this.logger.warn(`Video ${row.id}: purge deferred.`);
    }
  }
  async publicVideo(slug: string) {
    if (!/^[0-9A-Za-z]{12}$/.test(slug)) throw videoError('VIDEO_NOT_FOUND');
    const row = await this.repository.findBySlug(slug);
    if (!row || !row.userId || row.deletedAt)
      throw videoError('VIDEO_NOT_FOUND');
    if (row.status !== 'ready' && row.status !== 'processing')
      throw videoError('VIDEO_NOT_FOUND');
    const storage = row.status === 'ready' ? this.requireStorage() : null;
    return {
      slug: row.slug,
      title: row.title,
      status: row.status,
      durationMs: row.durationMs,
      width: row.width,
      height: row.height,
      playbackUrl:
        storage && row.playbackReady
          ? await storage.presignGet(`${row.storagePrefix}playback.mp4`, 10800)
          : null,
      posterUrl:
        storage && row.playbackReady
          ? await storage.presignGet(`${row.storagePrefix}poster.jpg`, 10800)
          : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
  /**
   * A play on the share page. The owner's own plays are not counted, so the numbers are about
   * the people the link was sent to. The owner is whoever presents the API's API_TOKEN: the web
   * app sends it for a visitor who unlocked the app. Never throws: a view ping must not affect
   * playback.
   */
  async view(
    slug: string,
    authorization?: string,
  ): Promise<{ counted: boolean; owner: boolean; viewId: string | null }> {
    const none = { counted: false, owner: false, viewId: null };
    if (!/^[0-9A-Za-z]{12}$/.test(slug)) return none;
    const bearer = extractBearerToken(authorization);
    if (
      bearer &&
      this.ownerTokenDigest &&
      tokenMatches(bearer, this.ownerTokenDigest)
    )
      return { counted: false, owner: true, viewId: null };
    try {
      const viewId = await this.repository.recordView(slug);
      return { counted: viewId !== null, owner: false, viewId };
    } catch {
      this.logger.warn('Video view count update deferred.');
      return none;
    }
  }
  /** How much of one counted view was watched. Silently ignores anything malformed. */
  async viewProgress(slug: string, viewId: string, body: unknown) {
    if (!/^[0-9A-Za-z]{12}$/.test(slug) || !z.uuid().safeParse(viewId).success)
      return;
    const parsed = viewProgressSchema.safeParse(body);
    if (!parsed.success) return;
    try {
      await this.repository.recordProgress(
        slug,
        viewId,
        parsed.data.watchedMs,
        parsed.data.finished,
      );
    } catch {
      this.logger.warn('Video view progress update deferred.');
    }
  }

}
function isSlugCollision(error: unknown) {
  const candidates = [error, error instanceof Error ? error.cause : undefined];
  return candidates.some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      e.code === '23505' &&
      'constraint' in e &&
      e.constraint === 'videos_slug_unique',
  );
}
