import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { goalObjectiveSchema } from '../goals/goal.schema';
import { PROFILE_SECTION_IDS } from '../profile/profile-section';
import { PROPOSAL_OUTCOME_STATUSES } from '../database/schema';
import { SCORE_HISTORY_DEFAULT_LIMIT } from './insights.constants';

const nullableScore = z.number().int().min(0).max(100).nullable();
const countSchema = z.number().int().nonnegative();
const nullableRate = z.number().min(0).nullable();

export const insightsSummaryResponseSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    profile: z
      .object({
        latestWinningScore: nullableScore,
        latestAnalysisId: z.uuid().nullable(),
        lastAnalysisAt: z.iso.datetime().nullable(),
        daysSinceLastAnalysis: countSchema.nullable(),
        deltaSincePrevious: z.number().int().nullable(),
        deltaSinceFirst: z.number().int().nullable(),
        latestCompletenessScore: nullableScore,
        analysesCount: countSchema,
        analysesLast30Days: countSchema,
        strongestSection: z.enum(PROFILE_SECTION_IDS).nullable(),
        biggestOpportunity: z.enum(PROFILE_SECTION_IDS).nullable(),
        scoreSparkline: z.array(z.number().int().min(0).max(100)),
        goalChangedSinceFirstAnalysis: z.boolean(),
        activeGoal: z
          .object({
            id: z.uuid(),
            objective: goalObjectiveSchema,
            targetRole: z.string().min(1),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    suggestions: z
      .object({
        copied: countSchema,
        dismissed: countSchema,
        pending: countSchema,
        adoptionRate: nullableRate,
      })
      .strict(),
    jobs: z
      .object({
        analysesCount: countSchema,
        analysesLast30Days: countSchema,
        averageMatchScore: nullableScore,
        averageMatchScoreLast30Days: nullableScore,
        highFitCount: countSchema,
        highFitShare: z.number().min(0).max(1),
        highFitThreshold: z.number().int().min(0).max(100),
        averageMatchScoreApplied: nullableScore,
      })
      .strict(),
    proposals: z
      .object({
        draftedCount: countSchema,
        draftedLast30Days: countSchema,
        copiedBlocks: countSchema,
        averageProposalWords: countSchema.nullable(),
      })
      .strict(),
    outcomes: z
      .object({
        sent: countSchema,
        viewed: countSchema,
        interviewing: countSchema,
        hired: countSchema,
        declined: countSchema,
        noResponse: countSchema,
        replied: countSchema,
        interviewed: countSchema,
        replyRate: nullableRate,
        interviewRate: nullableRate,
        winRate: nullableRate,
        connectsSpent: countSchema.nullable(),
        connectsPerInterview: nullableRate,
        sufficientData: z.boolean(),
        minimumSample: countSchema,
      })
      .strict(),
    recentActivity: z.array(
      z.discriminatedUnion('kind', [
        z
          .object({
            kind: z.literal('profile-analysis'),
            id: z.uuid(),
            occurredAt: z.iso.datetime(),
            label: z.string().min(1),
            score: z.number().int().min(0).max(100),
          })
          .strict(),
        z
          .object({
            kind: z.literal('job-analysis'),
            id: z.uuid(),
            occurredAt: z.iso.datetime(),
            label: z.string().min(1),
            score: z.number().int().min(0).max(100),
          })
          .strict(),
        z
          .object({
            kind: z.literal('proposal-draft'),
            id: z.uuid(),
            occurredAt: z.iso.datetime(),
            label: z.string().min(1),
            score: z.null(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('proposal-outcome'),
            id: z.uuid(),
            occurredAt: z.iso.datetime(),
            label: z.string().min(1),
            score: z.null(),
            status: z.enum(PROPOSAL_OUTCOME_STATUSES),
          })
          .strict(),
      ]),
    ),
  })
  .strict();

export const activityQuerySchema = z
  .object({
    timeZone: z.string().trim().min(1).max(100).default('UTC'),
  })
  .strict()
  .refine(
    ({ timeZone }) => isSupportedTimeZone(timeZone),
    'The time zone is invalid.',
  );

export const insightsActivityResponseSchema = z
  .object({
    timeZone: z.string().min(1),
    from: z.iso.date(),
    to: z.iso.date(),
    days: z.array(
      z
        .object({
          date: z.iso.date(),
          drafted: countSchema,
          sent: countSchema,
          level: z.number().int().min(0).max(4),
        })
        .strict(),
    ),
    totals: z
      .object({
        drafted: countSchema,
        sent: countSchema,
        activeDays: countSchema,
      })
      .strict(),
    currentStreakWeeks: countSchema,
    longestStreakWeeks: countSchema,
    maxPerDay: countSchema,
  })
  .strict();

export const scoreHistoryQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(365)
      .default(SCORE_HISTORY_DEFAULT_LIMIT),
  })
  .strict();

export const insightsScoreHistoryResponseSchema = z
  .object({
    points: z.array(
      z
        .object({
          id: z.uuid(),
          createdAt: z.iso.datetime(),
          winningScore: z.number().int().min(0).max(100),
          completenessScore: nullableScore,
          goalId: z.uuid(),
          objective: goalObjectiveSchema,
        })
        .strict(),
    ),
    goalSegments: z.array(
      z
        .object({
          goalId: z.uuid(),
          objective: goalObjectiveSchema,
          from: z.iso.datetime(),
          to: z.iso.datetime(),
          count: countSchema,
        })
        .strict(),
    ),
    sectionDeltas: z.array(
      z
        .object({
          id: z.enum(PROFILE_SECTION_IDS),
          firstScore: z.number().int().min(0).max(100),
          latestScore: z.number().int().min(0).max(100),
          delta: z.number().int().nullable(),
        })
        .strict(),
    ),
    comparableAcrossRange: z.boolean(),
    truncated: z.boolean(),
  })
  .strict();

export const FUNNEL_WINDOWS = ['30d', '90d', '365d', 'all'] as const;
export const funnelWindowSchema = z.enum(FUNNEL_WINDOWS);
export const FUNNEL_STEP_IDS = [
  'jobsAnalyzed',
  'proposalsDrafted',
  'sent',
  'replied',
  'interviewing',
  'hired',
] as const;

export const funnelQuerySchema = z
  .object({ window: funnelWindowSchema.default('all') })
  .strict();

export const insightsFunnelResponseSchema = z
  .object({
    window: z.enum(FUNNEL_WINDOWS),
    steps: z.array(
      z
        .object({
          id: z.enum(FUNNEL_STEP_IDS),
          count: countSchema,
          // Not bounded above: the steps are not guaranteed monotonic, so a
          // later step may legitimately exceed the first.
          share: nullableRate,
        })
        .strict(),
    ),
  })
  .strict();

export type InsightsSummaryResponse = z.output<
  typeof insightsSummaryResponseSchema
>;
export type ActivityQuery = z.output<typeof activityQuerySchema>;
export type InsightsActivityResponse = z.output<
  typeof insightsActivityResponseSchema
>;
export type ScoreHistoryQuery = z.output<typeof scoreHistoryQuerySchema>;
export type InsightsScoreHistoryResponse = z.output<
  typeof insightsScoreHistoryResponseSchema
>;
export type FunnelQuery = z.output<typeof funnelQuerySchema>;
export type FunnelWindow = FunnelQuery['window'];
export type InsightsFunnelResponse = z.output<
  typeof insightsFunnelResponseSchema
>;

export class ActivityQueryDto extends createZodDto(activityQuerySchema) {}
export class ScoreHistoryQueryDto extends createZodDto(
  scoreHistoryQuerySchema,
) {}
export class FunnelQueryDto extends createZodDto(funnelQuerySchema) {}

const supportedTimeZones = new Set(Intl.supportedValuesOf('timeZone'));

export function isSupportedTimeZone(timeZone: string): boolean {
  return timeZone === 'UTC' || supportedTimeZones.has(timeZone);
}
