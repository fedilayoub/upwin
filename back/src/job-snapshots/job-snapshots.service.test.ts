import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database/database.module';
import { jobSnapshots } from '../database/schema';
import { JOB_SNAPSHOT_CAPS } from './job-snapshot.schema';
import { JobSnapshotsService } from './job-snapshots.service';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const OTHER_USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const SNAPSHOT_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';
const CAPTURED_AT = '2026-08-23T12:00:00.000Z';
const CREATED_AT = '2026-08-23T12:00:01.000Z';

describe('JobSnapshotsService', () => {
  it('persists a valid snapshot under the authenticated user and returns its id', async () => {
    const { service, values } = createInsertHarness();

    await expect(
      service.create(USER_ID, { snapshot: validSnapshot() }),
    ).resolves.toEqual({
      id: SNAPSHOT_ID,
      ciphertext: '~0def456',
      capturedAt: CAPTURED_AT,
      createdAt: CREATED_AT,
      truncatedFields: [],
    });
    const written = values.mock.calls[0]?.[0];
    expect(written).toMatchObject({
      userId: USER_ID,
      ciphertext: '~0def456',
      url: 'https://www.upwork.com/jobs/~0def456',
      source: 'upwork-payload',
      capturedAt: new Date(CAPTURED_AT),
    });
    expect(written?.snapshot.job.title).toBe('Synthetic job');
  });

  it('returns 422 JOB_SNAPSHOT_INVALID and writes nothing for off-schema input', async () => {
    const { insert, service } = createInsertHarness();

    await expect(
      service.create(USER_ID, {
        snapshot: validSnapshot({ description: undefined }),
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'JOB_SNAPSHOT_INVALID',
        message: 'The job snapshot is invalid.',
      },
      status: 422,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('rechecks caps before writing JSONB', async () => {
    const { service, values } = createInsertHarness();
    const response = await service.create(USER_ID, {
      snapshot: validSnapshot({
        description: 'x'.repeat(JOB_SNAPSHOT_CAPS.description + 1),
      }),
    });

    expect(values.mock.calls[0]?.[0]).toMatchObject({
      snapshot: {
        job: { description: 'x'.repeat(JOB_SNAPSHOT_CAPS.description) },
      },
    });
    expect(response.truncatedFields).toEqual(['job.description']);
  });

  it("returns 404 when another user's snapshot id is queried", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn((table: unknown) => {
      expect(table).toBe(jobSnapshots);
      return { where };
    });
    const database = {
      select: vi.fn().mockReturnValue({ from }),
    } as unknown as Database;
    const service = new JobSnapshotsService(database);

    await expect(
      service.findOwned(OTHER_USER_ID, SNAPSHOT_ID),
    ).rejects.toMatchObject({
      response: {
        code: 'NOT_FOUND',
        message: 'The job snapshot was not found.',
      },
      status: 404,
    });
    expect(where).toHaveBeenCalledOnce();
    expect(limit).toHaveBeenCalledWith(1);
  });
});

function createInsertHarness() {
  const returning = vi.fn().mockResolvedValue([
    {
      id: SNAPSHOT_ID,
      ciphertext: '~0def456',
      capturedAt: new Date(CAPTURED_AT),
      createdAt: new Date(CREATED_AT),
    },
  ]);
  const values = vi.fn((value: typeof jobSnapshots.$inferInsert) => {
    void value;
    return { returning };
  });
  const insert = vi.fn((table: unknown) => {
    expect(table).toBe(jobSnapshots);
    return { values };
  });
  const database = { insert } as unknown as Database;

  return {
    insert,
    service: new JobSnapshotsService(database),
    values,
  };
}

function validSnapshot(jobOverrides: Record<string, unknown> = {}) {
  return {
    source: 'upwork-payload',
    capturedAt: CAPTURED_AT,
    job: {
      ciphertext: '~0def456',
      url: 'https://www.upwork.com/jobs/~0def456',
      title: 'Synthetic job',
      description: 'Synthetic job description',
      postedAt: '2026-08-20T12:00:00.000Z',
      category: 'Web Development',
      categoryGroup: 'Development & IT',
      engagement: {
        budgetType: 'hourly',
        hourlyBudget: { min: 15, max: 30, currency: 'USD' },
        workload: 'Less than 30 hrs/week',
        durationLabel: 'Less than 1 month',
        experienceLevel: 'intermediate',
        projectType: 'One-time project',
      },
      skills: [
        { name: 'TypeScript', relevance: 'mandatory' },
        { name: 'Next.js', relevance: 'nice-to-have' },
      ],
      questions: [],
      client: { country: 'Exampleland', paymentVerified: true },
      activity: { applicants: 12, interviewing: 2, hired: 0 },
      ...jobOverrides,
    },
  };
}
