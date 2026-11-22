import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database/database.module';
import { InsightsRepository } from './insights.repository';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';

describe('InsightsRepository', () => {
  it('normalizes raw aggregate timestamps at the repository boundary', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          analysesCount: 1,
          analysesLast30Days: 1,
          distinctGoalCount: 1,
          latestId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b',
          latestWinningScore: 72,
          latestCompletenessScore: 75,
          latestCreatedAt: '2026-08-25T09:00:00.000Z',
          latestSectionScores: [],
          previousWinningScore: null,
          firstWinningScore: 72,
        },
      ],
    });
    const repository = new InsightsRepository({
      execute,
    } as unknown as Database);

    const summary = await repository.getProfileSummary(
      USER_ID,
      new Date('2026-07-26T00:00:00.000Z'),
    );

    expect(summary.latestCreatedAt).toBeInstanceOf(Date);
    expect(summary.latestCreatedAt?.toISOString()).toBe(
      '2026-08-25T09:00:00.000Z',
    );
  });

  it('groups suggestion counts in the database instead of loading recommendation rows', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { status: 'copied', value: 2 },
      { status: 'pending', value: 3 },
    ]);
    const where = vi.fn().mockReturnValue({ groupBy });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    const select = vi.fn().mockReturnValue({ from });
    const repository = new InsightsRepository({
      select,
    } as unknown as Database);

    await expect(repository.getSuggestionStatuses(USER_ID)).resolves.toEqual([
      { status: 'copied', value: 2 },
      { status: 'pending', value: 3 },
    ]);
    expect(select).toHaveBeenCalledOnce();
    expect(innerJoin).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledOnce();
    expect(groupBy).toHaveBeenCalledOnce();
  });

  it('binds the caller time zone as SQL parameters for local-day bucketing', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new InsightsRepository({
      execute,
    } as unknown as Database);

    await repository.listActivityDays(
      USER_ID,
      'Europe/Paris',
      '2025-08-26',
      '2026-08-25',
    );

    const query = execute.mock.calls[0]?.[0] as SQL | undefined;
    expect(query).toBeDefined();
    const compiled = new PgDialect().sqlToQuery(query as SQL);
    expect(compiled.sql).toContain('date_trunc');
    expect(compiled.sql).toContain('at time zone $1');
    expect(compiled.sql).not.toContain('Europe/Paris');
    expect(compiled.params).toContain('Europe/Paris');
    expect(compiled.params).toContain(USER_ID);
  });

  it('uses one bounded UNION ALL query for recent activity', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          kind: 'job-analysis',
          id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
          occurredAt: '2026-08-25T10:00:00.000Z',
          label: 'Synthetic job',
          score: 80,
          status: null,
        },
      ],
    });
    const repository = new InsightsRepository({
      execute,
    } as unknown as Database);

    const activity = await repository.listRecentActivity(USER_ID, 5);

    const query = execute.mock.calls[0]?.[0] as SQL | undefined;
    expect(query).toBeDefined();
    const compiled = new PgDialect().sqlToQuery(query as SQL);
    expect(compiled.sql.match(/union all/gu)).toHaveLength(3);
    expect(compiled.sql).toContain('order by occurred_at desc, id desc');
    expect(compiled.sql).toMatch(/"sent_at" is not null/u);
    expect(compiled.sql).toContain('limit');
    expect(compiled.params.filter((value) => value === USER_ID)).toHaveLength(
      4,
    );
    expect(compiled.params).toContain(5);
    expect(activity[0]?.occurredAt).toBeInstanceOf(Date);
    expect(activity[0]?.occurredAt.toISOString()).toBe(
      '2026-08-25T10:00:00.000Z',
    );
  });

  it('excludes unsent rows from the outcome denominator and counts messaged rows', async () => {
    const where = vi.fn().mockResolvedValue([
      {
        sent: 0,
        inProgress: 1,
        viewed: 0,
        messaged: 0,
        interviewing: 0,
        hired: 0,
        declined: 0,
        noResponse: 0,
        connectsSpent: null,
      },
    ]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const repository = new InsightsRepository({
      select,
    } as unknown as Database);

    await repository.getOutcomeSummary(USER_ID);

    const projection = select.mock.calls[0]?.[0] as
      Record<string, SQL> | undefined;
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(projection?.sent as SQL).sql).toMatch(
      /"sent_at" is not null/u,
    );
    expect(dialect.sqlToQuery(projection?.inProgress as SQL).sql).toContain(
      "= 'in-progress'",
    );
    expect(dialect.sqlToQuery(projection?.messaged as SQL).sql).toContain(
      "= 'messaged'",
    );
  });

  it('requires sentAt for the sent funnel step and treats messaged as replied', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          jobsAnalyzed: 1,
          proposalsDrafted: 1,
          sent: 0,
          replied: 0,
          interviewing: 0,
          hired: 0,
        },
      ],
    });
    const repository = new InsightsRepository({
      execute,
    } as unknown as Database);

    await repository.getFunnelCounts(USER_ID, null);

    const query = execute.mock.calls[0]?.[0] as SQL | undefined;
    const compiled = new PgDialect().sqlToQuery(query as SQL);
    expect(compiled.sql).toMatch(/"sent_at" is not null/u);
    expect(compiled.sql).toMatch(
      /"status" in \('viewed', 'messaged', 'interviewing', 'hired'\)/u,
    );
  });
});
