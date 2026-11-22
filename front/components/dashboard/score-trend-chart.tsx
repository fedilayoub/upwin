'use client';

import { AlertTriangle } from 'lucide-react';
import {
  EChartsAreaChart,
  type ChartConfig,
} from '@/components/evilcharts/charts/echarts-area-chart';
import type { Dictionary } from '@/i18n/types';
import type { GoalObjective, InsightsScoreHistory } from '@/lib/api';

const TIME_TICK_COUNT = 4;
export const SCORE_TREND_WEEKS = 26;
const SCORE_TREND_WINDOW_MS = SCORE_TREND_WEEKS * 7 * 24 * 60 * 60 * 1000;
const SCORE_TREND_LOADING_POINTS = 18;

type VisiblePoint = InsightsScoreHistory['points'][number] & {
  timestamp: number;
};

type GoalBoundary = {
  goalId: string;
  objective: GoalObjective;
  timestamp: number;
};

type MissingMonth = {
  key: string;
  label: string;
  timestamp: number;
};

export function ScoreTrendChart({
  copy,
  goalLabels,
  history,
  locale,
}: {
  copy: Dictionary['dashboard']['scoreTrend'];
  goalLabels: Record<GoalObjective, string>;
  history: InsightsScoreHistory;
  locale: string;
}) {
  const model = buildChartModel(history, locale);
  const chartConfig = {
    winningScore: {
      colors: {
        dark: ['var(--dashboard-accent)'],
        light: ['var(--dashboard-accent)'],
      },
      label: copy.scoreLabel,
    },
  } satisfies ChartConfig;
  const chartData = model.points.map((point) => ({
    date: formatPointDate(point.timestamp, locale),
    winningScore: point.winningScore,
  }));

  return (
    <div className="space-y-4">
      {model.boundaries.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{copy.caveat}</p>
        </div>
      ) : null}

      {model.points.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <>
          <div
            aria-label={copy.title}
            className="min-w-0"
            data-score-trend-range
            role="group"
          >
            <EChartsAreaChart
              animationType="left-to-right"
              className="h-[342px] w-full"
              config={chartConfig}
              curveType="monotone"
              data={chartData}
              xDataKey="date"
            >
              <EChartsAreaChart.Grid />
              <EChartsAreaChart.XAxis
                dataKey="date"
                hideDots
                tickFormatter={(_value, index) =>
                  formatAxisDate(
                    model.points[index]?.timestamp ?? model.domainEnd,
                    locale,
                  )
                }
              />
              <EChartsAreaChart.YAxis
                hideDots
                interval={25}
                max={100}
                min={0}
              />
              <EChartsAreaChart.Tooltip
                position="fixed"
                roundness="lg"
                variant="frosted-glass"
              />
              <EChartsAreaChart.Area
                dataKey="winningScore"
                strokeVariant="solid"
                strokeWidth={2.5}
                variant="gradient"
              >
                <EChartsAreaChart.Dot variant="colored-border" />
                <EChartsAreaChart.ActiveDot variant="colored-border" />
              </EChartsAreaChart.Area>
              <EChartsAreaChart.Brush
                formatLabel={(_value, index) =>
                  formatAxisDate(
                    model.points[index]?.timestamp ?? model.domainEnd,
                    locale,
                  )
                }
                height={50}
              />
            </EChartsAreaChart>
          </div>

          {model.missingMonths.length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full border border-dashed border-muted-foreground bg-background"
              />
              <span>{copy.noAnalysis}</span>
            </div>
          ) : null}

          <div className="sr-only">
            {model.timeTicks.map((timestamp) => (
              <span data-time-tick key={timestamp}>
                {formatAxisDate(timestamp, locale)}
              </span>
            ))}
            {model.boundaries.map((boundary) => (
              <span data-goal-boundary={boundary.goalId} key={boundary.goalId}>
                {copy.goalChange.replace(
                  '{goal}',
                  goalLabels[boundary.objective],
                )}
              </span>
            ))}
            {model.points.map((point) => (
              <span
                data-exact-winning-score={point.winningScore}
                data-score-point={point.id}
                key={point.id}
              >
                {copy.scoreLabel} {formatExactScore(point.winningScore, locale)}{' '}
                {formatPointDate(point.timestamp, locale)}
              </span>
            ))}
            {model.missingMonths.map((month) => (
              <span data-empty-month={month.key} key={month.key}>
                {copy.noAnalysisMonth.replace('{month}', month.label)}
              </span>
            ))}
          </div>
        </>
      )}

      {history.truncated ? (
        <p className="text-xs text-muted-foreground">{copy.truncated}</p>
      ) : null}
    </div>
  );
}

