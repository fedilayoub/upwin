import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  jobSnapshots,
  profileSnapshots,
  videoViews,
  videos,
  type NewVideoRow,
  type VideoRow,
} from '../database/schema';

/** What the owner sees about how a video was watched. */
export interface VideoWatchStats {
  finishedViews: number;
  /** Mean share of the video each tracked view watched, 0..100; null before any. */
  averageWatchedPercent: number | null;
  watchTimeMs: number;
}
export const NO_WATCH_STATS: VideoWatchStats = {
  finishedViews: 0,
  averageWatchedPercent: null,
  watchTimeMs: 0,
};

export type VideoCursor = { createdAt: string; id: string };
export const REAPER_LOCK_ID = '328100200601';
@Injectable()
export class VideosRepository {
  // Lock callbacks use ordinary repository calls. Leave six of the
  // pool's ten connections available so waiting locks cannot exhaust the pool.
  private lockSlots = 4;
  private readonly lockWaiters: Array<() => void> = [];
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async insert(values: NewVideoRow): Promise<VideoRow> {
    const [row] = await this.db.insert(videos).values(values).returning();
    if (!row) throw new Error('Video insert returned no row.');
    return row;
  }
  async find(id: string) {
    return (
      await this.db.select().from(videos).where(eq(videos.id, id)).limit(1)
    )[0];
  }
  async findOwned(userId: string, id: string) {
    return (
      await this.db
        .select()
        .from(videos)
        .where(
          and(
            eq(videos.id, id),
            eq(videos.userId, userId),
            isNull(videos.deletedAt),
          ),
        )
        .limit(1)
    )[0];
  }
  async findBySlug(slug: string) {
    return (
      await this.db.select().from(videos).where(eq(videos.slug, slug)).limit(1)
    )[0];
  }
  async ownsJob(userId: string, id: string) {
    return Boolean(
      (
        await this.db
          .select({ id: jobSnapshots.id })
          .from(jobSnapshots)
          .where(and(eq(jobSnapshots.id, id), eq(jobSnapshots.userId, userId)))
          .limit(1)
      )[0],
    );
  }
  /** The name on the owner's latest captured profile that has one; null before any. */
  async ownerName(userId: string) {
    return (
      (
        await this.db
          .select({ name: profileSnapshots.name })
          .from(profileSnapshots)
          .where(
            and(
              eq(profileSnapshots.userId, userId),
              isNotNull(profileSnapshots.name),
            ),
          )
          .orderBy(desc(profileSnapshots.capturedAt))
          .limit(1)
      )[0]?.name ?? null
    );
  }

