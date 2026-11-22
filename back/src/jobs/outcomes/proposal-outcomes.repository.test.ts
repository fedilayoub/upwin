import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../database/database.module';
import {
  proposalOutcomes,
  type ProposalOutcomeRow,
} from '../../database/schema';
import { ProposalOutcomesRepository } from './proposal-outcomes.repository';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const DRAFT_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';
const OUTCOME_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1d';
const NOW = new Date('2026-09-02T12:00:00.000Z');

describe('ProposalOutcomesRepository', () => {
  it('enrolls with an insert-only conflict policy so an existing hired row is untouched', async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const repository = new ProposalOutcomesRepository({
      insert,
    } as unknown as Database);

    await repository.ensureTracked({
      userId: USER_ID,
      jobAnalysisId: ANALYSIS_ID,
      proposalDraftId: DRAFT_ID,
      now: NOW,
    });

    expect(values).toHaveBeenCalledWith({
      userId: USER_ID,
      jobAnalysisId: ANALYSIS_ID,
      proposalDraftId: DRAFT_ID,
      status: 'in-progress',
      sentAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: proposalOutcomes.jobAnalysisId,
    });
  });

  it('keeps sentAt null on a new in-progress row', async () => {
    const harness = upsertHarness({ ...outcomeRow(), sentAt: null });

    const result = await harness.repository.upsert({
      userId: USER_ID,
      jobAnalysisId: ANALYSIS_ID,
      proposalDraftId: DRAFT_ID,
      status: 'in-progress',
      now: NOW,
    });

    expect(harness.values).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in-progress', sentAt: null }),
    );
    expect(result.sentAt).toBeNull();
  });

  it('stamps sentAt and respondedAt when a new row is messaged', async () => {
    const harness = upsertHarness({
      ...outcomeRow(),
      status: 'messaged',
      sentAt: NOW,
      respondedAt: NOW,
    });

    await harness.repository.upsert({
      userId: USER_ID,
      jobAnalysisId: ANALYSIS_ID,
      proposalDraftId: DRAFT_ID,
      status: 'messaged',
      now: NOW,
    });

    expect(harness.values).toHaveBeenCalledWith(
      expect.objectContaining({ sentAt: NOW, respondedAt: NOW }),
    );
  });

  it('uses never-clear coalesces for a backward transition to in-progress', async () => {
    const harness = upsertHarness(outcomeRow());

    await harness.repository.upsert({
      userId: USER_ID,
      jobAnalysisId: ANALYSIS_ID,
      proposalDraftId: null,
      status: 'in-progress',
      now: NOW,
    });

    const update = harness.onConflictDoUpdate.mock.calls[0]?.[0] as
      { set?: Record<string, unknown> } | undefined;
    expect(update?.set).toBeDefined();
    for (const field of ['sentAt', 'respondedAt', 'decidedAt'] as const) {
      const expression = update?.set?.[field] as SQL | undefined;
      expect(expression).toBeDefined();
      expect(new PgDialect().sqlToQuery(expression as SQL).sql).toContain(
        'coalesce',
      );
    }
  });

  it('computes tracker stats in one user-scoped aggregate query', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          total: 0,
          applied: 0,
          inProgress: 0,
          sent: 0,
          viewed: 0,
          messaged: 0,
          interviewing: 0,
          hired: 0,
          declined: 0,
          noResponse: 0,
        },
      ],
    });
    const repository = new ProposalOutcomesRepository({
      execute,
    } as unknown as Database);

    await repository.stats(USER_ID, NOW);

    expect(execute).toHaveBeenCalledOnce();
    const query = execute.mock.calls[0]?.[0] as SQL | undefined;
    const compiled = new PgDialect().sqlToQuery(query as SQL);
    expect(compiled.sql).toContain('created_at');
    expect(compiled.sql).toContain('sent_at');
    expect(compiled.sql).toContain("= 'messaged'");
    expect(compiled.params).toContain(USER_ID);
    expect(compiled.params).toContain(NOW);
  });

  it('filters list rows by status and orders the cursor on createdAt', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const secondJoin = vi.fn().mockReturnValue({ where });
    const firstJoin = vi.fn().mockReturnValue({ innerJoin: secondJoin });
    const from = vi.fn().mockReturnValue({ innerJoin: firstJoin });
    const select = vi.fn().mockReturnValue({ from });
    const repository = new ProposalOutcomesRepository({
      select,
    } as unknown as Database);

    await repository.list(USER_ID, undefined, 20, ['sent', 'hired']);

    const dialect = new PgDialect();
    const condition = where.mock.calls[0]?.[0] as SQL | undefined;
    const compiledCondition = dialect.sqlToQuery(condition as SQL);
    expect(compiledCondition.sql).toContain('"status" in ($2, $3)');
    expect(compiledCondition.params).toEqual([USER_ID, 'sent', 'hired']);
    const ordering = orderBy.mock.calls[0] as SQL[];
    expect(dialect.sqlToQuery(ordering[0] as SQL).sql).toContain(
      '"created_at" desc',
    );
    expect(dialect.sqlToQuery(ordering[1] as SQL).sql).toContain('"id" desc');
  });
});

function upsertHarness(returned: ProposalOutcomeRow) {
  const returning = vi.fn().mockResolvedValue([returned]);
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  return {
    repository: new ProposalOutcomesRepository({
      insert,
    } as unknown as Database),
    values,
    onConflictDoUpdate,
  };
}

function outcomeRow(): ProposalOutcomeRow {
  return {
    id: OUTCOME_ID,
    userId: USER_ID,
    jobAnalysisId: ANALYSIS_ID,
    proposalDraftId: DRAFT_ID,
    status: 'hired',
    connectsSpent: null,
    sentAt: new Date('2026-08-20T12:00:00.000Z'),
    respondedAt: new Date('2026-08-21T12:00:00.000Z'),
    decidedAt: new Date('2026-08-22T12:00:00.000Z'),
    note: null,
    createdAt: new Date('2026-08-20T12:00:00.000Z'),
    updatedAt: NOW,
  };
}
