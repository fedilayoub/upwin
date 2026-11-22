import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { InsightsSummary } from '@/types/insights';
import type { ProfileRecommendation } from '@/types/profile';

vi.mock('@/features/connection/connection-context', () => ({
  useConnection: () => ({ getToken: vi.fn() }),
}));
vi.mock('@/services/insights', () => ({
  insightsService: {
    getActivity: vi.fn(),
    getInsightsSummary: vi.fn(),
    putProposalOutcome: vi.fn(),
  },
}));
vi.mock('@/services/profile', () => ({
  profileService: { getAnalysis: vi.fn() },
}));

import { HomeStats, HomeView } from './home-screen';

const summary: InsightsSummary = {
  generatedAt: '2026-08-25T09:12:04.000Z',
  profile: {
    latestWinningScore: 84,
    latestAnalysisId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa11',
    lastAnalysisAt: '2026-08-23T10:00:00.000Z',
    daysSinceLastAnalysis: 2,
    deltaSincePrevious: 6,
    deltaSinceFirst: 20,
    latestCompletenessScore: 75,
    analysesCount: 7,
    analysesLast30Days: 3,
    strongestSection: 'trust',
    biggestOpportunity: 'positioning',
    scoreSparkline: [64, 68, 71, 78, 84],
    goalChangedSinceFirstAnalysis: true,
    activeGoal: {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa12',
      objective: 'more-clients',
      targetRole: 'Senior Frontend Developer',
    },
  },
  suggestions: { copied: 12, dismissed: 4, pending: 9, adoptionRate: 0.75 },
  jobs: {
    analysesCount: 34,
    analysesLast30Days: 11,
    averageMatchScore: 68,
    averageMatchScoreLast30Days: 71,
    highFitCount: 14,
    highFitShare: 0.41,
    highFitThreshold: 70,
    averageMatchScoreApplied: 76,
  },
  proposals: {
    draftedCount: 21,
    draftedLast30Days: 8,
    copiedBlocks: 17,
    averageProposalWords: 184,
  },
  outcomes: {
    sent: 18,
    viewed: 4,
    interviewing: 3,
    hired: 2,
    declined: 5,
    noResponse: 2,
    replied: 9,
    interviewed: 5,
    replyRate: 0.5,
    interviewRate: 0.28,
    winRate: 0.11,
    connectsSpent: 172,
    connectsPerInterview: 34.4,
    sufficientData: true,
    minimumSample: 5,
  },
  recentActivity: [
    {
      kind: 'job-analysis',
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa13',
      occurredAt: '2026-08-25T08:00:00.000Z',
      label: 'React SaaS dashboard',
      score: 91,
    },
  ],
};

const priorities: ProfileRecommendation[] = [
  {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa14',
    section: 'overview',
    rank: 1,
    impact: 'high',
    estimatedMinutes: 5,
    recommendation: 'Lead with the client problem you solve.',
    reason: 'The overview starts with experience.',
    evidence: ['The first sentence is generic.'],
  },
];

const onNavigate = vi.fn();
const onRetry = vi.fn();

describe('HomeView states', () => {
  it('renders tile-shaped skeletons while loading', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        data={null}
        error={null}
        onNavigate={onNavigate}
        onRetry={onRetry}
        status="loading"
      />,
    );

    expect(markup).toContain('aria-label="Loading insights"');
    // The goal line, the usage and stats tile, and the Focus Actions tile.
    expect(markup.match(/animate-pulse/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('renders the API message and retry action on error', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        data={null}
        error="Your insights could not be loaded."
        onNavigate={onNavigate}
        onRetry={onRetry}
        status="error"
      />,
    );

    expect(markup).toContain('Your insights could not be loaded.');
    expect(markup).toContain('Try again');
  });

  it('renders a first-analysis call to action instead of zero stats', () => {
    const zeroSummary: InsightsSummary = {
      ...summary,
      profile: {
        ...summary.profile,
        latestWinningScore: null,
        latestAnalysisId: null,
        lastAnalysisAt: null,
        daysSinceLastAnalysis: null,
        deltaSincePrevious: null,
        deltaSinceFirst: null,
        latestCompletenessScore: null,
        analysesCount: 0,
        analysesLast30Days: 0,
        strongestSection: null,
        biggestOpportunity: null,
        scoreSparkline: [],
      },
    };
    const markup = renderToStaticMarkup(
      <HomeView
        data={{ priorities: [], summary: zeroSummary }}
        error={null}
        onNavigate={onNavigate}
        onRetry={onRetry}
        status="success"
      />,
    );

    expect(markup).toContain('Run your first analysis');
    expect(markup).not.toContain('Your stats');
  });

  it('suppresses a percentage below the minimum sample', () => {
    const belowSample: InsightsSummary = {
      ...summary,
      outcomes: {
        ...summary.outcomes,
        sent: 3,
        viewed: 1,
        interviewing: 1,
        hired: 0,
        replied: 2,
        interviewed: 1,
        // Deliberately non-null: the tile must suppress on sufficientData alone,
        // not merely because the rate happened to be null.
        replyRate: 2 / 3,
        sufficientData: false,
        minimumSample: 5,
      },
    };
    const markup = renderToStaticMarkup(<HomeStats summary={belowSample} />);

    expect(markup).toContain('2 of 3');
    expect(markup).toContain('replied · rate needs 5');
    // 2/3 rounds to 67%. Asserting the absence of "%" outright would be a false
    // guard — the progress bar's inline width and Tailwind's opacity classes both
    // contain one. The rounded rate is the value that must never appear.
    expect(markup).not.toContain('67%');
  });

  it('suppresses the fraction entirely when nothing has been marked sent', () => {
    // A drafted-but-never-submitted account would otherwise read "0 of 0",
    // which looks like a measured zero rather than an absence of data.
    const noApplications: InsightsSummary = {
      ...summary,
      outcomes: {
        ...summary.outcomes,
        sent: 0,
        viewed: 0,
        interviewing: 0,
        hired: 0,
        declined: 0,
        noResponse: 0,
        replied: 0,
        interviewed: 0,
        replyRate: null,
        sufficientData: false,
        minimumSample: 5,
      },
    };
    const markup = renderToStaticMarkup(<HomeStats summary={noApplications} />);

    expect(markup).not.toContain('0 of 0');
    expect(markup).not.toContain('replied · rate needs 5');
    expect(markup).toContain('no applications marked yet');
  });

  it('renders real goal, populated insights and priorities, without the activity cards', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        data={{ priorities, summary }}
        error={null}
        onNavigate={onNavigate}
        onRetry={onRetry}
        status="success"
      />,
    );

    expect(markup).toContain('Win more clients');
    expect(markup).toContain('Winning Score');
    expect(markup).toContain('data-score-gauge');
    expect(markup).not.toContain('aria-label="Winning Score trend"');
    expect(markup).toContain('data-home-kpi-panel');
    expect(markup.match(/data-home-kpi=/g)).toHaveLength(4);
    expect(markup).toContain('last check 2d ago');
    expect(markup).toContain('data-home-dashboard');
    expect(markup).toContain('min-[1040px]:grid-cols-12');
    expect(markup).toContain('+6 since last');
    expect(markup).toContain('50%');
    expect(markup).toContain('Lead with the client problem you solve.');
    // Proposal activity moved to the Draft tab; recent activity was removed.
    expect(markup).not.toContain('Proposal activity');
    expect(markup).not.toContain('data-proposal-activity');
    expect(markup).not.toContain('Recent activity');
    expect(markup).not.toContain('React SaaS dashboard');
  });
});
