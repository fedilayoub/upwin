import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { Database } from '../src/database/database.module';
import {
  freelancerContexts,
  goals,
  profileAnalyses,
  profileSnapshots,
  users,
} from '../src/database/schema';
import * as schema from '../src/database/schema';
import { FreelancerContextService } from '../src/freelancer-context/freelancer-context.service';
import { GoalsService } from '../src/goals/goals.service';
import { UNREADABLE_PROFILE_COMPLETENESS } from '../src/profile-snapshots/profile-snapshot.schema';

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION === '1' ? describe : describe.skip;

describeDatabase('user context database invariants', () => {
  let pool: Pool;
  let database: Database;
  let goalsService: GoalsService;
  let contextsService: FreelancerContextService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is required when RUN_DATABASE_INTEGRATION=1.',
      );
    }

    pool = new Pool({ connectionString, max: 6 });
    database = drizzle(pool, { schema });
    await migrate(database, { migrationsFolder: './drizzle' });
    goalsService = new GoalsService(database);
    contextsService = new FreelancerContextService(database);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await database.delete(users).where(inArray(users.id, createdUserIds));
    }
    await pool.end();
  });

  it('serializes concurrent activations and the partial unique index rejects a second active row', async () => {
    const userId = await createTestUser(database, createdUserIds);

    await Promise.all([
      goalsService.create(userId, goalInput('Frontend Engineer')),
      goalsService.create(userId, goalInput('Backend Engineer')),
    ]);

    const ownedGoals = await database
      .select()
      .from(goals)
      .where(eq(goals.userId, userId));
    expect(ownedGoals).toHaveLength(2);
    expect(ownedGoals.filter((goal) => goal.isActive)).toHaveLength(1);

    await expect(
      database.insert(goals).values({
        userId,
        objective: 'more-clients',
        targetRole: 'Constraint breaker',
        targetProjectTypes: ['SaaS'],
        targetClients: [],
        preferredSkills: [],
        isActive: true,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23505',
        constraint: 'goals_one_active_per_user_uidx',
      },
    });
  });

  it('never reads or patches another user goal', async () => {
    const firstUserId = await createTestUser(database, createdUserIds);
    const secondUserId = await createTestUser(database, createdUserIds);
    const otherGoal = await goalsService.create(
      secondUserId,
      goalInput('Data Engineer'),
    );

    await expect(goalsService.list(firstUserId)).resolves.toEqual([]);
    await expect(
      goalsService.update(firstUserId, otherGoal.id, { targetRole: 'Stolen' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('deletes an owned goal and promotes the newest survivor when the active one goes', async () => {
    const userId = await createTestUser(database, createdUserIds);
    const otherUserId = await createTestUser(database, createdUserIds);
    const older = await goalsService.create(userId, goalInput('Older goal'));
    const newer = await goalsService.create(userId, goalInput('Newer goal'));
    const active = await goalsService.create(userId, goalInput('Active goal'));

    await expect(
      goalsService.delete(otherUserId, active.id),
    ).rejects.toMatchObject({ status: 404 });

    await expect(goalsService.delete(userId, active.id)).resolves.toBeUndefined();

    const survivors = await goalsService.list(userId);
    expect(survivors.map((goal) => goal.id)).toEqual([newer.id, older.id]);
    expect(survivors.filter((goal) => goal.isActive).map((goal) => goal.id)).toEqual([
      newer.id,
    ]);

    await expect(goalsService.delete(userId, older.id)).resolves.toBeUndefined();
    await expect(goalsService.delete(userId, newer.id)).resolves.toBeUndefined();
    await expect(goalsService.list(userId)).resolves.toEqual([]);
    await expect(goalsService.delete(userId, newer.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses to delete a goal a stored analysis was scored against', async () => {
    const userId = await createTestUser(database, createdUserIds);
    const goal = await goalsService.create(userId, goalInput('Scored goal'));

    const [snapshot] = await database
      .insert(profileSnapshots)
      .values({
        userId,
        source: 'manual',
        completeness: UNREADABLE_PROFILE_COMPLETENESS,
        skills: ['React'],
        portfolio: [],
        employment: [],
        education: [],
        certifications: [],
        languages: [],
        capturedAt: new Date('2026-08-21T09:00:00.000Z'),
      })
      .returning({ id: profileSnapshots.id });
    if (!snapshot) throw new Error('Snapshot insert returned no row.');

    await database.insert(profileAnalyses).values({
      userId,
      goalId: goal.id,
      profileSnapshotId: snapshot.id,
      winningScore: 64,
      sectionScores: [],
      summary: 'Analysis that pins its goal in place.',
      promptVersion: 'profile-analyzer-v1',
      rubricVersion: 'upwork-profile-v1',
      scoringVersion: 'scoring-v1',
      requestedModel: 'gateway/model',
      gateway: 'openai-compatible',
      provider: 'provider',
      model: 'provider/model',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });

    await expect(goalsService.delete(userId, goal.id)).rejects.toMatchObject({
      status: 409,
      response: { code: 'GOAL_IN_USE' },
    });
    await expect(goalsService.list(userId)).resolves.toMatchObject([
      { id: goal.id, isActive: true },
    ]);
  });

  it('keeps context reads and patches scoped to the authenticated user', async () => {
    const firstUserId = await createTestUser(database, createdUserIds);
    const secondUserId = await createTestUser(database, createdUserIds);

    await contextsService.createManual(firstUserId, contextFields('React'));
    await contextsService.createManual(secondUserId, contextFields('Go'));
    await contextsService.confirm(firstUserId);
    await expect(
      contextsService.findConfirmedByUserId(firstUserId),
    ).resolves.toMatchObject({ skills: ['React'] });
    await contextsService.update(firstUserId, { skills: ['TypeScript'] });
    await expect(
      contextsService.findConfirmedByUserId(firstUserId),
    ).resolves.toBeNull();

    await expect(contextsService.get(firstUserId)).resolves.toMatchObject({
      skills: ['TypeScript'],
      confirmedAt: null,
    });
    await expect(contextsService.get(secondUserId)).resolves.toMatchObject({
      skills: ['Go'],
      confirmedAt: null,
    });

    const secondRows = await database
      .select({ skills: freelancerContexts.skills })
      .from(freelancerContexts)
      .where(
        and(
          eq(freelancerContexts.userId, secondUserId),
          eq(freelancerContexts.source, 'manual'),
        ),
      );
    expect(secondRows).toEqual([{ skills: ['Go'] }]);
  });

  it('deletes only context while preserving goals, snapshots, and historical analyses', async () => {
    const userId = await createTestUser(database, createdUserIds);
    const secondUserId = await createTestUser(database, createdUserIds);
    const goal = await goalsService.create(
      userId,
      goalInput('Frontend Engineer'),
    );
    await contextsService.createManual(userId, contextFields('React'));
    await contextsService.confirm(userId);
    await contextsService.createManual(secondUserId, contextFields('Go'));

    const [snapshot] = await database
      .insert(profileSnapshots)
      .values({
        userId,
        source: 'manual',
        completeness: UNREADABLE_PROFILE_COMPLETENESS,
        skills: ['React'],
        portfolio: [],
        employment: [],
        education: [],
        certifications: [],
        languages: [],
        capturedAt: new Date('2026-08-21T09:00:00.000Z'),
      })
      .returning({ id: profileSnapshots.id });
    if (!snapshot) throw new Error('Snapshot insert returned no row.');

    const [analysis] = await database
      .insert(profileAnalyses)
      .values({
        userId,
        goalId: goal.id,
        profileSnapshotId: snapshot.id,
        winningScore: 72,
        sectionScores: [],
        summary: 'Historical analysis retained by context reset.',
        promptVersion: 'profile-analyzer-v1',
        rubricVersion: 'upwork-profile-v1',
        scoringVersion: 'scoring-v1',
        requestedModel: 'gateway/model',
        gateway: 'openai-compatible',
        provider: 'provider',
        model: 'provider/model',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      })
      .returning({ id: profileAnalyses.id });
    if (!analysis) throw new Error('Analysis insert returned no row.');

    await expect(contextsService.delete(userId)).resolves.toBeUndefined();
    await expect(contextsService.delete(userId)).resolves.toBeUndefined();
    await expect(contextsService.get(userId)).resolves.toBeNull();
    await expect(contextsService.get(secondUserId)).resolves.toMatchObject({
      skills: ['Go'],
    });
    await expect(
      database.select().from(goals).where(eq(goals.id, goal.id)),
    ).resolves.toHaveLength(1);
    await expect(
      database
        .select()
        .from(profileSnapshots)
        .where(eq(profileSnapshots.id, snapshot.id)),
    ).resolves.toHaveLength(1);
    await expect(
      database
        .select()
        .from(profileAnalyses)
        .where(eq(profileAnalyses.id, analysis.id)),
    ).resolves.toHaveLength(1);

    await expect(
      contextsService.saveCvDraft(userId, contextFields('TypeScript')),
    ).resolves.toMatchObject({
      confirmedAt: null,
      replaced: false,
      skills: ['TypeScript'],
      source: 'cv',
    });
  });
});

async function createTestUser(
  database: Database,
  createdUserIds: string[],
): Promise<string> {
  const [user] = await database
    .insert(users)
    .values({})
    .returning({ id: users.id });
  if (!user) throw new Error('Test user insert returned no row.');
  createdUserIds.push(user.id);
  return user.id;
}

function goalInput(targetRole: string) {
  return {
    objective: 'more-clients' as const,
    targetRole,
    targetProjectTypes: ['SaaS'],
    targetClients: [],
    preferredSkills: [],
  };
}

function contextFields(skill: string) {
  return {
    experience: { roles: [] },
    skills: [skill],
    portfolio: [],
    preferences: {},
    positioning: {},
  };
}
