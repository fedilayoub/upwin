import { Injectable } from '@nestjs/common';
import { sectionScoresSchema } from '../profile/analysis/profile-analysis.schema';
import { PROFILE_SECTION_IDS } from '../profile/profile-section';
import {
  ACTIVITY_WINDOW_DAYS,
  HIGH_FIT_THRESHOLD,
  MINIMUM_OUTCOME_SAMPLE,
  RECENT_ACTIVITY_LIMIT,
  SPARKLINE_POINTS,
} from './insights.constants';
import {
  FUNNEL_STEP_IDS,
  insightsActivityResponseSchema,
  insightsFunnelResponseSchema,
  insightsScoreHistoryResponseSchema,
  insightsSummaryResponseSchema,
  type ActivityQuery,
  type FunnelQuery,
  type FunnelWindow,
  type InsightsActivityResponse,
  type InsightsFunnelResponse,
  type InsightsScoreHistoryResponse,
  type InsightsSummaryResponse,
  type ScoreHistoryQuery,
} from './insights.schema';
import {
  InsightsRepository,
  type ActivityDayRecord,
  type OutcomeSummaryRecord,
  type ScoreHistoryRecord,
} from './insights.repository';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

@Injectable()
export class InsightsService {
  constructor(private readonly repository: InsightsRepository) {}

  async summary(
    userId: string,
    now = new Date(),
  ): Promise<InsightsSummaryResponse> {
    const last30DaysSince = new Date(now.getTime() - 30 * DAY_MS);
    const [
      profile,
      sparkline,
      suggestionStatuses,
      jobs,
      proposals,
      outcomes,
      activeGoal,
      recentActivity,
    ] = await Promise.all([
      this.repository.getProfileSummary(userId, last30DaysSince),
      this.repository.listScoreSparkline(userId, SPARKLINE_POINTS),
      this.repository.getSuggestionStatuses(userId),
      this.repository.getJobSummary(
        userId,
        last30DaysSince,
        HIGH_FIT_THRESHOLD,
      ),
      this.repository.getProposalSummary(userId, last30DaysSince),
      this.repository.getOutcomeSummary(userId),
      this.repository.findActiveGoal(userId),
      this.repository.listRecentActivity(userId, RECENT_ACTIVITY_LIMIT),
    ]);

    const latestSections =
      profile.latestSectionScores === null
        ? null
        : sectionScoresSchema.parse(profile.latestSectionScores);
    const strongestSection =
      latestSections === null
        ? null
        : latestSections.reduce((strongest, section) =>
            section.score > strongest.score ? section : strongest,
          ).id;
    const biggestOpportunity =
      latestSections === null
        ? null
        : latestSections.reduce((weakest, section) =>
            section.score < weakest.score ? section : weakest,
          ).id;
    const suggestions = Object.fromEntries(
      suggestionStatuses.map(({ status, value }) => [status, value]),
    );
    const copied = suggestions.copied ?? 0;
    const dismissed = suggestions.dismissed ?? 0;
    const decidedSuggestions = copied + dismissed;
    const outcomeResponse = buildOutcomeSummary(outcomes);

    return insightsSummaryResponseSchema.parse({
      generatedAt: now.toISOString(),
      profile: {
        latestWinningScore: profile.latestWinningScore,
        latestAnalysisId: profile.latestId,
        lastAnalysisAt: profile.latestCreatedAt?.toISOString() ?? null,
        daysSinceLastAnalysis:
          profile.latestCreatedAt === null
            ? null
            : Math.max(
                0,
                Math.floor(
                  (now.getTime() - profile.latestCreatedAt.getTime()) / DAY_MS,
                ),
              ),
        deltaSincePrevious:
          profile.analysesCount < 2 ||
          profile.latestWinningScore === null ||
          profile.previousWinningScore === null
            ? null
            : profile.latestWinningScore - profile.previousWinningScore,
        deltaSinceFirst:
          profile.analysesCount < 2 ||
          profile.latestWinningScore === null ||
          profile.firstWinningScore === null
            ? null
            : profile.latestWinningScore - profile.firstWinningScore,
        latestCompletenessScore: profile.latestCompletenessScore,
        analysesCount: profile.analysesCount,
        analysesLast30Days: profile.analysesLast30Days,
        strongestSection,
        biggestOpportunity,
        scoreSparkline: [...sparkline].reverse(),
        goalChangedSinceFirstAnalysis: profile.distinctGoalCount > 1,
        activeGoal:
          activeGoal === null
            ? null
            : {
                id: activeGoal.id,
                objective: activeGoal.objective,
                targetRole: activeGoal.targetRole,
              },
      },
      suggestions: {
        copied,
        dismissed,
        pending: suggestions.pending ?? 0,
        adoptionRate:
          decidedSuggestions === 0 ? null : copied / decidedSuggestions,
      },
      jobs: {
        analysesCount: jobs.analysesCount,
        analysesLast30Days: jobs.analysesLast30Days,
        averageMatchScore: roundedNullable(jobs.averageMatchScore),
        averageMatchScoreLast30Days: roundedNullable(
          jobs.averageMatchScoreLast30Days,
        ),
        highFitCount: jobs.highFitCount,
        highFitShare:
          jobs.analysesCount === 0 ? 0 : jobs.highFitCount / jobs.analysesCount,
        highFitThreshold: HIGH_FIT_THRESHOLD,
        averageMatchScoreApplied: roundedNullable(
          jobs.averageMatchScoreApplied,
        ),
      },
      proposals: {
        draftedCount: proposals.draftedCount,
        draftedLast30Days: proposals.draftedLast30Days,
        copiedBlocks: numberOrZero(proposals.copiedBlocks),
        averageProposalWords: roundedNullable(proposals.averageProposalWords),
      },
      outcomes: outcomeResponse,
      recentActivity: recentActivity.map((activity) => {
        const common = {
          id: activity.id,
          occurredAt: activity.occurredAt.toISOString(),
          label: activity.label,
        };
        if (activity.kind === 'proposal-outcome') {
          if (activity.status === null) {
            throw new Error('Proposal outcome activity is missing its status.');
          }
          return {
            ...common,
            kind: activity.kind,
            score: null,
            status: activity.status,
          };
        }
        if (activity.kind === 'proposal-draft') {
          return { ...common, kind: activity.kind, score: null };
        }
        if (activity.score === null) {
          throw new Error('Scored activity is missing its score.');
        }
        return { ...common, kind: activity.kind, score: activity.score };
      }),
    });
  }