  async update(id: string, patch: Partial<NewVideoRow>) {
    return (
      await this.db
        .update(videos)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(videos.id, id))
        .returning()
    )[0];
  }
  async markReady(id: string, attempt: number, patch: Partial<NewVideoRow>) {
    return (
      await this.db
        .update(videos)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(videos.id, id),
            eq(videos.status, 'processing'),
            eq(videos.processingAttempts, attempt),
            isNull(videos.deletedAt),
            isNotNull(videos.userId),
          ),
        )
        .returning()
    )[0];
  }
  async hardDelete(id: string) {
    await this.db.delete(videos).where(eq(videos.id, id));
  }
  async markFailed(
    id: string,
    attempt: number,
    reason: NonNullable<VideoRow['failureReason']>,
  ) {
    return (
      await this.db
        .update(videos)
        .set({
          status: 'failed',
          failureReason: reason,
          nextAttemptAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(videos.id, id),
            eq(videos.status, 'processing'),
            eq(videos.processingAttempts, attempt),
            isNull(videos.deletedAt),
          ),
        )
        .returning()
    )[0];
  }
  async storageUsed(userId: string): Promise<number> {
    const [row] = await this.db
      .select({
        bytes: sql<string>`coalesce(sum(case when status = 'ready' then size_bytes when status = 'processing' then raw_size_bytes when status = 'uploading' then max_bytes else 0 end), 0)`,
      })
      .from(videos)
      .where(and(eq(videos.userId, userId), isNull(videos.deletedAt)));
    return Number(row?.bytes ?? 0);
  }
  list(
    userId: string,
    limit: number,
    cursor?: VideoCursor,
    jobSnapshotId?: string,
  ) {
    return this.db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.userId, userId),
          isNull(videos.deletedAt),
          ne(videos.status, 'uploading'),
          cursor
            ? sql`(${videos.createdAt}, ${videos.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
            : undefined,
          jobSnapshotId ? eq(videos.jobSnapshotId, jobSnapshotId) : undefined,
        ),
      )
      .orderBy(desc(videos.createdAt), desc(videos.id))
      .limit(limit + 1);
  }

  /** Serialize create headroom checks and upload mutations across API instances. */
  async withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (this.lockSlots === 0)
      await new Promise<void>((resolve) => this.lockWaiters.push(resolve));
    else this.lockSlots--;
    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${key}, 32))`,
        );
        return work();
      });
    } finally {
      const next = this.lockWaiters.shift();
      if (next) next();
      else this.lockSlots++;
    }
  }
  async claim(): Promise<VideoRow | undefined> {
    return this.db.transaction(async (tx) => {
      const result = await tx.execute<
        { id: string } & Record<string, unknown>
      >(sql`
        update videos set processing_attempts = processing_attempts + 1,
          next_attempt_at = now() + interval '15 minutes', updated_at = now()
        where id = (select id from videos where status = 'processing'
          and deleted_at is null and user_id is not null and next_attempt_at <= now()
          order by next_attempt_at for update skip locked limit 1)
        returning id`);
      const id = result.rows[0]?.id;
      return id
        ? (await tx.select().from(videos).where(eq(videos.id, id)))[0]
        : undefined;
    });
  }


  /** Counts a view and opens its progress row, in one transaction. Null when not countable. */
  async recordView(slug: string): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [video] = await tx
        .update(videos)
        .set({
          viewCount: sql`${videos.viewCount} + 1`,
          lastViewedAt: new Date(),
        })
        .where(
          and(
            eq(videos.slug, slug),
            eq(videos.status, 'ready'),
            isNull(videos.deletedAt),
            isNotNull(videos.userId),
          ),
        )
        .returning({ id: videos.id });
      if (!video) return null;
      const id = randomUUID();
      await tx.insert(videoViews).values({ id, videoId: video.id });
      return id;
    });
  }
  /**
   * Progress for one view, from the share page. Only ever raises what was watched, capped at
   * the video's duration; a view older than 12 hours is closed.
   */
  async recordProgress(
    slug: string,
    viewId: string,
    watchedMs: number,
    finished: boolean,
  ): Promise<void> {
    await this.db.execute(sql`
      update ${videoViews} as v
      set watched_ms = greatest(v.watched_ms, least(${watchedMs}, coalesce(vid.duration_ms, 0))),
          finished = v.finished or ${finished}
            or least(${watchedMs}, coalesce(vid.duration_ms, 0)) >= 0.95 * coalesce(vid.duration_ms, 0),
          updated_at = now()
      from ${videos} as vid
      where v.id = ${viewId} and v.video_id = vid.id and vid.slug = ${slug}
        and vid.deleted_at is null and vid.duration_ms > 0
        and v.started_at > now() - interval '12 hours'
    `);
  }
  async watchStats(ids: string[]): Promise<Map<string, VideoWatchStats>> {
    const stats = new Map<string, VideoWatchStats>();
    if (!ids.length) return stats;
    const rows = await this.db
      .select({
        videoId: videoViews.videoId,
        finished: sql<number>`count(*) filter (where ${videoViews.finished})::int`,
        watched: sql<number>`coalesce(sum(${videoViews.watchedMs}), 0)::bigint`,
        average: sql<
          number | null
        >`avg(least(1, ${videoViews.watchedMs}::float / nullif(${videos.durationMs}, 0)))`,
      })
      .from(videoViews)
      .innerJoin(videos, eq(videos.id, videoViews.videoId))
      .where(inArray(videoViews.videoId, ids))
      .groupBy(videoViews.videoId);
    for (const row of rows)
      stats.set(row.videoId, {
        finishedViews: Number(row.finished),
        averageWatchedPercent:
          row.average === null ? null : Math.round(Number(row.average) * 100),
        watchTimeMs: Number(row.watched),
      });
    return stats;
  }

  /** Session advisory locks must stay on the same dedicated pool connection. */
  async withReaperLock(work: () => Promise<void>): Promise<boolean> {
    const client = await this.db.$client.connect();
    let acquired = false;
    try {
      const result = await client.query<{ acquired: boolean }>(
        'select pg_try_advisory_lock($1::bigint) as acquired',
        [REAPER_LOCK_ID],
      );
      acquired = result.rows[0]?.acquired === true;
      if (!acquired) return false;
      await work();
      return true;
    } finally {
      try {
        if (acquired)
          await client.query('select pg_advisory_unlock($1::bigint)', [
            REAPER_LOCK_ID,
          ]);
      } finally {
        client.release();
      }
    }
  }
  candidates(
    task: 'abandoned' | 'orphans' | 'purge' | 'housekeeping',
  ) {
    const conditions: Record<typeof task, SQL | undefined> = {
      abandoned: and(
        eq(videos.status, 'uploading'),
        lt(videos.createdAt, new Date(Date.now() - 86400000)),
        isNull(videos.deletedAt),
      ),
      orphans: isNull(videos.userId),
      purge: and(
        or(isNotNull(videos.deletedAt), eq(videos.status, 'failed')),
        isNull(videos.storagePurgedAt),
      ),
      housekeeping: and(
        eq(videos.status, 'failed'),
        lt(videos.updatedAt, new Date(Date.now() - 7 * 86400000)),
        isNotNull(videos.storagePurgedAt),
      ),
    };
    return this.db
      .select()
      .from(videos)
      .where(conditions[task])
      .orderBy(videos.createdAt)
      .limit(50);
  }

}
