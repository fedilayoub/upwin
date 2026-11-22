import { useMemo } from 'react';
import { EChartsAreaChart } from '@/components/charts/echarts/echarts-area-chart';
import { cn } from '@/lib/utils';
import { toneChartConfig, type ChartTone } from './chart-tones';

/** Scoped per chart instance by the chart's own `[data-chart={id}]` wrapper. */
const TREND_KEY = 'winningScore';

export interface ScoreTrendPoint {
  id: string;
  createdAt: string;
  score: number;
}

/**
 * A score history as an animated gradient area chart.
 *
 * The value axis is pinned to 0-100 rather than derived from the data. A derived
 * axis would stretch a 71-to-78 history across the full plot and read as a
 * dramatic climb; the score is scored against a fixed 100, so the chart is too.
 *
 * The scores are also emitted as screen-reader text, in order: the chart itself
 * paints to a canvas, which has no readable DOM of its own.
 */
export function ScoreTrendChart({
  className,
  label,
  points,
  tone = 'brand',
}: {
  className?: string;
  label: string;
  points: ScoreTrendPoint[];
  tone?: ChartTone;
}) {
  const config = useMemo(
    () => toneChartConfig(TREND_KEY, tone, label),
    [label, tone],
  );
  const rows = useMemo(
    () =>
      points.map((point) => ({
        [TREND_KEY]: point.score,
        when: formatPointDate(point.createdAt),
      })),
    [points],
  );

  return (
    <div className={cn('mt-3', className)} data-score-trend>
      <EChartsAreaChart
        className="h-32 w-full"
        config={config}
        curveType="monotone"
        data={rows}
        xDataKey="when"
        yDomain={[0, 100]}
      >
        {/* `strokeVariant` defaults to dashed upstream; a score history is a
            continuous measurement, so the line is solid. */}
        <EChartsAreaChart.Area
          dataKey={TREND_KEY}
          strokeVariant="solid"
          strokeWidth={2}
          variant="gradient"
        >
          <EChartsAreaChart.Dot variant="border" />
          <EChartsAreaChart.ActiveDot variant="colored-border" />
        </EChartsAreaChart.Area>
        <EChartsAreaChart.XAxis hideDots />
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.Tooltip position="fixed" roundness="lg" />
      </EChartsAreaChart>
      <p aria-label={label} className="sr-only">
        {points.map(({ score }) => score).join(' → ')}
      </p>
    </div>
  );
}

/**
 * Axis labels are day-and-month only: the panel is ~340px wide, so a year would
 * force ECharts to drop every other tick.
 */
function formatPointDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}
