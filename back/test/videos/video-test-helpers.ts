import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import type { Env } from '../../src/config/env.schema';
import type { NewVideoRow, VideoRow } from '../../src/database/schema';
export const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
export const VIDEO_ID = '218f6a77-4e90-4ab5-a3bf-15c8f850fa1a';
export function videoRow(patch: Partial<VideoRow> = {}): VideoRow {
  return {
    id: VIDEO_ID,
    userId: USER_ID,
    slug: '012345AbcDef',
    title: 'Demo',
    status: 'uploading',
    failureReason: null,
    sourceKind: 'screen',
    hasCamera: false,
    hasAudio: true,
    jobSnapshotId: null,
    storagePrefix: `videos/${USER_ID}/${VIDEO_ID}/`,
    uploadId: 'upload-0',
    partSizeBytes: 8388608,
    maxBytes: 167772160,
    maxDurationMs: 300000,
    rawSizeBytes: null,
    sizeBytes: null,
    durationMs: null,
    width: null,
    height: null,
    playbackReady: false,
    processingAttempts: 0,
    nextAttemptAt: null,
    viewCount: 0,
    lastViewedAt: null,
    deletedAt: null,
    storagePurgedAt: null,
    createdAt: new Date('2026-11-08T12:00:00Z'),
    updatedAt: new Date('2026-11-08T12:00:00Z'),
    readyAt: null,
    ...patch,
  };
}
export const OWNER_API_TOKEN = 'owner-api-token-0123456789';
export function videoConfig(patch: Partial<Env> = {}) {
  return new ConfigService<Env, true>({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:3000',
    API_TOKEN: OWNER_API_TOKEN,
    ...patch,
  } as Env);
}
export function fakeRepository(initial: VideoRow = videoRow()) {
  const rows = new Map<string, VideoRow>([[initial.id, initial]]);
  return {
    rows,
    withLock: vi.fn(async <T>(_key: string, work: () => Promise<T>) => work()),
    withReaperLock: vi.fn(async (work: () => Promise<void>) => {
      await work();
      return true;
    }),
    insert: vi.fn(async (input: NewVideoRow) => {
      const row = videoRow(input);
      rows.set(row.id, row);
      return row;
    }),
    find: vi.fn(async (id: string) => rows.get(id)),
    findOwned: vi.fn(async (userId: string, id: string) => {
      const row = rows.get(id);
      return row?.userId === userId && !row.deletedAt ? row : undefined;
    }),
    findBySlug: vi.fn(async (slug: string) =>
      [...rows.values()].find((row) => row.slug === slug),
    ),
    ownsJob: vi.fn(async () => true),
    ownerName: vi.fn(async (): Promise<string | null> => 'Sam Rivera'),
    storageUsed: vi.fn(async () => 0),
    list: vi.fn(async () => [...rows.values()]),
    update: vi.fn(async (id: string, patch: Partial<NewVideoRow>) => {
      const row = rows.get(id);
      if (!row) return;
      const updated = { ...row, ...patch };
      rows.set(id, updated);
      return updated;
    }),
    markReady: vi.fn(
      async (id: string, attempt: number, patch: Partial<NewVideoRow>) => {
        const row = rows.get(id);
        if (
          !row ||
          row.deletedAt ||
          !row.userId ||
          row.processingAttempts !== attempt
        )
          return;
        const updated = { ...row, ...patch };
        rows.set(id, updated);
        return updated;
      },
    ),
    hardDelete: vi.fn(async (id: string) => {
      rows.delete(id);
    }),
    markFailed: vi.fn(
      async (
        id: string,
        attempt: number,
        reason: NonNullable<VideoRow['failureReason']>,
      ) => {
        const row = rows.get(id);
        if (
          !row ||
          row.status !== 'processing' ||
          row.processingAttempts !== attempt ||
          row.deletedAt
        )
          return;
        const updated = {
          ...row,
          status: 'failed' as const,
          failureReason: reason,
          nextAttemptAt: null,
        };
        rows.set(id, updated);
        return updated;
      },
    ),
    claim: vi
      .fn<() => Promise<VideoRow | undefined>>()
      .mockResolvedValue(undefined),
    recordView: vi.fn(async (_slug: string): Promise<string | null> => {
      void _slug;
      return '018f6a77-4e90-7ab5-a3bf-15c8f850fa99';
    }),
    recordProgress: vi.fn(
      async (_slug: string, _id: string, _ms: number, _done: boolean) => {
        void [_slug, _id, _ms, _done];
      },
    ),
    watchStats: vi.fn(async (_ids: string[]) => {
      void _ids;
      return new Map<
        string,
        {
          finishedViews: number;
          averageWatchedPercent: number | null;
          watchTimeMs: number;
        }
      >();
    }),
    candidates: vi
      .fn<(_task: string) => Promise<VideoRow[]>>()
      .mockResolvedValue([]),
  };
}
