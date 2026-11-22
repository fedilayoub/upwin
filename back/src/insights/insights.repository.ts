import { Inject, Injectable } from '@nestjs/common';
import { and, avg, count, desc, eq, sql, sum } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  goals,
  jobAnalyses,
  jobSnapshots,
  profileAnalyses,
  profileRecommendations,
  proposalDrafts,
  proposalOutcomes,
  type Goal,
  type ProposalOutcomeStatus,
  type RecommendationStatus,
} from '../database/schema';
import type { GoalObjective } from '../goals/goal.schema';
import type { PersistedSectionScore } from '../profile/analysis/profile-analysis.schema';

export interface ProfileSummaryRecord {
  analysesCount: number;
  analysesLast30Days: number;
  distinctGoalCount: number;
  latestId: string | null;
  latestWinningScore: number | null;
  latestCompletenessScore: number | null;
  latestCreatedAt: Date | null;
  latestSectionScores: PersistedSectionScore[] | null;
  previousWinningScore: number | null;
  firstWinningScore: number | null;
}

type ProfileSummaryQueryRecord = Omit<ProfileSummaryRecord, 'latestCreatedAt'> &
  Record<string, unknown> & {
    latestCreatedAt: Date | string | null;
  };

export interface SuggestionStatusRecord {
  status: RecommendationStatus;
  value: number;
}

export interface JobSummaryRecord {
  analysesCount: number;
  analysesLast30Days: number;
  averageMatchScore: string | null;
  averageMatchScoreLast30Days: string | null;
  highFitCount: number;
  averageMatchScoreApplied: string | null;
}

export interface ProposalSummaryRecord {
  draftedCount: number;
  draftedLast30Days: number;
  copiedBlocks: string | null;
  averageProposalWords: string | null;
}

export interface OutcomeSummaryRecord {
  sent: number;
  inProgress: number;
  viewed: number;
  messaged: number;
  interviewing: number;
  hired: number;
  declined: number;
  noResponse: number;
  connectsSpent: string | null;
}

export interface RecentActivityRecord {
  kind:
    'profile-analysis' | 'job-analysis' | 'proposal-draft' | 'proposal-outcome';
  id: string;
  occurredAt: Date;
  label: string;
  score: number | null;
  status: ProposalOutcomeStatus | null;
}

type RecentActivityQueryRecord = Omit<RecentActivityRecord, 'occurredAt'> &
  Record<string, unknown> & {
    occurredAt: Date | string;
  };

export interface ActivityDayRecord extends Record<string, unknown> {
  date: string;
  drafted: number;
  sent: number;
}

export interface ActivityTotalsRecord extends Record<string, unknown> {
  drafted: number;
  sent: number;
}

export interface ScoreHistoryRecord {
  id: string;
  createdAt: Date;
  winningScore: number;
  completenessScore: number | null;
  goalId: string;
  objective: GoalObjective;
  sectionScores: PersistedSectionScore[];
}

export interface FunnelCountsRecord extends Record<string, unknown> {
  jobsAnalyzed: number;
  proposalsDrafted: number;
  sent: number;
  replied: number;
  interviewing: number;
  hired: number;
}

