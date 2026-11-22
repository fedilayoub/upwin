import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SCORE_TREND_WEEKS,
  ScoreTrendChart,
  ScoreTrendChartLoading,
} from '@/components/dashboard/score-trend-chart';
import en from '@/i18n/dictionaries/en';
import type { InsightsScoreHistory } from '@/lib/api';

const history: InsightsScoreHistory = {
  points: [
    {
      id: 'one',
      createdAt: '2026-08-01T10:00:00.000Z',
      winningScore: 64,
      completenessScore: 50,
      goalId: 'goal-one',
      objective: 'first-client',
    },
    {
      id: 'two',
      createdAt: '2026-08-20T10:00:00.000Z',
      winningScore: 84,
      completenessScore: 75,
      goalId: 'goal-two',
      objective: 'more-clients',
    },
  ],
  goalSegments: [
    {
      goalId: 'goal-one',
      objective: 'first-client',
      from: '2026-08-01T10:00:00.000Z',
      to: '2026-08-01T10:00:00.000Z',
      count: 1,
    },
    {
      goalId: 'goal-two',
      objective: 'more-clients',
      from: '2026-08-20T10:00:00.000Z',
      to: '2026-08-20T10:00:00.000Z',
      count: 1,
    },
  ],
  sectionDeltas: [],
  comparableAcrossRange: false,
  truncated: false,
};

describe('ScoreTrendChart', () => {
  it('renders the comparability caveat and a goal boundary when weights change', () => {
    const markup = renderToStaticMarkup(
      <ScoreTrendChart
        copy={en.dashboard.scoreTrend}
        goalLabels={en.goals.objectives}
        history={history}
        locale="en"
      />,
    );

    expect(markup).toContain(en.dashboard.scoreTrend.caveat);
    expect(markup).toContain('data-goal-boundary="goal-two"');
  });

  it('omits the caveat when every point uses comparable weights', () => {
    const markup = renderToStaticMarkup(
      <ScoreTrendChart
        copy={en.dashboard.scoreTrend}
        goalLabels={en.goals.objectives}
        history={{
          ...history,
          points: history.points.map((point) => ({
            ...point,
            goalId: 'goal-one',
            objective: 'first-client',
          })),
          goalSegments: [history.goalSegments[0]],
          comparableAcrossRange: true,
        }}
        locale="en"
      />,
    );

    expect(markup).not.toContain(en.dashboard.scoreTrend.caveat);
  });

  it('shows a time axis and limits points to the latest six months', () => {
    const markup = renderToStaticMarkup(
      <ScoreTrendChart
        copy={en.dashboard.scoreTrend}
        goalLabels={en.goals.objectives}
        history={{
          ...history,
          points: [
            {
              ...history.points[0],
              id: 'outside-window',
              createdAt: '2025-12-01T10:00:00.000Z',
            },
            {
              ...history.points[0],
              id: 'inside-window',
              createdAt: '2026-04-01T10:00:00.000Z',
              winningScore: 64.375,
            },
            {
              ...history.points[1],
              id: 'latest-point',
              createdAt: '2026-08-20T10:00:00.000Z',
            },
          ],
        }}
        locale="en"
      />,
    );

    expect(SCORE_TREND_WEEKS).toBe(26);
    expect(markup.match(/data-time-tick=/g)).toHaveLength(4);
    expect(markup).not.toContain('data-score-point="outside-window"');
    expect(markup).toContain('data-score-point="inside-window"');
    expect(markup).toContain('data-score-point="latest-point"');
    expect(markup).toContain('Feb 26');
    expect(markup).toContain('Aug 26');
    expect(markup).toContain('data-score-trend-range="true"');
    expect(markup).toContain('data-chart="chart-');
    expect(markup).toContain('data-exact-winning-score="64.375"');
    expect(markup).toContain('64.375');
    expect(markup).toContain(en.dashboard.scoreTrend.scoreLabel);
  });

  it('marks months without analyses without adding zero-score points', () => {
    const markup = renderToStaticMarkup(
      <ScoreTrendChart
        copy={en.dashboard.scoreTrend}
        goalLabels={en.goals.objectives}
        history={{
          ...history,
          points: [
            {
              ...history.points[0],
              id: 'april-analysis',
              createdAt: '2026-04-01T10:00:00.000Z',
            },
            {
              ...history.points[1],
              id: 'august-analysis',
              createdAt: '2026-08-20T10:00:00.000Z',
            },
          ],
        }}
        locale="en"
      />,
    );

    expect(markup.match(/data-empty-month=/g)).toHaveLength(5);
    expect(markup).toContain('data-empty-month="2026-03"');
    expect(markup).toContain('No analysis in March 2026');
    expect(markup).not.toContain('data-exact-winning-score="0"');
  });

  it('uses the Evil Charts animated area loading state', () => {
    const markup = renderToStaticMarkup(<ScoreTrendChartLoading />);

    expect(markup).toContain('data-score-trend-loading="true"');
    expect(markup).toContain('Loading Winning Score trend');
    expect(markup).toContain('Loading');
  });
});
