import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database/database.module';
import {
  proposalPreferences,
  type ProposalPreference,
} from '../database/schema';
import type { ProposalPreferences } from './proposal-preferences.schema';
import { ProposalPreferencesService } from './proposal-preferences.service';

const USER_A = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const USER_B = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';

const BASE_INPUT: ProposalPreferences = {
  proposalLength: 'medium',
  proposalTone: 'professional',
  answerLength: 'standard',
  language: 'en',
};

describe('ProposalPreferencesService', () => {
  it('returns the documented defaults when no saved row exists', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const service = new ProposalPreferencesService({
      select,
    } as unknown as Database);

    await expect(service.get(USER_A)).resolves.toEqual({
      proposalLength: 'medium',
      proposalTone: 'professional',
      answerLength: 'standard',
      language: 'en',
    });
  });

  it('creates then replaces one row, including clearing custom instructions', async () => {
    const { database, rows } = createUpsertDatabase();
    const service = new ProposalPreferencesService(database);

    const created = await service.put(USER_A, {
      ...BASE_INPUT,
      signOffName: '  Alex  ',
      customInstructions: '  Emphasize delivery outcomes.  ',
    });
    const replaced = await service.put(USER_A, {
      ...BASE_INPUT,
      proposalLength: 'long',
      signOffName: '',
      customInstructions: '   ',
    });

    expect(created).toMatchObject({
      signOffName: 'Alex',
      customInstructions: 'Emphasize delivery outcomes.',
    });
    expect(replaced).toMatchObject({ proposalLength: 'long' });
    expect(replaced).not.toHaveProperty('signOffName');
    expect(replaced).not.toHaveProperty('customInstructions');
    expect(rows.size).toBe(1);
    expect(rows.get(USER_A)).toMatchObject({
      signOffName: null,
      customInstructions: null,
    });
  });

  it("never changes another user's row during an upsert", async () => {
    const { database, rows } = createUpsertDatabase();
    const service = new ProposalPreferencesService(database);

    await service.put(USER_A, {
      ...BASE_INPUT,
      customInstructions: 'User A original',
    });
    await service.put(USER_B, {
      ...BASE_INPUT,
      proposalTone: 'friendly',
      customInstructions: 'User B stays unchanged',
    });
    await service.put(USER_A, {
      ...BASE_INPUT,
      customInstructions: 'User A replacement',
    });

    expect(rows.size).toBe(2);
    expect(rows.get(USER_A)?.customInstructions).toBe('User A replacement');
    expect(rows.get(USER_B)).toMatchObject({
      proposalTone: 'friendly',
      customInstructions: 'User B stays unchanged',
    });
  });
});

interface UpsertValues {
  userId: string;
  proposalLength: ProposalPreference['proposalLength'];
  proposalTone: ProposalPreference['proposalTone'];
  answerLength: ProposalPreference['answerLength'];
  language: ProposalPreference['language'];
  signOffName: string | null;
  customInstructions: string | null;
}

function createUpsertDatabase(): {
  database: Database;
  rows: Map<string, ProposalPreference>;
} {
  const rows = new Map<string, ProposalPreference>();
  let sequence = 0;
  const insert = vi.fn((table: unknown) => {
    expect(table).toBe(proposalPreferences);
    return {
      values: (values: UpsertValues) => ({
        onConflictDoUpdate: (config: {
          target: unknown;
          set: Omit<UpsertValues, 'userId'> & { updatedAt: Date };
        }) => {
          expect(config.target).toBe(proposalPreferences.userId);
          return {
            returning: async (): Promise<ProposalPreference[]> => {
              const existing = rows.get(values.userId);
              sequence += 1;
              const now = new Date(`2026-08-23T12:00:0${sequence}.000Z`);
              const row: ProposalPreference = existing
                ? { ...existing, ...config.set, updatedAt: now }
                : {
                    id: `018f6a77-4e90-7ab5-a3bf-15c8f850f${sequence.toString().padStart(3, '0')}`,
                    ...values,
                    createdAt: now,
                    updatedAt: now,
                  };
              rows.set(values.userId, row);
              return [row];
            },
          };
        },
      }),
    };
  });

  return { database: { insert } as unknown as Database, rows };
}