  async activity(
    userId: string,
    query: ActivityQuery,
    now = new Date(),
  ): Promise<InsightsActivityResponse> {
    const to = formatCalendarDate(now, query.timeZone);
    const from = shiftCalendarDate(to, -(ACTIVITY_WINDOW_DAYS - 1));
    const [dayRows, totals] = await Promise.all([
      this.repository.listActivityDays(userId, query.timeZone, from, to),
      this.repository.getActivityTotals(userId, query.timeZone, from, to),
    ]);
    const levels = activityLevels(dayRows.map(({ drafted }) => drafted));
    const streaks = calculateWeekStreaks(dayRows, to);

    return insightsActivityResponseSchema.parse({
      timeZone: query.timeZone,
      from,
      to,
      days: dayRows.map((day, index) => ({
        ...day,
        level: levels[index] ?? 0,
      })),
      totals: {
        drafted: totals.drafted,
        sent: totals.sent,
        activeDays: dayRows.length,
      },
      currentStreakWeeks: streaks.current,
      longestStreakWeeks: streaks.longest,
      maxPerDay: Math.max(0, ...dayRows.map(({ drafted }) => drafted)),
    });
  }

  async scoreHistory(
    userId: string,
    query: ScoreHistoryQuery,
  ): Promise<InsightsScoreHistoryResponse> {
    const newest = await this.repository.listScoreHistory(
      userId,
      query.limit + 1,
    );
    const truncated = newest.length > query.limit;
    const rows = newest.slice(0, query.limit).reverse();
    return buildScoreHistory(rows, truncated);
  }

  async funnel(
    userId: string,
    query: FunnelQuery,
    now = new Date(),
  ): Promise<InsightsFunnelResponse> {
    const counts = await this.repository.getFunnelCounts(
      userId,
      funnelSince(query.window, now),
    );
    return insightsFunnelResponseSchema.parse({
      window: query.window,
      steps: buildFunnelSteps(counts),
    });
  }
}

export function buildFunnelSteps(
  counts: Record<(typeof FUNNEL_STEP_IDS)[number], number>,
): InsightsFunnelResponse['steps'] {
  // The first step is the funnel's denominator. With nothing at the top there is
  // no share to report, and 0/0 must not become 0 — that would draw an empty
  // funnel for a user who simply has no data yet.
  const total = counts[FUNNEL_STEP_IDS[0]];
  return FUNNEL_STEP_IDS.map((id) => ({
    id,
    count: counts[id],
    share: total === 0 ? null : counts[id] / total,
  }));
}

export function buildOutcomeSummary(
  outcomes: OutcomeSummaryRecord,
): InsightsSummaryResponse['outcomes'] {
  const sufficientData = outcomes.sent >= MINIMUM_OUTCOME_SAMPLE;
  const connectsSpent = nullableNumber(outcomes.connectsSpent);
  const replied =
    outcomes.viewed +
    outcomes.messaged +
    outcomes.interviewing +
    outcomes.hired;
  const interviewed = outcomes.interviewing + outcomes.hired;
  return {
    sent: outcomes.sent,
    viewed: outcomes.viewed,
    interviewing: outcomes.interviewing,
    hired: outcomes.hired,
    declined: outcomes.declined,
    noResponse: outcomes.noResponse,
    replied,
    interviewed,
    replyRate: sufficientData ? replied / outcomes.sent : null,
    interviewRate: sufficientData ? interviewed / outcomes.sent : null,
    winRate: sufficientData ? outcomes.hired / outcomes.sent : null,
    connectsSpent,
    connectsPerInterview:
      !sufficientData ||
      connectsSpent === null ||
      connectsSpent === 0 ||
      interviewed === 0
        ? null
        : connectsSpent / interviewed,
    sufficientData,
    minimumSample: MINIMUM_OUTCOME_SAMPLE,
  };
}

