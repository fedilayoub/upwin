import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database/database.module';
import { profileSnapshots } from '../database/schema';
import {
  PROFILE_SNAPSHOT_CAPS,
  UNREADABLE_PROFILE_COMPLETENESS,
} from './profile-snapshot.schema';
import { ProfileSnapshotsService } from './profile-snapshots.service';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const OTHER_USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const CAPTURED_AT = '2026-08-18T12:00:00.000Z';
const CREATED_AT = '2026-08-18T12:00:01.000Z';

function validSnapshot(profile: Record<string, unknown> = {}) {
  return {
    source: 'upwork',
    capturedAt: CAPTURED_AT,
    completeness: UNREADABLE_PROFILE_COMPLETENESS,
    profile: {
      name: 'Ada Lovelace',
      title: 'Senior React Engineer',
      overview: 'I help product teams ship reliable web applications.',
      hourlyRate: 75,
      skills: ['React', 'TypeScript'],
      portfolio: [],
      employment: [],
      education: [],
      certifications: [],
      languages: [],
      ...profile,
    },
  };
}

function createHarness() {
  const returning = vi.fn().mockResolvedValue([
    {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
      capturedAt: new Date(CAPTURED_AT),
      createdAt: new Date(CREATED_AT),
    },
  ]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn((table: unknown) => {
    expect(table).toBe(profileSnapshots);
    return { values };
  });
  const database = { insert } as unknown as Database;

  return {
    insert,
    returning,
    service: new ProfileSnapshotsService(database),
    values,
  };
}

describe('ProfileSnapshotsService', () => {
  it('persists a valid snapshot under the authenticated user', async () => {
    const { service, values } = createHarness();

    await expect(service.create(USER_ID, validSnapshot())).resolves.toEqual({
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
      capturedAt: CAPTURED_AT,
      createdAt: CREATED_AT,
      truncatedFields: [],
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        completeness: UNREADABLE_PROFILE_COMPLETENESS,
        name: 'Ada Lovelace',
        title: 'Senior React Engineer',
        skills: ['React', 'TypeScript'],
        capturedAt: new Date(CAPTURED_AT),
      }),
    );
  });

  it('rejects a snapshot missing required arrays without writing', async () => {
    const { insert, service } = createHarness();

    await expect(
      service.create(USER_ID, {
        source: 'upwork',
        capturedAt: CAPTURED_AT,
        profile: { portfolio: [] },
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SNAPSHOT_INVALID',
        message: 'The profile snapshot is invalid.',
      },
      status: 422,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a POST body missing completeness instead of manufacturing unreadable facts', async () => {
    const { insert, service } = createHarness();
    const withoutCompleteness: Partial<ReturnType<typeof validSnapshot>> =
      validSnapshot();
    delete withoutCompleteness.completeness;

    await expect(
      service.create(USER_ID, withoutCompleteness),
    ).rejects.toMatchObject({
      response: {
        code: 'SNAPSHOT_INVALID',
        message: 'The profile snapshot is invalid.',
      },
      status: 422,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('truncates over-cap content, persists it, and flags the response', async () => {
    const { service, values } = createHarness();
    const response = await service.create(
      USER_ID,
      validSnapshot({
        overview: 'x'.repeat(PROFILE_SNAPSHOT_CAPS.overview + 1),
      }),
    );

    expect(values.mock.calls[0]?.[0]).toMatchObject({
      overview: 'x'.repeat(PROFILE_SNAPSHOT_CAPS.overview),
    });
    expect(response.truncatedFields).toEqual(['profile.overview']);
  });

  it('cannot accept a body-selected user id', async () => {
    const { insert, service } = createHarness();

    await expect(
      service.create(USER_ID, { ...validSnapshot(), userId: OTHER_USER_ID }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(insert).not.toHaveBeenCalled();
  });

  it('diffs only the two newest persisted snapshots for the authenticated user', async () => {
    const previous = snapshotRow({
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa20',
      capturedAt: new Date('2026-08-20T12:00:00.000Z'),
      title: 'Frontend Developer',
    });
    const current = snapshotRow({
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa21',
      capturedAt: new Date('2026-08-21T12:00:00.000Z'),
      title: 'Senior Frontend Developer',
    });
    const limit = vi.fn().mockResolvedValue([current, previous]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn((table: unknown) => {
      expect(table).toBe(profileSnapshots);
      return { where };
    });
    const select = vi.fn().mockReturnValue({ from });
    const service = new ProfileSnapshotsService({
      select,
    } as unknown as Database);

    await expect(service.diff(USER_ID)).resolves.toMatchObject({
      fromSnapshotId: previous.id,
      toSnapshotId: current.id,
      changes: { title: { status: 'changed' } },
    });
    expect(where).toHaveBeenCalledOnce();
    expect(orderBy).toHaveBeenCalledOnce();
    expect(limit).toHaveBeenCalledWith(2);
  });

  it('returns no diff without two explicitly persisted snapshots', async () => {
    const limit = vi.fn().mockResolvedValue([snapshotRow()]);
    const service = new ProfileSnapshotsService({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({ limit }),
          }),
        }),
      }),
    } as unknown as Database);

    await expect(service.diff(USER_ID)).resolves.toBeNull();
  });
});

function snapshotRow(
  overrides: Partial<typeof profileSnapshots.$inferSelect> = {},
): typeof profileSnapshots.$inferSelect {
  return {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa22',
    userId: USER_ID,
    source: 'manual',
    completeness: UNREADABLE_PROFILE_COMPLETENESS,
    name: null,
    title: 'Frontend Developer',
    overview: 'I build web applications.',
    hourlyRate: null,
    skills: ['React'],
    portfolio: [],
    employment: [],
    education: [],
    certifications: [],
    languages: [],
    capturedAt: new Date(CAPTURED_AT),
    createdAt: new Date(CREATED_AT),
    ...overrides,
  };
}
