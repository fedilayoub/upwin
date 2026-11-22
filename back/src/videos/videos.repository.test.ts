import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../database/schema';
import { USER_ID, VIDEO_ID } from '../../test/videos/video-test-helpers';
import { VideosRepository } from './videos.repository';
function setup(acquired = true) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const query = vi.fn(
    async (input: string | { text: string }, values: unknown[] = []) => {
      const text = typeof input === 'string' ? input : input.text;
      statements.push({ sql: text, values });
      return {
        rows: text.includes('as acquired') ? [{ acquired }] : [],
        rowCount: 0,
      };
    },
  );
  const release = vi.fn();
  const client = { query, release };
  const pool = { query, connect: vi.fn(async () => client) } as unknown as Pool;
  return {
    repository: new VideosRepository(drizzle(pool, { schema })),
    statements,
    query,
    release,
  };
}
describe('videos repository SQL', () => {
  it('claims in a transaction with SKIP LOCKED and a 15 minute lease', async () => {
    const s = setup();
    await s.repository.claim();
    expect(s.statements[0]?.sql).toBe('begin');
    expect(s.statements[1]?.sql).toMatch(
      /processing_attempts = processing_attempts \+ 1/,
    );
    expect(s.statements[1]?.sql).toMatch(/interval '15 minutes'/);
    expect(s.statements[1]?.sql).toMatch(/for update skip locked limit 1/);
    expect(s.statements[1]?.sql).toMatch(
      /deleted_at is null and user_id is not null/,
    );
    expect(s.statements.at(-1)?.sql).toBe('commit');
  });
  it.each([
    ['abandoned', /"status" = \$1.*"created_at" < \$2.*"deleted_at" is null/],
    ['orphans', /"user_id" is null/],
    [
      'purge',
      /"deleted_at" is not null.*"status" = \$1.*"storage_purged_at" is null/,
    ],
    [
      'housekeeping',
      /"status" = \$1.*"updated_at" < \$2.*"storage_purged_at" is not null/,
    ],
  ] as const)(
    'bounds %s selection and uses its lifecycle conditions',
    async (task, pattern) => {
      const s = setup();
      await s.repository.candidates(task);
      expect(s.statements[0]?.sql).toMatch(pattern);
      expect(s.statements[0]?.values.at(-1)).toBe(50);
      if (task === 'abandoned' || task === 'housekeeping') {
        const days = task === 'abandoned' ? 1 : 7;
        expect(
          Math.abs(
            new Date(String(s.statements[0]?.values[1])).getTime() -
              (Date.now() - days * 86400000),
          ),
        ).toBeLessThan(2000);
      }
    },
  );
  it('sums reserved headroom and excludes deleted and failed storage', async () => {
    const s = setup();
    await s.repository.storageUsed(USER_ID);
    expect(s.statements[0]?.sql).toMatch(
      /when status = 'ready' then size_bytes.*when status = 'processing' then raw_size_bytes.*when status = 'uploading' then max_bytes/,
    );
    expect(s.statements[0]?.sql).toMatch(
      /"user_id" = \$1.*"deleted_at" is null/,
    );
    expect(s.statements[0]?.values).toContain(USER_ID);
  });
  it('uses a stable scoped seek cursor and excludes uploading', async () => {
    const s = setup();
    await s.repository.list(
      USER_ID,
      20,
      { createdAt: '2026-11-01T00:00:00Z', id: VIDEO_ID },
      VIDEO_ID,
    );
    const sql = s.statements[0]?.sql ?? '';
    expect(sql).toContain('"user_id" = $1');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('"status" <>');
    expect(sql).toContain('::timestamptz');
    expect(sql).toContain('::uuid');
    expect(sql).toContain('"job_snapshot_id" =');
    expect(sql).toContain(
      'order by "videos"."created_at" desc, "videos"."id" desc',
    );
  });
  it.each([true, false])(
    'keeps the reaper lock on one connection; acquired=%s',
    async (acquired) => {
      const s = setup(acquired),
        work = vi.fn(async () => undefined);
      expect(await s.repository.withReaperLock(work)).toBe(acquired);
      expect(work).toHaveBeenCalledTimes(acquired ? 1 : 0);
      expect(
        s.statements.some((q) => q.sql.includes('pg_advisory_unlock')),
      ).toBe(acquired);
      expect(s.release).toHaveBeenCalledOnce();
    },
  );
  it('releases the reaper lock even when work fails', async () => {
    const s = setup();
    await expect(
      s.repository.withReaperLock(async () => {
        throw new Error('failed');
      }),
    ).rejects.toThrow();
    expect(s.statements.at(-1)?.sql).toContain('pg_advisory_unlock');
    expect(s.release).toHaveBeenCalledOnce();
  });
});
