import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { Database } from '../src/database/database.module';
import {
  goals,
  jobAnalyses,
  jobSnapshots,
  profileAnalyses,
  profileSnapshots,
  proposalDrafts,
  proposalOutcomes,
  users,
} from '../src/database/schema';
import * as schema from '../src/database/schema';
import { InsightsRepository } from '../src/insights/insights.repository';
import { InsightsService } from '../src/insights/insights.service';
import { JOB_MATCH_DIMENSION_IDS } from '../src/jobs/job-match-dimension';
import { ProposalOutcomesRepository } from '../src/jobs/outcomes/proposal-outcomes.repository';
import { UNREADABLE_PROFILE_COMPLETENESS } from '../src/profile-snapshots/profile-snapshot.schema';
import { PROFILE_SECTION_IDS } from '../src/profile/profile-section';

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION === '1' ? describe : describe.skip;

describeDatabase('insights database aggregates', () => {
  let pool: Pool;
  let database: Database;
  let insights: InsightsRepository;
  let service: InsightsService;
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
    insights = new InsightsRepository(database);
    service = new InsightsService(insights);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await database.delete(users).where(inArray(users.id, createdUserIds));
    }
    await pool.end();
  });

  it('executes the four-source UNION ALL recent-activity projection', async () => {
    const userId = await createUser();
    const goalId = await createGoal(userId);
    await createProfileAnalysis(
      userId,
      goalId,
      new Date('2026-08-25T10:00:00.000Z'),
    );
    const job = await createJobAnalysis(
      userId,
      goalId,
      '~recent',
      new Date('2026-08-25T11:00:00.000Z'),
    );
    const draftId = await createDraft(
      userId,
      job.analysisId,
      new Date('2026-08-25T12:00:00.000Z'),
    );
    await database.insert(proposalOutcomes).values({
      userId,
      jobAnalysisId: job.analysisId,
      proposalDraftId: draftId,
      status: 'viewed',
      sentAt: new Date('2026-08-25T12:30:00.000Z'),
      respondedAt: new Date('2026-08-25T13:00:00.000Z'),
      createdAt: new Date('2026-08-25T12:30:00.000Z'),
      updatedAt: new Date('2026-08-25T13:00:00.000Z'),
    });

    const activity = await insights.listRecentActivity(userId, 5);

    expect(activity.map(({ kind }) => kind)).toEqual([
      'proposal-outcome',
      'proposal-draft',
      'job-analysis',
      'profile-analysis',
    ]);
    expect(activity[0]).toMatchObject({
      label: 'Synthetic ~recent',
      status: 'viewed',
    });

    const summary = await service.summary(
      userId,
      new Date('2026-08-25T14:00:00.000Z'),
    );
    expect(summary.profile.lastAnalysisAt).toBe('2026-08-25T10:00:00.000Z');
    expect(summary.recentActivity).toHaveLength(4);
    expect(summary.recentActivity[0]).toMatchObject({
      kind: 'proposal-outcome',
      occurredAt: '2026-08-25T13:00:00.000Z',
    });
  });

  it('serves a fresh account from the real aggregate queries', async () => {
    const userId = await createUser();

    const summary = await service.summary(
      userId,
      new Date('2026-08-25T12:00:00.000Z'),
    );

    expect(summary).toMatchObject({
      profile: {
        latestWinningScore: null,
        analysesCount: 0,
        scoreSparkline: [],
      },
      suggestions: { copied: 0, dismissed: 0, pending: 0 },
      jobs: { analysesCount: 0, highFitShare: 0 },
      proposals: { draftedCount: 0, copiedBlocks: 0 },
      outcomes: { sent: 0, replyRate: null, sufficientData: false },
      recentActivity: [],
    });
  });

  it('buckets one boundary draft into different local dates in two time zones', async () => {
    const userId = await createUser();
    const goalId = await createGoal(userId);
    const job = await createJobAnalysis(
      userId,
      goalId,
      '~timezone',
      new Date('2026-01-01T23:00:00.000Z'),
    );
    await createDraft(
      userId,
      job.analysisId,
      new Date('2026-01-02T00:30:00.000Z'),
    );

    const paris = await insights.listActivityDays(
      userId,
      'Europe/Paris',
      '2026-01-01',
      '2026-01-02',
    );
    const losAngeles = await insights.listActivityDays(
      userId,
      'America/Los_Angeles',
      '2026-01-01',
      '2026-01-02',
    );

    expect(paris).toEqual([{ date: '2026-01-02', drafted: 1, sent: 0 }]);
    expect(losAngeles).toEqual([{ date: '2026-01-01', drafted: 1, sent: 0 }]);
  });

  it('counts distinct jobs in every funnel step even with repeated drafts', async () => {
    const userId = await createUser();
    const goalId = await createGoal(userId);
    const hiredJob = await createJobAnalysis(
      userId,
      goalId,
      '~hired',
      new Date('2026-08-20T10:00:00.000Z'),
    );
    const viewedJob = await createJobAnalysis(
      userId,
      goalId,
      '~viewed',
      new Date('2026-08-20T11:00:00.000Z'),
    );
    await createJobAnalysis(
      userId,
      goalId,
      '~analysis-only',
      new Date('2026-08-20T12:00:00.000Z'),
    );
    for (let index = 0; index < 3; index += 1) {
      await createDraft(
        userId,
        hiredJob.analysisId,
        new Date(`2026-08-21T0${index}:00:00.000Z`),
      );
    }
    await createDraft(
      userId,
      viewedJob.analysisId,
      new Date('2026-08-21T04:00:00.000Z'),
    );
    await database.insert(proposalOutcomes).values([
      {
        userId,
        jobAnalysisId: hiredJob.analysisId,
        status: 'hired',
        sentAt: new Date('2026-08-22T10:00:00.000Z'),
        respondedAt: new Date('2026-08-23T10:00:00.000Z'),
        decidedAt: new Date('2026-08-24T10:00:00.000Z'),
      },
      {
        userId,
        jobAnalysisId: viewedJob.analysisId,
        status: 'viewed',
        sentAt: new Date('2026-08-22T11:00:00.000Z'),
        respondedAt: new Date('2026-08-23T11:00:00.000Z'),
      },
    ]);

    await expect(insights.getFunnelCounts(userId, null)).resolves.toEqual({
      jobsAnalyzed: 3,
      proposalsDrafted: 2,
      sent: 2,
      replied: 2,
      interviewing: 1,
      hired: 1,
    });
  });

  it('does not move summary, funnel, or recent activity when an unsent row is enrolled', async () => {
    const userId = await createUser();
    const goalId = await createGoal(userId);
    const job = await createJobAnalysis(
      userId,
      goalId,
      '~unsent',
      new Date('2026-08-20T10:00:00.000Z'),
    );
    const draftId = await createDraft(
      userId,
      job.analysisId,
      new Date('2026-08-21T10:00:00.000Z'),
    );
    const before = await insights.getFunnelCounts(userId, null);

    await new ProposalOutcomesRepository(database).ensureTracked({
      userId,
      jobAnalysisId: job.analysisId,
      proposalDraftId: draftId,
      now: new Date('2026-08-21T10:01:00.000Z'),
    });

    await expect(insights.getFunnelCounts(userId, null)).resolves.toEqual(
      before,
    );
    await expect(insights.getOutcomeSummary(userId)).resolves.toMatchObject({
      sent: 0,
      inProgress: 1,
    });
    await expect(insights.listRecentActivity(userId, 5)).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'proposal-outcome' }),
      ]),
    );
  });

  it('sets transition timestamps once and never clears them on a later status', async () => {
    const userId = await createUser();
    const goalId = await createGoal(userId);
    const job = await createJobAnalysis(
      userId,
      goalId,
      '~transitions',
      new Date('2026-08-20T10:00:00.000Z'),
    );
    const repository = new ProposalOutcomesRepository(database);
    const draftId = await createDraft(
      userId,
      job.analysisId,
      new Date('2026-08-21T09:00:00.000Z'),
    );
    const trackedAt = new Date('2026-08-21T10:00:00.000Z');
    const firstSentAt = new Date('2026-08-22T10:00:00.000Z');
    const firstResponseAt = new Date('2026-08-23T10:00:00.000Z');
    const firstDecisionAt = new Date('2026-08-24T10:00:00.000Z');

    await repository.ensureTracked({
      userId,
      jobAnalysisId: job.analysisId,
      proposalDraftId: draftId,
      now: trackedAt,
    });
    const sent = await repository.upsert({
      userId,
      jobAnalysisId: job.analysisId,
      proposalDraftId: draftId,
      status: 'sent',
      now: firstSentAt,
    });
    expect(sent.sentAt).toEqual(firstSentAt);
    await repository.upsert({
      userId,
      jobAnalysisId: job.analysisId,
      proposalDraftId: draftId,
      status: 'messaged',
      now: firstResponseAt,
    });
    await repository.upsert({
      userId,
      jobAnalysisId: job.analysisId,
      proposalDraftId: draftId,
      status: 'hired',
      now: firstDecisionAt,
    });
    await repository.ensureTracked({
      userId,
      jobAnalysisId: job.analysisId,
      proposalDraftId: draftId,
      now: new Date('2026-08-25T10:00:00.000Z'),
    });
    const [stillHired] = await database
      .select()
      .from(proposalOutcomes)
      .where(eq(proposalOutcomes.jobAnalysisId, job.analysisId));
    expect(stillHired?.status).toBe('hired');
    const later = await repository.upsert({
      userId,
      jobAnalysisId: job.analysisId,
      proposalDraftId: draftId,
      status: 'in-progress',
      now: new Date('2026-08-26T10:00:00.000Z'),
    });

    expect(later.respondedAt).toEqual(firstResponseAt);
    expect(later.decidedAt).toEqual(firstDecisionAt);
    expect(later.sentAt).toEqual(firstSentAt);
  });

  async function createUser(): Promise<string> {
    const [user] = await database
      .insert(users)
      .values({})
      .returning({ id: users.id });
    if (!user) throw new Error('Test user insert returned no row.');
    createdUserIds.push(user.id);
    return user.id;
  }

  async function createGoal(userId: string): Promise<string> {
    const [goal] = await database
      .insert(goals)
      .values({
        userId,
        objective: 'more-clients',
        targetRole: 'Frontend Engineer',
        targetProjectTypes: ['SaaS'],
        targetClients: [],
        preferredSkills: [],
        isActive: true,
      })
      .returning({ id: goals.id });
    if (!goal) throw new Error('Test goal insert returned no row.');
    return goal.id;
  }

  async function createProfileAnalysis(
    userId: string,
    goalId: string,
    createdAt: Date,
  ): Promise<void> {
    const [snapshot] = await database
      .insert(profileSnapshots)
      .values({
        userId,
        source: 'manual',
        completeness: UNREADABLE_PROFILE_COMPLETENESS,
        skills: [],
        portfolio: [],
        employment: [],
        education: [],
        certifications: [],
        languages: [],
        capturedAt: createdAt,
        createdAt,
      })
      .returning({ id: profileSnapshots.id });
    if (!snapshot) throw new Error('Profile snapshot insert returned no row.');
    await database.insert(profileAnalyses).values({
      userId,
      goalId,
      profileSnapshotId: snapshot.id,
      winningScore: 75,
      sectionScores: PROFILE_SECTION_IDS.map((id) => ({
        id,
        score: 75,
        criteria: [],
      })),
      summary: 'Synthetic profile analysis.',
      promptVersion: 'test',
      rubricVersion: 'test',
      scoringVersion: 'test',
      requestedModel: 'fake',
      provider: 'fake',
      model: 'fake',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      createdAt,
    });
  }

  async function createJobAnalysis(
    userId: string,
    goalId: string,
    ciphertext: string,
    createdAt: Date,
  ): Promise<{ analysisId: string; snapshotId: string }> {
    const [snapshot] = await database
      .insert(jobSnapshots)
      .values({
        userId,
        ciphertext,
        url: `https://www.upwork.com/jobs/${ciphertext}`,
        capturedAt: createdAt,
        source: 'manual',
        snapshot: {
          source: 'manual',
          capturedAt: createdAt.toISOString(),
          job: {
            ciphertext,
            url: `https://www.upwork.com/jobs/${ciphertext}`,
            title: `Synthetic ${ciphertext}`,
            description: 'Synthetic integration test job.',
            engagement: { budgetType: 'unknown' },
            skills: [],
            questions: [],
            client: { paymentVerified: null },
            activity: {},
          },
        },
        createdAt,
      })
      .returning({ id: jobSnapshots.id });
    if (!snapshot) throw new Error('Job snapshot insert returned no row.');
    const [analysis] = await database
      .insert(jobAnalyses)
      .values({
        userId,
        goalId,
        jobSnapshotId: snapshot.id,
        matchScore: 80,
        dimensionScores: JOB_MATCH_DIMENSION_IDS.map((id) => ({
          id,
          score: 80,
          criteria: [],
        })),
        summary: 'Synthetic job analysis.',
        strengths: [],
        concerns: [],
        questionCount: 0,
        promptVersion: 'test',
        rubricVersion: 'test',
        scoringVersion: 'test',
        requestedModel: 'fake',
        provider: 'fake',
        model: 'fake',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        createdAt,
      })
      .returning({ id: jobAnalyses.id });
    if (!analysis) throw new Error('Job analysis insert returned no row.');
    return { analysisId: analysis.id, snapshotId: snapshot.id };
  }

  async function createDraft(
    userId: string,
    jobAnalysisId: string,
    createdAt: Date,
  ): Promise<string> {
    const [draft] = await database
      .insert(proposalDrafts)
      .values({
        userId,
        jobAnalysisId,
        proposal: {
          blockId: 'proposal',
          text: 'Synthetic proposal.',
          wordCount: 2,
          variantIndex: 0,
        },
        answers: [],
        promptVersion: 'test',
        wordBudgetVersion: 'test',
        requestedModel: 'fake',
        provider: 'fake',
        model: 'fake',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        blockStatuses: {},
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: proposalDrafts.id });
    if (!draft) throw new Error('Proposal draft insert returned no row.');
    return draft.id;
  }
});
