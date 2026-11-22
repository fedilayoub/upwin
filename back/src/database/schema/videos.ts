import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { jobSnapshots } from './job-snapshots';

export const VIDEO_STATUSES = [
  'uploading',
  'processing',
  'ready',
  'failed',
] as const;
export const VIDEO_SOURCE_KINDS = ['screen', 'window', 'tab', 'area'] as const;
export const VIDEO_FAILURE_REASONS = [
  'upload_abandoned',
  'invalid_media',
  'too_long',
  'processing_error',
] as const;
export const videos = pgTable(
  'videos',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    status: text('status').$type<(typeof VIDEO_STATUSES)[number]>().notNull(),
    failureReason:
      text('failure_reason').$type<(typeof VIDEO_FAILURE_REASONS)[number]>(),
    sourceKind: text('source_kind')
      .$type<(typeof VIDEO_SOURCE_KINDS)[number]>()
      .notNull(),
    hasCamera: boolean('has_camera').notNull(),
    hasAudio: boolean('has_audio').notNull(),
    jobSnapshotId: uuid('job_snapshot_id').references(() => jobSnapshots.id, {
      onDelete: 'set null',
    }),
    storagePrefix: text('storage_prefix').notNull(),
    uploadId: text('upload_id'),
    partSizeBytes: integer('part_size_bytes').notNull(),
    maxBytes: bigint('max_bytes', { mode: 'number' }).notNull(),
    maxDurationMs: integer('max_duration_ms').notNull(),
    rawSizeBytes: bigint('raw_size_bytes', { mode: 'number' }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    durationMs: integer('duration_ms'),
    width: integer('width'),
    height: integer('height'),
    playbackReady: boolean('playback_ready').notNull().default(false),
    processingAttempts: integer('processing_attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    storagePurgedAt: timestamp('storage_purged_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'videos_title_length',
      sql`char_length(${t.title}) between 1 and 120`,
    ),
    check(
      'videos_status',
      sql`${t.status} in ('uploading','processing','ready','failed')`,
    ),
    check(
      'videos_failure_reason',
      sql`${t.failureReason} in ('upload_abandoned','invalid_media','too_long','processing_error')`,
    ),
    check(
      'videos_failure_status',
      sql`(${t.status} = 'failed') = (${t.failureReason} is not null)`,
    ),
    check(
      'videos_source_kind',
      sql`${t.sourceKind} in ('screen','window','tab','area')`,
    ),
    check('videos_view_count', sql`${t.viewCount} >= 0`),
    index('videos_user_created_idx')
      .on(t.userId, t.createdAt.desc())
      .where(sql`${t.deletedAt} is null`),
    index('videos_processing_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'processing'`),
    index('videos_uploading_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'uploading'`),
    index('videos_job_snapshot_idx')
      .on(t.jobSnapshotId)
      .where(sql`${t.jobSnapshotId} is not null`),
  ],
);
export type VideoRow = typeof videos.$inferSelect;
export type NewVideoRow = typeof videos.$inferInsert;

/**
 * One counted view of a shared video: how much of it was watched. It holds no viewer identity
 * (no account, IP, cookie or browser id); the id is a random handle the share page uses to
 * report progress for that one view.
 */
export const videoViews = pgTable(
  'video_views',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Distinct video time played (the union of played ranges), never above the duration. */
    watchedMs: integer('watched_ms').notNull().default(0),
    finished: boolean('finished').notNull().default(false),
  },
  (t) => [
    check('video_views_watched_ms', sql`${t.watchedMs} >= 0`),
    index('video_views_video_idx').on(t.videoId),
  ],
);
export type VideoViewRow = typeof videoViews.$inferSelect;
