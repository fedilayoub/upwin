import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VideosRepository } from '../src/videos/videos.repository';
import * as schema from '../src/database/schema';
import { users, videos } from '../src/database/schema';
import { videoRow } from './videos/video-test-helpers';

describe.skipIf(process.env.RUN_DATABASE_INTEGRATION !== '1')(
  'video database invariants',
  () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    const repository = new VideosRepository(db);
    const userIds: string[] = [],
      videoIds: string[] = [];
    beforeAll(() => {
      if (!process.env.DATABASE_URL)
        throw new Error('DATABASE_URL is required.');
    });
    afterAll(async () => {
      if (videoIds.length)
        await db.delete(videos).where(inArray(videos.id, videoIds));
      if (userIds.length)
        await db.delete(users).where(inArray(users.id, userIds));
      await pool.end();
    });
    async function createVideo() {
      const userId = randomUUID(),
        id = randomUUID();
      userIds.push(userId);
      videoIds.push(id);
      await db
        .insert(users)
        .values({ id: userId });
      const row = videoRow({
        id,
        userId,
        slug: randomUUID().replaceAll('-', '').slice(0, 12),
        storagePrefix: `videos/${userId}/${id}/`,
      });
      await repository.insert(row);
      return row;
    }
    it('reserves upload headroom, then counts raw and playback sizes and excludes deleted rows', async () => {
      const row = await createVideo();
      expect(await repository.storageUsed(row.userId!)).toBe(row.maxBytes);
      await repository.update(row.id, {
        status: 'processing',
        rawSizeBytes: 100,
      });
      expect(await repository.storageUsed(row.userId!)).toBe(100);
      await repository.update(row.id, { status: 'ready', sizeBytes: 90 });
      expect(await repository.storageUsed(row.userId!)).toBe(90);
      await repository.update(row.id, { deletedAt: new Date() });
      expect(await repository.storageUsed(row.userId!)).toBe(0);
    });
    it('preserves the object prefix when account deletion nulls the owner FK', async () => {
      const row = await createVideo();
      await db.delete(users).where(eq(users.id, row.userId!));
      expect(await repository.find(row.id)).toMatchObject({
        userId: null,
        storagePrefix: row.storagePrefix,
      });
    });
    it('serializes more callers than the pool has connections without starving callback queries', async () => {
      const row = await createVideo();
      let active = 0,
        maximum = 0;
      await Promise.all(
        Array.from({ length: 16 }, () =>
          repository.withLock(`video:${row.id}`, async () => {
            active++;
            maximum = Math.max(maximum, active);
            await repository.find(row.id);
            active--;
          }),
        ),
      );
      expect(maximum).toBe(1);
    }, 10000);
  },
);
