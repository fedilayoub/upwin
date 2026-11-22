import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database/database.module';
import { LOCAL_USER_ID, users, type User } from '../database/schema';
import { UsersService } from './users.service';

const ROW: User = {
  id: LOCAL_USER_ID,
  createdAt: new Date('2026-08-18T12:00:00.000Z'),
  updatedAt: new Date('2026-08-18T12:00:00.000Z'),
};

describe('UsersService.ensureLocalUser', () => {
  it('creates the fixed local row idempotently and returns it', async () => {
    const harness = fakeDatabase();
    const service = new UsersService(harness.db);

    await expect(service.ensureLocalUser()).resolves.toEqual(ROW);

    expect(harness.insert).toHaveBeenCalledExactlyOnceWith(users);
    expect(harness.values).toHaveBeenCalledExactlyOnceWith({
      id: LOCAL_USER_ID,
    });
    expect(harness.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('shares one upsert between concurrent first requests and caches it', async () => {
    const harness = fakeDatabase();
    const service = new UsersService(harness.db);

    const [first, second] = await Promise.all([
      service.ensureLocalUser(),
      service.ensureLocalUser(),
    ]);
    const third = await service.ensureLocalUser();

    expect(first).toBe(second);
    expect(third).toBe(first);
    expect(harness.insert).toHaveBeenCalledOnce();
  });

  it('retries on the next request after a failed upsert', async () => {
    const harness = fakeDatabase();
    harness.onConflictDoNothing.mockRejectedValueOnce(new Error('db down'));
    const service = new UsersService(harness.db);

    await expect(service.ensureLocalUser()).rejects.toThrow('db down');
    await expect(service.ensureLocalUser()).resolves.toEqual(ROW);
    expect(harness.insert).toHaveBeenCalledTimes(2);
  });

  it('fails loudly when the row is missing after its upsert', async () => {
    const harness = fakeDatabase([]);
    const service = new UsersService(harness.db);

    await expect(service.ensureLocalUser()).rejects.toThrow(
      'The local user row is missing after its upsert.',
    );
  });
});

function fakeDatabase(rows: User[] = [ROW]) {
  const onConflictDoNothing = vi.fn(async () => undefined);
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const db = { insert, select } as unknown as Database;

  return { db, insert, values, onConflictDoNothing };
}
