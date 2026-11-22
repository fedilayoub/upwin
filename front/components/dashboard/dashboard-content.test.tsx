import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import en from '@/i18n/dictionaries/en';
import type {
  InsightsActivity,
  InsightsFunnel,
  InsightsScoreHistory,
  InsightsSummary,
  ProposalOutcomesPage,
} from '@/lib/api';
const CONNECTION_HREF = 'href="/en/settings/connection"';
import type { SetupContextState } from '@/lib/setup-checklist';

describe('DashboardContent', () => {
  it('shows a new user the setup checklist instead of the analytics grid', () => {
    const markup = renderSetup({ contextState: 'missing', summary: emptySummary });

    expect(markup).toContain('data-setup-checklist');
    expect(markup).toContain('data-tour="analysis"');
    expect(markup).toContain(en.dashboard.setup.title);
    expect(markup).toContain('href="/en/context"');
    expect(markup).toContain('href="/en/goals"');
    expect(markup).not.toContain('data-dashboard-grid');
  });

  it('holds the extension install back until details and goal are in', () => {
    const markup = renderSetup({ contextState: 'missing', summary: emptySummary });

    expect(markup).toContain('data-setup-step-state="locked"');
    expect(markup).toContain(en.dashboard.setup.locked);
    expect(markup).not.toContain(CONNECTION_HREF);
  });

  it('sends saved but unconfirmed details to the review page', () => {
    const markup = renderSetup({ contextState: 'unconfirmed', summary: emptySummary });

    expect(markup).toContain('href="/en/context/review"');
    expect(markup).toContain(en.dashboard.setup.steps.skills.confirmAction);
  });

  it('offers the extension once details are confirmed and a goal is active', () => {
    const markup = renderSetup({ contextState: 'confirmed', summary: withGoal(emptySummary) });

    expect(markup).toContain(CONNECTION_HREF);
    expect(markup).toContain(en.dashboard.setup.steps.extension.action);
    expect(markup).not.toContain(en.dashboard.setup.locked);
  });

  it('keeps asking for a missing goal above the analytics', () => {
    const markup = renderSetup({ contextState: 'confirmed', summary: summaryWith({}) });

    expect(markup).toContain('data-setup-checklist');
    expect(markup).toContain('data-dashboard-grid');
    // The tour's analysis step must have exactly one target: the score tiles.
    expect(markup.split('data-tour="analysis"')).toHaveLength(2);
  });

  it('drops the checklist once setup is complete', () => {
    const markup = renderSetup({
      contextState: 'confirmed',
      summary: withGoal(summaryWith({})),
    });

    expect(markup).not.toContain('data-setup-checklist');
    expect(markup).toContain('data-dashboard-grid');
  });
});

function withGoal(summary: InsightsSummary): InsightsSummary {
  return {
    ...summary,
    profile: {
      ...summary.profile,
      activeGoal: { id: 'goal-1', objective: 'more-clients', targetRole: 'Shopify developer' },
    },
  };
}

function renderSetup({
  contextState,
  summary,
}: {
  contextState: SetupContextState;
  summary: InsightsSummary;
}): string {
  return renderToStaticMarkup(
    <DashboardContent
      activity={emptyActivity}
      contextState={contextState}
      copy={en.dashboard}
      funnel={emptyFunnel}
      goalLabels={en.goals.objectives}
      history={emptyHistory}
      locale="en"
      outcomes={emptyOutcomes}
      saveOutcomeAction={async () => ({ status: 'idle' })}
      summary={summary}
    />,
  );
}

const emptySummary: InsightsSummary = {
  generatedAt: '2026-08-25T12:00:00.000Z',
  profile: {
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
    goalChangedSinceFirstAnalysis: false,
    activeGoal: null,
  },
  suggestions: { copied: 0, dismissed: 0, pending: 0, adoptionRate: null },
  jobs: {
    analysesCount: 0,
    analysesLast30Days: 0,
    averageMatchScore: null,
    averageMatchScoreLast30Days: null,
    highFitCount: 0,
    highFitShare: 0,
    highFitThreshold: 70,
    averageMatchScoreApplied: null,
  },
  proposals: {
    draftedCount: 0,
    draftedLast30Days: 0,
    copiedBlocks: 0,
    averageProposalWords: null,
  },
  outcomes: {
    sent: 0,
    viewed: 0,
    interviewing: 0,
    hired: 0,
    declined: 0,
    noResponse: 0,
    replied: 0,
    interviewed: 0,
    replyRate: null,
    interviewRate: null,
    winRate: null,
    connectsSpent: null,
    connectsPerInterview: null,
    sufficientData: false,
    minimumSample: 5,
  },
  recentActivity: [],
};

const emptyActivity: InsightsActivity = {
  timeZone: 'UTC',
  from: '2025-08-26',
  to: '2026-08-25',
  days: [],
  totals: { drafted: 0, sent: 0, activeDays: 0 },
  currentStreakWeeks: 0,
  longestStreakWeeks: 0,
  maxPerDay: 0,
};

const emptyHistory: InsightsScoreHistory = {
  points: [],
  goalSegments: [],
  sectionDeltas: [],
  comparableAcrossRange: true,
  truncated: false,
};

const emptyFunnel: InsightsFunnel = {
  window: 'all',
  steps: [
    { id: 'jobsAnalyzed', count: 0, share: null },
    { id: 'proposalsDrafted', count: 0, share: null },
    { id: 'sent', count: 0, share: null },
    { id: 'replied', count: 0, share: null },
    { id: 'interviewing', count: 0, share: null },
    { id: 'hired', count: 0, share: null },
  ],
};

const emptyOutcomes: ProposalOutcomesPage = {
  items: [],
  pageSize: 20,
  hasMore: false,
  nextCursor: null,
};

function summaryWith(
  outcomes: Partial<InsightsSummary['outcomes']>,
): InsightsSummary {
  return {
    ...emptySummary,
    profile: {
      ...emptySummary.profile,
      latestWinningScore: 72,
      analysesCount: 3,
    },
    outcomes: { ...emptySummary.outcomes, ...outcomes },
  };
}

function renderWith(outcomes: Partial<InsightsSummary['outcomes']>): string {
  return renderToStaticMarkup(
    <DashboardContent
      activity={emptyActivity}
      contextState="confirmed"
      copy={en.dashboard}
      funnel={emptyFunnel}
      goalLabels={en.goals.objectives}
      history={emptyHistory}
      locale="en"
      outcomes={emptyOutcomes}
      saveOutcomeAction={async () => ({ status: 'idle' })}
      summary={summaryWith(outcomes)}
    />,
  );
}

describe('reply rate at zero sample', () => {
  it('suppresses the rate instead of rendering "0 of 0 replied"', () => {
    // An account that has drafted but never marked anything sent has nothing to
    // report. A fraction of nothing reads as a measured zero.
    const markup = renderWith({ sent: 0, replied: 0 });

    expect(markup).not.toContain('0 of 0 replied');
    expect(markup).toContain(en.dashboard.kpis.replyEmpty);
  });

  it('still shows the counted fraction once applications exist', () => {
    const markup = renderWith({ sent: 3, replied: 2 });

    expect(markup).toContain('2 of 3 replied');
    expect(markup).not.toContain(en.dashboard.kpis.replyEmpty);
  });

  it('shows the percentage once the sample is large enough', () => {
    const markup = renderWith({
      sent: 10,
      replied: 5,
      replyRate: 0.5,
      sufficientData: true,
    });

    expect(markup).toContain('50%');
    expect(markup).not.toContain(en.dashboard.kpis.replyEmpty);
  });
});
