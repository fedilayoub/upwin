import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../database/database.module';
import type { PromptRevision } from '../../database/schema';
import { DEFAULT_ANALYZER_TEMPLATE } from '../prompts/profile-analyzer/default-analyzer-template';
import { PromptRevisionsRepository } from './prompt-revisions.repository';

describe('PromptRevisionsRepository.activate', () => {
  it('retires the current active revision and activates the target in one transaction', async () => {
    const target = revision({ status: 'draft', revisionNumber: 2 });
    const activated = revision({
      status: 'active',
      revisionNumber: 2,
      activatedAt: new Date('2026-08-25T13:00:00.000Z'),
    });
    const returning = vi.fn().mockResolvedValue([activated]);
    let updateNumber = 0;
    const setValues: unknown[] = [];
    const tx = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([target]),
          }),
        }),
      }),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn((values: unknown) => {
          setValues.push(values);
          updateNumber += 1;
          return {
            where: vi.fn(() =>
              updateNumber === 1
                ? Promise.resolve([])
                : { returning },
            ),
          };
        }),
      })),
    };
    const transaction = vi.fn(
      async (callback: (handle: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const repository = new PromptRevisionsRepository({
      transaction,
    } as unknown as Database);

    await expect(
      repository.activate(target.id, 'profileAnalyzer'),
    ).resolves.toEqual(activated);
    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.execute).toHaveBeenCalledOnce();
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(setValues).toEqual([
      expect.objectContaining({ status: 'retired' }),
      expect.objectContaining({ status: 'active', retiredAt: null }),
    ]);
    expect(returning).toHaveBeenCalledOnce();
  });
});

function revision(overrides: Partial<PromptRevision> = {}): PromptRevision {
  return {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa17',
    capability: 'profileAnalyzer',
    revisionNumber: 1,
    status: 'active',
    content: DEFAULT_ANALYZER_TEMPLATE,
    notes: null,
    createdByUserId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
    createdAt: new Date('2026-08-25T12:00:00.000Z'),
    activatedAt: null,
    retiredAt: null,
    ...overrides,
  };
}
