import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database/database.module';
import { freelancerContexts, type FreelancerContext } from '../database/schema';
import { FreelancerContextService } from './freelancer-context.service';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const CREATED_AT = new Date('2026-08-20T10:00:00.000Z');

const existingCvDraft: FreelancerContext = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
  userId: USER_ID,
  experience: { years: 6, roles: [] },
  skills: ['React'],
  portfolio: [],
  preferences: {},
  positioning: { targetRole: 'Frontend Engineer' },
  source: 'cv',
  confirmedAt: new Date('2026-08-20T10:05:00.000Z'),
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

describe('FreelancerContextService', () => {
  it('reports whether saving a draft replaced an existing context', async () => {
    const firstSave = createSaveService(undefined);
    const replacement = createSaveService({ id: existingCvDraft.id });

    await expect(
      firstSave.createManual(USER_ID, contextFields()),
    ).resolves.toMatchObject({ replaced: false, confirmedAt: null });
    await expect(
      replacement.saveCvDraft(USER_ID, contextFields()),
    ).resolves.toMatchObject({ replaced: true, confirmedAt: null });
  });

  it('deletes only the authenticated user context and succeeds without a returned row', async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const deleteFrom = vi.fn((table: unknown) => {
      expect(table).toBe(freelancerContexts);
      return { where };
    });
    const service = new FreelancerContextService({
      delete: deleteFrom,
    } as unknown as Database);

    await expect(service.delete(USER_ID)).resolves.toBeUndefined();
    expect(where).toHaveBeenCalledOnce();
  });

  it('leaves an edited CV draft unconfirmed and marks its source mixed', async () => {
    const updatedRow = {
      ...existingCvDraft,
      skills: ['React', 'TypeScript'],
      source: 'mixed' as const,
      confirmedAt: null,
    };
    const set = vi.fn().mockReturnValue({
      where: vi
        .fn()
        .mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedRow]),
        }),
    });
    const update = vi.fn((table: unknown) => {
      expect(table).toBe(freelancerContexts);
      return { set };
    });
    const select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([existingCvDraft]),
          }),
        }),
      }),
    });
    const transaction = vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ select, update }),
    );
    const service = new FreelancerContextService({
      transaction,
    } as unknown as Database);

    await expect(
      service.update(USER_ID, { skills: ['React', 'TypeScript'] }),
    ).resolves.toMatchObject({ source: 'mixed', confirmedAt: null });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: ['React', 'TypeScript'],
        source: 'mixed',
        confirmedAt: null,
      }),
    );
  });
});

function createSaveService(existing: { id: string } | undefined) {
  const saved: FreelancerContext = {
    ...existingCvDraft,
    confirmedAt: null,
  };
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          for: vi.fn().mockResolvedValue(existing ? [existing] : []),
        }),
      }),
    }),
  });
  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([saved]),
      }),
    }),
  });
  const transaction = vi.fn(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ insert, select }),
  );

  return new FreelancerContextService({
    transaction,
  } as unknown as Database);
}

function contextFields() {
  return {
    experience: existingCvDraft.experience,
    skills: existingCvDraft.skills,
    portfolio: existingCvDraft.portfolio,
    preferences: existingCvDraft.preferences,
    positioning: existingCvDraft.positioning,
  };
}