export function activityLevels(counts: readonly number[]): number[] {
  if (counts.length === 0) return [];
  const sorted = [...counts].sort((left, right) => left - right);
  const minimum = sorted[0];
  const maximum = sorted.at(-1);
  if (minimum === undefined || maximum === undefined) return [];
  if (minimum === maximum) return counts.map(() => 4);
  const q1 = percentile(sorted, 0.25);
  const q2 = percentile(sorted, 0.5);
  const q3 = percentile(sorted, 0.75);
  return counts.map((value) => {
    if (value === maximum) return 4;
    if (value <= q1) return 1;
    if (value <= q2) return 2;
    if (value <= q3) return 3;
    return 4;
  });
}

export function calculateWeekStreaks(
  days: readonly Pick<ActivityDayRecord, 'date'>[],
  currentDate: string,
): { current: number; longest: number } {
  const activeWeeks = new Set(days.map(({ date }) => isoWeekStart(date)));
  const ordered = [...activeWeeks].sort((left, right) => left - right);
  let longest = 0;
  let run = 0;
  let previous: number | undefined;
  for (const week of ordered) {
    run = previous !== undefined && week - previous === WEEK_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = week;
  }

  const thisWeek = isoWeekStart(currentDate);
  let cursor = activeWeeks.has(thisWeek) ? thisWeek : thisWeek - WEEK_MS;
  let current = 0;
  while (activeWeeks.has(cursor)) {
    current += 1;
    cursor -= WEEK_MS;
  }
  return { current, longest };
}

export function buildScoreHistory(
  rows: readonly ScoreHistoryRecord[],
  truncated: boolean,
): InsightsScoreHistoryResponse {
  const points = rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    winningScore: row.winningScore,
    completenessScore: row.completenessScore,
    goalId: row.goalId,
    objective: row.objective,
  }));
  const goalSegments: InsightsScoreHistoryResponse['goalSegments'] = [];
  for (const point of points) {
    const previous = goalSegments.at(-1);
    if (previous?.goalId === point.goalId) {
      previous.to = point.createdAt;
      previous.count += 1;
    } else {
      goalSegments.push({
        goalId: point.goalId,
        objective: point.objective,
        from: point.createdAt,
        to: point.createdAt,
        count: 1,
      });
    }
  }
  const first = rows[0];
  const latest = rows.at(-1);
  const sectionDeltas =
    first === undefined || latest === undefined
      ? []
      : (() => {
          const firstSections = sectionScoresSchema.parse(first.sectionScores);
          const latestSections = sectionScoresSchema.parse(
            latest.sectionScores,
          );
          const firstById = new Map(
            firstSections.map((section) => [section.id, section.score]),
          );
          const latestById = new Map(
            latestSections.map((section) => [section.id, section.score]),
          );
          return PROFILE_SECTION_IDS.map((id) => {
            const firstScore = firstById.get(id);
            const latestScore = latestById.get(id);
            if (firstScore === undefined || latestScore === undefined) {
              throw new Error(`Score history is missing section ${id}.`);
            }
            return {
              id,
              firstScore,
              latestScore,
              delta: rows.length < 2 ? null : latestScore - firstScore,
            };
          });
        })();

  return insightsScoreHistoryResponseSchema.parse({
    points,
    goalSegments,
    sectionDeltas,
    comparableAcrossRange: goalSegments.length <= 1,
    truncated,
  });
}

function funnelSince(window: FunnelWindow, now: Date): Date | null {
  if (window === 'all') return null;
  const days = window === '30d' ? 30 : window === '90d' ? 90 : 365;
  return new Date(now.getTime() - days * DAY_MS);
}

function roundedNullable(value: string | null): number | null {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function nullableNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error('Aggregate is not a finite number.');
  return parsed;
}

function numberOrZero(value: string | null): number {
  return nullableNumber(value) ?? 0;
}

function percentile(
  sorted: readonly number[],
  percentileValue: number,
): number {
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  const value = sorted[Math.max(0, index)];
  if (value === undefined)
    throw new Error('Cannot calculate an empty percentile.');
  return value;
}

function formatCalendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  if (
    values.year === undefined ||
    values.month === undefined ||
    values.day === undefined
  ) {
    throw new Error('Could not format the activity calendar date.');
  }
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftCalendarDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function isoWeekStart(date: string): number {
  const value = new Date(`${date}T00:00:00.000Z`);
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.getTime();
}
