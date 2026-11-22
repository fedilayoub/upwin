import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { Database } from '../src/database/database.module';
import {
  goals,
  profileAnalyses,
  profileSnapshots,
  users,
} from '../src/database/schema';
import * as schema from '../src/database/schema';
import { ProfileAnalysesRepository } from '../src/profile/analysis/profile-analyses.repository';
import { PROFILE_SECTION_IDS } from '../src/profile/profile-section';
import { UNREADABLE_PROFILE_COMPLETENESS } from '../src/profile-snapshots/profile-snapshot.schema';
import { ProfileSnapshotsService } from '../src/profile-snapshots/profile-snapshots.service';

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION === '1' ? describe : describe.skip;

describeDatabase('profile history database behavior', () => {
  let pool: Pool;
  let database: Database;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is required when RUN_DATABASE_INTEGRATION=1.',
      );
    }

    pool = new Pool({ connectionString, max: 4 });
    database = drizzle(pool, { schema });
    await migrate(database, { migrationsFolder: './drizzle' });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await database.delete(users).where(inArray(users.id, createdUserIds));
    }
    await pool.end();
  });

  it('does not duplicate or skip a row when a newer analysis arrives between cursor pages', async () => {
    const userId = await createTestUser();
    const goalId = await createGoal(userId, 'Frontend Engineer');
    await insertAnalysis(userId, goalId, 64, '2026-08-21T12:00:00.123100Z');
    await insertAnalysis(userId, goalId, 72, '2026-08-21T12:00:00.123200Z');
    await insertAnalysis(userId, goalId, 78, '2026-08-21T12:00:00.123300Z');
    await insertAnalysis(userId, goalId, 84, '2026-08-21T12:00:00.123400Z');
    const repository = new ProfileAnalysesRepository(database);

    const firstPage = await repository.list(userId, undefined, 2);
    expect(firstPage.records.map(scoreOf)).toEqual([84, 78]);
    expect(firstPage.nextCursor).not.toBeNull();

    await insertAnalysis(userId, goalId, 91, '2026-08-21T12:00:00.123500Z');
    const secondPage = await repository.list(
      userId,
      firstPage.nextCursor ?? undefined,
      2,
    );
    const pagedScores = [...firstPage.records, ...secondPage.records].map(
      scoreOf,
    );

    expect(secondPage.records.map(scoreOf)).toEqual([72, 64]);
    expect(new Set(pagedScores).size).toBe(4);
    expect(pagedScores).toEqual([84, 78, 72, 64]);
  });

  // Regression: completeness fills carry no field, item index, suggestion style
  // or variant index, so several fills in one section collided on the
  // NULLS NOT DISTINCT unique key and the whole analysis transaction aborted
  // with a duplicate-key error after the AI call had already been paid for.
  it('persists several completeness fills that share one section', async () => {
    const userId = await createTestUser();
    const goalId = await createGoal(userId, 'Frontend Engineer');
    const repository = new ProfileAnalysesRepository(database);

    const persisted = await repository.persist({
      userId,
      goalId,
      snapshot: {
        source: 'manual',
        capturedAt: '2026-08-23T12:00:00.000Z',
        completeness: UNREADABLE_PROFILE_COMPLETENESS,
        profile: {
          title: 'Frontend Engineer',
          overview: 'I build reliable web applications.',
          skills: ['React'],
          portfolio: [],
          employment: [],
          education: [],
          certifications: [],
          languages: [],
        },
      },
      winningScore: 54,
      completenessScore: 40,
      sectionScores: PROFILE_SECTION_IDS.map((id) => ({
        id,
        score: 54,
        criteria: [],
      })),
      summary: 'Completeness fill collision fixture.',
      promptVersion: 'profile-analyzer-v4',
      rubricVersion: 'upwork-profile-v2',
      scoringVersion: 'scoring-v1',
      requestedModel: 'fake/profile-analyzer',
      gateway: null,
      provider: 'fake',
      model: 'fake/profile-analyzer',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      recommendations: [
        trustFill('licenses', 1),
        trustFill('eligibleVerification', 2),
        trustFill('avgResponseTime', 3),
      ],
    });

    expect(persisted.recommendations).toHaveLength(3);
    expect(persisted.recommendations.map((row) => row.section)).toEqual([
      'trust',
      'trust',
      'trust',
    ]);
    // The signal is what actually distinguishes them, so it must survive the write.
    expect(persisted.recommendations.map((row) => row.signal)).toEqual([
      'licenses',
      'eligibleVerification',
      'avgResponseTime',
    ]);
  });

  it('diffs explicitly created snapshots even when their analyses used different goals', async () => {
    const userId = await createTestUser();
    const firstGoalId = await createGoal(userId, 'Frontend Engineer');
    const secondGoalId = await createGoal(userId, 'React Consultant');
    await insertAnalysis(
      userId,
      firstGoalId,
      70,
      '2026-08-20T12:00:00.000Z',
      'Frontend Engineer',
    );
    await insertAnalysis(
      userId,
      secondGoalId,
      80,
      '2026-08-21T12:00:00.000Z',
      'React Consultant',
    );

    await expect(
      new ProfileSnapshotsService(database).diff(userId),
    ).resolves.toMatchObject({
      changes: { title: { status: 'changed' } },
    });
  });

  async function createTestUser(): Promise<string> {
    const [user] = await database
      .insert(users)
      .values({})
      .returning({ id: users.id });
    if (!user) throw new Error('Test user insert returned no row.');
    createdUserIds.push(user.id);
    return user.id;
  }


  function trustFill(
    signal: 'licenses' | 'eligibleVerification' | 'avgResponseTime',
    rank: number,
  ) {
    return {
      signal,
      section: 'trust' as const,
      estimatedMinutes: 5,
      recommendation: `Recommendation for ${signal}`,
      reason: `Reason for ${signal}`,
      evidence: [`Evidence for ${signal}`],
      kind: 'fill' as const,
      field: null,
      itemIndex: null,
      guidance: `Guidance for ${signal}`,
      items: [`Action for ${signal}`],
      impact: 'low' as const,
      rank,
    };
  }

  async function createGoal(userId: string, targetRole: string) {
    const [goal] = await database
      .insert(goals)
      .values({
        userId,
        objective: 'more-clients',
        targetRole,
        targetProjectTypes: ['SaaS'],
        targetClients: [],
        preferredSkills: [],
        isActive: false,
      })
      .returning({ id: goals.id });
    if (!goal) throw new Error('Test goal insert returned no row.');
    return goal.id;
  }

  async function insertAnalysis(
    userId: string,
    goalId: string,
    winningScore: number,
    timestamp: string,
    title = 'Frontend Engineer',
  ): Promise<void> {
    const createdAt = new Date(timestamp);
    const [snapshot] = await database
      .insert(profileSnapshots)
      .values({
        userId,
        source: 'manual',
        completeness: UNREADABLE_PROFILE_COMPLETENESS,
        title,
        overview: 'I build reliable web applications.',
        skills: ['React'],
        portfolio: [],
        employment: [],
        education: [],
        certifications: [],
        languages: [],
        capturedAt: createdAt,
        createdAt,
      })
      .returning({ id: profileSnapshots.id });
    if (!snapshot) throw new Error('Test snapshot insert returned no row.');

    await database.insert(profileAnalyses).values({
      userId,
      goalId,
      profileSnapshotId: snapshot.id,
      winningScore,
      sectionScores: PROFILE_SECTION_IDS.map((id) => ({
        id,
        score: winningScore,
        criteria: [],
      })),
      summary: 'History fixture.',
      promptVersion: 'profile-analyzer-v1',
      rubricVersion: 'upwork-profile-v1',
      scoringVersion: 'scoring-v1',
      requestedModel: 'fake/profile-analyzer',
      gateway: null,
      provider: 'fake',
      model: 'fake/profile-analyzer',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      createdAt: sql`${timestamp}::timestamptz`,
    });
  }
});

function scoreOf(record: { analysis: { winningScore: number } }): number {
  return record.analysis.winningScore;
}
