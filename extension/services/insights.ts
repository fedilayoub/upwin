import { PROFILE_SECTION_IDS } from '@/types/profile';
import type {
  ActivityCalendar,
  InsightsSummary,
  ProposalOutcome,
  ProposalOutcomeStatus,
} from '@/types/insights';
import { z } from 'zod';
import { apiClient, type TokenProvider } from './api';

const goalObjectiveSchema = z.enum([
  'first-client',
  'more-clients',
  'more-responses',
  'higher-paying-projects',
  'scale',
]);
const outcomeStatusSchema = z.enum([
  'in-progress',
  'sent',
  'viewed',
  'messaged',
  'interviewing',
  'hired',
  'declined',
  'no-response',
]);
const activityLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
const countSchema = z.number().int().nonnegative();
const nullableScoreSchema = z.number().int().min(0).max(100).nullable();
const nullableRateSchema = z.number().min(0).nullable();

const scoredActivityBase = {
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  label: z.string().trim().min(1),
  score: z.number().int().min(0).max(100),
};
const unscoredActivityBase = {
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  label: z.string().trim().min(1),
  score: z.null(),
};

const insightsSummarySchema = z
  .object({
    generatedAt: z.iso.datetime(),
    profile: z
      .object({
        latestWinningScore: nullableScoreSchema,
        latestAnalysisId: z.uuid().nullable(),
        lastAnalysisAt: z.iso.datetime().nullable(),
        daysSinceLastAnalysis: countSchema.nullable(),
        deltaSincePrevious: z.number().int().nullable(),
        deltaSinceFirst: z.number().int().nullable(),
        latestCompletenessScore: nullableScoreSchema,
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
            targetRole: z.string().trim().min(1),
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
        adoptionRate: nullableRateSchema,
      })
      .strict(),
    jobs: z
      .object({
        analysesCount: countSchema,
        analysesLast30Days: countSchema,
        averageMatchScore: nullableScoreSchema,
        averageMatchScoreLast30Days: nullableScoreSchema,
        highFitCount: countSchema,
        highFitShare: z.number().min(0).max(1),
        highFitThreshold: z.number().int().min(0).max(100),
        averageMatchScoreApplied: nullableScoreSchema,
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
        replyRate: nullableRateSchema,
        interviewRate: nullableRateSchema,
        winRate: nullableRateSchema,
        connectsSpent: countSchema.nullable(),
        connectsPerInterview: nullableRateSchema,
        sufficientData: z.boolean(),
        minimumSample: countSchema,
      })
      .strict(),
    recentActivity: z.array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('profile-analysis'), ...scoredActivityBase }).strict(),
        z.object({ kind: z.literal('job-analysis'), ...scoredActivityBase }).strict(),
        z.object({ kind: z.literal('proposal-draft'), ...unscoredActivityBase }).strict(),
        z
          .object({
            kind: z.literal('proposal-outcome'),
            ...unscoredActivityBase,
            status: outcomeStatusSchema,
          })
          .strict(),
      ]),
    ),
  })
  .strict();

const activityCalendarSchema = z
  .object({
    timeZone: z.string().trim().min(1),
    from: z.iso.date(),
    to: z.iso.date(),
    days: z.array(
      z
        .object({
          date: z.iso.date(),
          drafted: countSchema,
          sent: countSchema,
          level: activityLevelSchema,
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

const proposalOutcomeSchema = z
  .object({
    id: z.uuid(),
    jobAnalysisId: z.uuid(),
    status: outcomeStatusSchema,
    connectsSpent: countSchema.nullable(),
    sentAt: z.iso.datetime().nullable(),
    respondedAt: z.iso.datetime().nullable(),
    decidedAt: z.iso.datetime().nullable(),
    note: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

async function getInsightsSummary(
  getToken: TokenProvider,
): Promise<InsightsSummary> {
  const response = await apiClient.request<unknown>('/insights/summary', {
    getToken,
    method: 'GET',
    operation: 'GET /insights/summary',
  });

  return parseApiResponse(insightsSummarySchema, response, 'insights summary');
}

async function getActivity(
  getToken: TokenProvider,
): Promise<ActivityCalendar> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const query = new URLSearchParams({ timeZone });
  const response = await apiClient.request<unknown>(
    `/insights/activity?${query.toString()}`,
    {
      getToken,
      method: 'GET',
      operation: 'GET /insights/activity',
    },
  );

  return parseApiResponse(activityCalendarSchema, response, 'activity calendar');
}

async function putProposalOutcome(
  jobAnalysisId: string,
  status: ProposalOutcomeStatus,
  getToken: TokenProvider,
): Promise<ProposalOutcome> {
  const parsedId = z.uuid().safeParse(jobAnalysisId);
  const parsedStatus = outcomeStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    throw new Error('The selected proposal outcome is invalid.');
  }

  const response = await apiClient.request<unknown>(
    `/job-analyses/${parsedId.data}/outcome`,
    {
      body: JSON.stringify({ status: parsedStatus.data }),
      getToken,
      method: 'PUT',
      operation: 'PUT /job-analyses/:id/outcome',
    },
  );

  const outcome = parseApiResponse(
    proposalOutcomeSchema,
    response,
    'proposal outcome',
  );
  if (outcome.jobAnalysisId !== parsedId.data) {
    throw new Error('The backend returned an outcome for another job analysis.');
  }
  return outcome;
}

function parseApiResponse<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  resource: string,
): z.output<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`The backend returned an invalid ${resource} response.`);
  }
  return parsed.data;
}

export const insightsService = {
  getActivity,
  getInsightsSummary,
  putProposalOutcome,
};