function buildChartModel(history: InsightsScoreHistory, locale: string): {
  boundaries: GoalBoundary[];
  domainEnd: number;
  domainStart: number;
  missingMonths: MissingMonth[];
  points: VisiblePoint[];
  timeTicks: number[];
} {
  const newestPoint = history.points.at(-1);
  const domainEnd = newestPoint ? Date.parse(newestPoint.createdAt) : 0;
  const domainStart = domainEnd - SCORE_TREND_WINDOW_MS;
  const points = history.points.flatMap((point) => {
    const timestamp = Date.parse(point.createdAt);
    return timestamp >= domainStart ? [{ ...point, timestamp }] : [];
  });
  const boundaries = points.flatMap((point, index) => {
    const previous = points[index - 1];
    if (!previous || previous.goalId === point.goalId) return [];

    return [
      {
        goalId: point.goalId,
        objective: point.objective,
        timestamp: (previous.timestamp + point.timestamp) / 2,
      },
    ];
  });
  const timeTicks = Array.from({ length: TIME_TICK_COUNT }, (_, index) => {
    const progress = index / (TIME_TICK_COUNT - 1);
    return domainStart + (domainEnd - domainStart) * progress;
  });

  return {
    boundaries,
    domainEnd,
    domainStart,
    missingMonths: buildMissingMonths(
      points,
      domainStart,
      domainEnd,
      locale,
    ),
    points,
    timeTicks,
  };
}

function buildMissingMonths(
  points: VisiblePoint[],
  domainStart: number,
  domainEnd: number,
  locale: string,
): MissingMonth[] {
  if (points.length === 0) return [];

  const firstMonth = new Date(domainStart);
  let monthStart = Date.UTC(
    firstMonth.getUTCFullYear(),
    firstMonth.getUTCMonth(),
    1,
  );
  const missingMonths: MissingMonth[] = [];

  while (monthStart <= domainEnd) {
    const monthDate = new Date(monthStart);
    const nextMonth = Date.UTC(
      monthDate.getUTCFullYear(),
      monthDate.getUTCMonth() + 1,
      1,
    );
    const visibleStart = Math.max(monthStart, domainStart);
    const visibleEnd = Math.min(nextMonth - 1, domainEnd);
    const hasAnalysis = points.some(
      (point) =>
        point.timestamp >= visibleStart && point.timestamp <= visibleEnd,
    );

    if (!hasAnalysis) {
      missingMonths.push({
        key: `${monthDate.getUTCFullYear()}-${String(
          monthDate.getUTCMonth() + 1,
        ).padStart(2, '0')}`,
        label: formatMonthDate(monthStart, locale),
        timestamp: visibleStart + (visibleEnd - visibleStart) / 2,
      });
    }

    monthStart = nextMonth;
  }

  return missingMonths;
}

export function ScoreTrendChartLoading() {
  const config = {
    winningScore: {
      colors: {
        dark: ['var(--dashboard-accent)'],
        light: ['var(--dashboard-accent)'],
      },
      label: 'Winning Score',
    },
  } satisfies ChartConfig;

  return (
    <div
      aria-label="Loading Winning Score trend"
      className="min-w-0"
      data-score-trend-loading
      role="status"
    >
      <EChartsAreaChart
        className="h-[342px] w-full"
        config={config}
        curveType="monotone"
        data={[]}
        isLoading
        loadingPoints={SCORE_TREND_LOADING_POINTS}
        xDataKey="date"
      >
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.XAxis dataKey="date" hideDots />
        <EChartsAreaChart.YAxis hideDots interval={25} max={100} min={0} />
        <EChartsAreaChart.Area
          dataKey="winningScore"
          strokeVariant="solid"
          variant="gradient"
        />
        <EChartsAreaChart.Brush height={50} />
      </EChartsAreaChart>
    </div>
  );
}

function formatAxisDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
    year: '2-digit',
  }).format(new Date(timestamp));
}

function formatMonthDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function formatPointDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(timestamp));
}

function formatExactScore(value: unknown, locale: string): string {
  return typeof value === 'number'
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value)
    : String(value);
}
