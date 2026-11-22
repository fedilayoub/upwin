import { describe, expect, it, vi } from 'vitest';
import { PROFILE_SECTION_IDS } from '../profile/profile-section';
import type {
  InsightsRepository,
  ProfileSummaryRecord,
  ScoreHistoryRecord,
} from './insights.repository';
import {
  InsightsService,
  activityLevels,
  buildFunnelSteps,
  buildOutcomeSummary,
  buildScoreHistory,
  calculateWeekStreaks,
} from './insights.service';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const GOAL_A = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const GOAL_B = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';

describe('insights summary math', () => {
  it('keeps outcome counts visible while suppressing rates below the minimum sample', () => {
    const response = buildOutcomeSummary({
      sent: 3,
      inProgress: 1,
      viewed: 1,
      messaged: 0,
      interviewing: 1,
      hired: 0,
      declined: 0,
      noResponse: 1,
      connectsSpent: '24',
    });

    expect(response).toMatchObject({
      sent: 3,
      viewed: 1,
      interviewing: 1,
      hired: 0,
      noResponse: 1,
      // On the wire so a client can render "2 of 3 replied" without summing
      // status buckets itself.
      replied: 2,
      interviewed: 1,
      replyRate: null,
      interviewRate: null,
      winRate: null,
      connectsPerInterview: null,
      sufficientData: false,
      minimumSample: 5,
    });
  });

  it('computes rates from current outcome states once the sample is sufficient', () => {
    const response = buildOutcomeSummary({
      sent: 10,
      inProgress: 2,
      viewed: 2,
      messaged: 0,
      interviewing: 2,
      hired: 1,
      declined: 3,
      noResponse: 2,
      connectsSpent: '50',
    });

    expect(response).toMatchObject({
      replyRate: 0.5,
      interviewRate: 0.3,
      winRate: 0.1,
      connectsPerInterview: 50 / 3,
      sufficientData: true,
    });
  });

  it('counts a messaged application as a reply', () => {
    const response = buildOutcomeSummary({
      sent: 5,
      inProgress: 1,
      viewed: 0,
      messaged: 1,
      interviewing: 0,
      hired: 0,
      declined: 0,
      noResponse: 4,
      connectsSpent: null,
    });

    expect(response).toMatchObject({ replied: 1, replyRate: 0.2 });
  });

  it('returns null deltas for one analysis and preserves absent completeness as null', async () => {
    const repository = createRepository({
      profile: {
        ...singleProfile,
        latestCompletenessScore: null,
      },
    });
    const service = new InsightsService(repository);

    const response = await service.summary(
      USER_ID,
      new Date('2026-08-25T12:00:00.000Z'),
    );

    expect(response.profile).toMatchObject({
      latestWinningScore: 70,
      deltaSincePrevious: null,
      deltaSinceFirst: null,
      latestCompletenessScore: null,
    });
  });

  it('does not turn a real zero completeness score into null', async () => {
    const repository = createRepository({
      profile: { ...singleProfile, latestCompletenessScore: 0 },
    });
    const response = await new InsightsService(repository).summary(USER_ID);

    expect(response.profile.latestCompletenessScore).toBe(0);
  });
});