@Injectable()
export class InsightsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getProfileSummary(
    userId: string,
    last30DaysSince: Date,
  ): Promise<ProfileSummaryRecord> {
    const result = await this.db.execute<ProfileSummaryQueryRecord>(sql`
      with user_analyses as (
        select *
        from ${profileAnalyses}
        where ${profileAnalyses.userId} = ${userId}
      ), aggregate as (
        select
          count(*)::int as "analysesCount",
          count(*) filter (where created_at >= ${last30DaysSince})::int
            as "analysesLast30Days",
          count(distinct goal_id)::int as "distinctGoalCount"
        from user_analyses
      ), latest as (
        select * from user_analyses order by created_at desc, id desc limit 1
      ), previous as (
        select winning_score from user_analyses
        order by created_at desc, id desc offset 1 limit 1
      ), first_analysis as (
        select winning_score from user_analyses
        order by created_at asc, id asc limit 1
      )
      select
        aggregate."analysesCount",
        aggregate."analysesLast30Days",
        aggregate."distinctGoalCount",
        latest.id as "latestId",
        latest.winning_score as "latestWinningScore",
        latest.completeness_score as "latestCompletenessScore",
        latest.created_at as "latestCreatedAt",
        latest.section_scores as "latestSectionScores",
        previous.winning_score as "previousWinningScore",
        first_analysis.winning_score as "firstWinningScore"
      from aggregate
      left join latest on true
      left join previous on true
      left join first_analysis on true
    `);
    const row = result.rows[0];
    if (!row) throw new Error('Profile summary query returned no row.');
    return {
      ...row,
      latestCreatedAt:
        row.latestCreatedAt === null
          ? null
          : parseDatabaseDate(row.latestCreatedAt, 'profile summary'),
    };
  }

  async listScoreSparkline(userId: string, limit: number): Promise<number[]> {
    const rows = await this.db
      .select({ score: profileAnalyses.winningScore })
      .from(profileAnalyses)
      .where(eq(profileAnalyses.userId, userId))
      .orderBy(desc(profileAnalyses.createdAt), desc(profileAnalyses.id))
      .limit(limit);
    return rows.map(({ score }) => score);
  }

  async getSuggestionStatuses(
    userId: string,
  ): Promise<SuggestionStatusRecord[]> {
    return this.db
      .select({ status: profileRecommendations.status, value: count() })
      .from(profileRecommendations)
      .innerJoin(
        profileAnalyses,
        eq(profileRecommendations.analysisId, profileAnalyses.id),
      )
      .where(eq(profileAnalyses.userId, userId))
      .groupBy(profileRecommendations.status);
  }

  async getJobSummary(
    userId: string,
    last30DaysSince: Date,
    highFitThreshold: number,
  ): Promise<JobSummaryRecord> {
    const [row] = await this.db
      .select({
        analysesCount: count(),
        analysesLast30Days: sql<number>`count(*) filter (
          where ${jobAnalyses.createdAt} >= ${last30DaysSince}
        )::int`,
        averageMatchScore: avg(jobAnalyses.matchScore),
        averageMatchScoreLast30Days: sql<string | null>`avg(
          ${jobAnalyses.matchScore}
        ) filter (where ${jobAnalyses.createdAt} >= ${last30DaysSince})`,
        highFitCount: sql<number>`count(*) filter (
          where ${jobAnalyses.matchScore} >= ${highFitThreshold}
        )::int`,
        averageMatchScoreApplied: sql<string | null>`avg(
          ${jobAnalyses.matchScore}
        ) filter (where exists (
          select 1 from ${proposalDrafts}
          where ${proposalDrafts.jobAnalysisId} = ${jobAnalyses.id}
            and ${proposalDrafts.userId} = ${userId}
        ))`,
      })
      .from(jobAnalyses)
      .where(eq(jobAnalyses.userId, userId));
    if (!row) throw new Error('Job summary query returned no row.');
    return row;
  }

  async getProposalSummary(
    userId: string,
    last30DaysSince: Date,
  ): Promise<ProposalSummaryRecord> {
    const [row] = await this.db
      .select({
        draftedCount: count(),
        draftedLast30Days: sql<number>`count(*) filter (
          where ${proposalDrafts.createdAt} >= ${last30DaysSince}
        )::int`,
        copiedBlocks: sum(sql<number>`(
          select count(*)::int
          from jsonb_each_text(${proposalDrafts.blockStatuses}) as block_status
          where block_status.value = 'copied'
        )`),
        averageProposalWords: avg(
          sql<number>`(${proposalDrafts.proposal}->>'wordCount')::int`,
        ),
      })
      .from(proposalDrafts)
      .where(eq(proposalDrafts.userId, userId));
    if (!row) throw new Error('Proposal summary query returned no row.');
    return row;
  }

  async getOutcomeSummary(userId: string): Promise<OutcomeSummaryRecord> {
    const [row] = await this.db
      .select({
        sent: sql<number>`count(*) filter (
          where ${proposalOutcomes.sentAt} is not null
        )::int`,
        inProgress: sql<number>`count(*) filter (
          where ${proposalOutcomes.status} = 'in-progress'
        )::int`,
        viewed: sql<number>`count(*) filter (
          where ${proposalOutcomes.status} = 'viewed'
        )::int`,
        messaged: sql<number>`count(*) filter (
          where ${proposalOutcomes.status} = 'messaged'
        )::int`,
        interviewing: sql<number>`count(*) filter (
          where ${proposalOutcomes.status} = 'interviewing'
        )::int`,
        hired: sql<number>`count(*) filter (
          where ${proposalOutcomes.status} = 'hired'
        )::int`,
        declined: sql<number>`count(*) filter (
          where ${proposalOutcomes.status} = 'declined'
        )::int`,
        noResponse: sql<number>`count(*) filter (
          where ${proposalOutcomes.status} = 'no-response'
        )::int`,
        connectsSpent: sum(proposalOutcomes.connectsSpent),
      })
      .from(proposalOutcomes)
      .where(eq(proposalOutcomes.userId, userId));
    if (!row) throw new Error('Outcome summary query returned no row.');
    return row;
  }

  async findActiveGoal(userId: string): Promise<Goal | null> {
    const [goal] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isActive, true)))
      .limit(1);
    return goal ?? null;
  }

  async listRecentActivity(
    userId: string,
    limit: number,
  ): Promise<RecentActivityRecord[]> {
    const result = await this.db.execute<RecentActivityQueryRecord>(sql`
      select kind, id, occurred_at as "occurredAt", label, score, status
      from (
        select
          'profile-analysis'::text as kind,
          ${profileAnalyses.id} as id,
          ${profileAnalyses.createdAt} as occurred_at,
          'Profile analysis'::text as label,
          ${profileAnalyses.winningScore} as score,
          null::text as status
        from ${profileAnalyses}
        where ${profileAnalyses.userId} = ${userId}

        union all

        select
          'job-analysis'::text,
          ${jobAnalyses.id},
          ${jobAnalyses.createdAt},
          ${jobSnapshots.snapshot}->'job'->>'title',
          ${jobAnalyses.matchScore},
          null::text
        from ${jobAnalyses}
        inner join ${jobSnapshots}
          on ${jobAnalyses.jobSnapshotId} = ${jobSnapshots.id}
        where ${jobAnalyses.userId} = ${userId}

        union all

        select
          'proposal-draft'::text,
          ${proposalDrafts.id},
          ${proposalDrafts.createdAt},
          ${jobSnapshots.snapshot}->'job'->>'title',
          null::int,
          null::text
        from ${proposalDrafts}
        inner join ${jobAnalyses}
          on ${proposalDrafts.jobAnalysisId} = ${jobAnalyses.id}
        inner join ${jobSnapshots}
          on ${jobAnalyses.jobSnapshotId} = ${jobSnapshots.id}
        where ${proposalDrafts.userId} = ${userId}

        union all

        select
          'proposal-outcome'::text,
          ${proposalOutcomes.id},
          ${proposalOutcomes.updatedAt},
          ${jobSnapshots.snapshot}->'job'->>'title',
          null::int,
          ${proposalOutcomes.status}
        from ${proposalOutcomes}
        inner join ${jobAnalyses}
          on ${proposalOutcomes.jobAnalysisId} = ${jobAnalyses.id}
        inner join ${jobSnapshots}
          on ${jobAnalyses.jobSnapshotId} = ${jobSnapshots.id}
        where ${proposalOutcomes.userId} = ${userId}
          and ${proposalOutcomes.sentAt} is not null
      ) as activity
      order by occurred_at desc, id desc
      limit ${limit}
    `);
    return result.rows.map((row) => ({
      ...row,
      occurredAt: parseDatabaseDate(row.occurredAt, 'recent activity'),
    }));
  }

  async listActivityDays(
    userId: string,
    timeZone: string,
    from: string,
    to: string,
  ): Promise<ActivityDayRecord[]> {
    const result = await this.db.execute<ActivityDayRecord>(sql`
      with draft_days as (
        select
          date_trunc('day', ${proposalDrafts.createdAt} at time zone ${timeZone}) as day,
          count(*)::int as drafted
        from ${proposalDrafts}
        where ${proposalDrafts.userId} = ${userId}
          and ${proposalDrafts.createdAt} >= (${from}::date at time zone ${timeZone})
          and ${proposalDrafts.createdAt} < ((${to}::date + 1) at time zone ${timeZone})
        group by day
      ), sent_days as (
        select
          date_trunc('day', ${proposalOutcomes.sentAt} at time zone ${timeZone}) as day,
          count(*)::int as sent
        from ${proposalOutcomes}
        where ${proposalOutcomes.userId} = ${userId}
          and ${proposalOutcomes.sentAt} >= (${from}::date at time zone ${timeZone})
          and ${proposalOutcomes.sentAt} < ((${to}::date + 1) at time zone ${timeZone})
        group by day
      )
      select
        to_char(draft_days.day, 'YYYY-MM-DD') as date,
        draft_days.drafted,
        coalesce(sent_days.sent, 0)::int as sent
      from draft_days
      left join sent_days on sent_days.day = draft_days.day
      order by draft_days.day asc
    `);
    return result.rows;
  }

  async getActivityTotals(
    userId: string,
    timeZone: string,
    from: string,
    to: string,
  ): Promise<ActivityTotalsRecord> {
    const result = await this.db.execute<ActivityTotalsRecord>(sql`
      select
        (
          select count(*)::int from ${proposalDrafts}
          where ${proposalDrafts.userId} = ${userId}
            and ${proposalDrafts.createdAt} >= (${from}::date at time zone ${timeZone})
            and ${proposalDrafts.createdAt} < ((${to}::date + 1) at time zone ${timeZone})
        ) as drafted,
        (
          select count(*)::int from ${proposalOutcomes}
          where ${proposalOutcomes.userId} = ${userId}
            and ${proposalOutcomes.sentAt} >= (${from}::date at time zone ${timeZone})
            and ${proposalOutcomes.sentAt} < ((${to}::date + 1) at time zone ${timeZone})
        ) as sent
    `);
    const row = result.rows[0];
    if (!row) throw new Error('Activity totals query returned no row.');
    return row;
  }

  async listScoreHistory(
    userId: string,
    limit: number,
  ): Promise<ScoreHistoryRecord[]> {
    return this.db
      .select({
        id: profileAnalyses.id,
        createdAt: profileAnalyses.createdAt,
        winningScore: profileAnalyses.winningScore,
        completenessScore: profileAnalyses.completenessScore,
        goalId: profileAnalyses.goalId,
        objective: goals.objective,
        sectionScores: profileAnalyses.sectionScores,
      })
      .from(profileAnalyses)
      .innerJoin(goals, eq(profileAnalyses.goalId, goals.id))
      .where(eq(profileAnalyses.userId, userId))
      .orderBy(desc(profileAnalyses.createdAt), desc(profileAnalyses.id))
      .limit(limit);
  }

  async getFunnelCounts(
    userId: string,
    since: Date | null,
  ): Promise<FunnelCountsRecord> {
    const result = await this.db.execute<FunnelCountsRecord>(sql`
      select
        (
          select count(distinct ${jobAnalyses.id})::int
          from ${jobAnalyses}
          where ${jobAnalyses.userId} = ${userId}
            and (${since}::timestamptz is null or ${jobAnalyses.createdAt} >= ${since})
        ) as "jobsAnalyzed",
        (
          select count(distinct ${proposalDrafts.jobAnalysisId})::int
          from ${proposalDrafts}
          where ${proposalDrafts.userId} = ${userId}
            and (${since}::timestamptz is null or ${proposalDrafts.createdAt} >= ${since})
        ) as "proposalsDrafted",
        (
          select count(distinct ${proposalOutcomes.jobAnalysisId})::int
          from ${proposalOutcomes}
          where ${proposalOutcomes.userId} = ${userId}
            and ${proposalOutcomes.sentAt} is not null
            and (${since}::timestamptz is null or ${proposalOutcomes.sentAt} >= ${since})
        ) as sent,
        (
          select count(distinct ${proposalOutcomes.jobAnalysisId})::int
          from ${proposalOutcomes}
          where ${proposalOutcomes.userId} = ${userId}
            and ${proposalOutcomes.status} in ('viewed', 'messaged', 'interviewing', 'hired')
            and (${since}::timestamptz is null or ${proposalOutcomes.respondedAt} >= ${since})
        ) as replied,
        (
          select count(distinct ${proposalOutcomes.jobAnalysisId})::int
          from ${proposalOutcomes}
          where ${proposalOutcomes.userId} = ${userId}
            and ${proposalOutcomes.status} in ('interviewing', 'hired')
            and (${since}::timestamptz is null or ${proposalOutcomes.respondedAt} >= ${since})
        ) as interviewing,
        (
          select count(distinct ${proposalOutcomes.jobAnalysisId})::int
          from ${proposalOutcomes}
          where ${proposalOutcomes.userId} = ${userId}
            and ${proposalOutcomes.status} = 'hired'
            and (${since}::timestamptz is null or ${proposalOutcomes.decidedAt} >= ${since})
        ) as hired
    `);
    const row = result.rows[0];
    if (!row) throw new Error('Funnel query returned no row.');
    return row;
  }
}

function parseDatabaseDate(value: Date | string, resource: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`The ${resource} query returned an invalid timestamp.`);
  }
  return parsed;
}