describe('activity helpers', () => {
  it('keeps an ISO-week streak across a calendar-year boundary', () => {
    expect(
      calculateWeekStreaks(
        [{ date: '2024-12-23' }, { date: '2024-12-31' }],
        '2025-01-02',
      ),
    ).toEqual({ current: 2, longest: 2 });
  });

  it('lets an inactive in-progress current week retain the preceding streak', () => {
    expect(
      calculateWeekStreaks(
        [{ date: '2024-12-23' }, { date: '2025-01-02' }],
        '2025-01-08',
      ).current,
    ).toBe(2);
  });

  it('assigns quartile levels and treats equal active-day counts as maximum intensity', () => {
    expect(activityLevels([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(activityLevels([2, 2, 2])).toEqual([4, 4, 4]);
  });
});

describe('score history helpers', () => {
  it('creates three goal segments when the user switches away and back', () => {
    const response = buildScoreHistory(
      [
        historyRow(GOAL_A, 'first-client', '2026-01-01T00:00:00.000Z', 50),
        historyRow(GOAL_B, 'more-clients', '2026-02-01T00:00:00.000Z', 60),
        historyRow(GOAL_A, 'first-client', '2026-03-01T00:00:00.000Z', 70),
      ],
      false,
    );

    expect(response.goalSegments.map(({ goalId }) => goalId)).toEqual([
      GOAL_A,
      GOAL_B,
      GOAL_A,
    ]);
    expect(response.comparableAcrossRange).toBe(false);
    expect(response.sectionDeltas).toHaveLength(PROFILE_SECTION_IDS.length);
    expect(response.sectionDeltas[0]).toMatchObject({ delta: 20 });
  });
});

const sectionScores = (score: number) =>
  PROFILE_SECTION_IDS.map((id) => ({ id, score, criteria: [] }));

const singleProfile: ProfileSummaryRecord = {
  analysesCount: 1,
  analysesLast30Days: 1,
  distinctGoalCount: 1,
  latestId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1d',
  latestWinningScore: 70,
  latestCompletenessScore: null,
  latestCreatedAt: new Date('2026-08-24T12:00:00.000Z'),
  latestSectionScores: sectionScores(70),
  previousWinningScore: null,
  firstWinningScore: 70,
};

function createRepository(overrides: {
  profile: ProfileSummaryRecord;
}): InsightsRepository {
  return {
    getProfileSummary: vi.fn().mockResolvedValue(overrides.profile),
    listScoreSparkline: vi.fn().mockResolvedValue([70]),
    getSuggestionStatuses: vi.fn().mockResolvedValue([]),
    getJobSummary: vi.fn().mockResolvedValue({
      analysesCount: 0,
      analysesLast30Days: 0,
      averageMatchScore: null,
      averageMatchScoreLast30Days: null,
      highFitCount: 0,
      averageMatchScoreApplied: null,
    }),
    getProposalSummary: vi.fn().mockResolvedValue({
      draftedCount: 0,
      draftedLast30Days: 0,
      copiedBlocks: null,
      averageProposalWords: null,
    }),
    getOutcomeSummary: vi.fn().mockResolvedValue({
      sent: 0,
      inProgress: 0,
      viewed: 0,
      messaged: 0,
      interviewing: 0,
      hired: 0,
      declined: 0,
      noResponse: 0,
      connectsSpent: null,
    }),
    findActiveGoal: vi.fn().mockResolvedValue(null),
    listRecentActivity: vi.fn().mockResolvedValue([]),
  } as unknown as InsightsRepository;
}

function historyRow(
  goalId: string,
  objective: ScoreHistoryRecord['objective'],
  createdAt: string,
  score: number,
): ScoreHistoryRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date(createdAt),
    winningScore: score,
    completenessScore: null,
    goalId,
    objective,
    sectionScores: sectionScores(score),
  };
}

describe('funnel shares', () => {
  it('divides every step by the first one', () => {
    const steps = buildFunnelSteps({
      jobsAnalyzed: 40,
      proposalsDrafted: 20,
      sent: 10,
      replied: 5,
      interviewing: 2,
      hired: 1,
    });

    expect(steps.map((step) => step.share)).toEqual([
      1, 0.5, 0.25, 0.125, 0.05, 0.025,
    ]);
  });

  it('reports a null share rather than zero when the funnel is empty', () => {
    const steps = buildFunnelSteps({
      jobsAnalyzed: 0,
      proposalsDrafted: 0,
      sent: 0,
      replied: 0,
      interviewing: 0,
      hired: 0,
    });

    // 0/0 is not 0. A share of zero would draw an empty funnel for a user who
    // has simply not started, which is a different fact.
    expect(steps.every((step) => step.share === null)).toBe(true);
    expect(steps.every((step) => step.count === 0)).toBe(true);
  });

  it('does not clamp a step that exceeds the first', () => {
    // Legitimate: an outcome marked for a job whose analysis fell outside the
    // window. Clamping to 1 would hide it.
    const steps = buildFunnelSteps({
      jobsAnalyzed: 2,
      proposalsDrafted: 3,
      sent: 3,
      replied: 1,
      interviewing: 0,
      hired: 0,
    });

    expect(steps[1]?.share).toBe(1.5);
  });
});
