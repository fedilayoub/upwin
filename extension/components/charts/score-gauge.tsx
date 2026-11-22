import { useMemo } from 'react';
import { EChartsRadialChart } from '@/components/charts/echarts/echarts-radial-chart';
import { cn } from '@/lib/utils';
import { ringPercent, toneChartConfig, type ChartTone } from './chart-tones';

/**
 * Scoped to this chart instance by the radial chart's own `[data-chart={id}]`
 * wrapper, so a fixed key never collides with another gauge on the page.
 */
const GAUGE_KEY = 'score';

/**
 * The 0-100 score dial: an ECharts semi-radial bar that sweeps in on mount.
 *
 * Geometry note — the `semi` variant puts the polar centre at 70% of the
 * container height, so the arc's outer edge has to stay inside that 70%. The
 * 160/110 box with a 100%-132% radius band lands the ring's outer cap ~7px
 * below the top edge at the panel's widest, which is why those numbers are not
 * round ones. The value is HTML on top of the canvas rather than an ECharts
 * label: it stays selectable, scales with the user's font size, and — because
 * the canvas is empty until an effect runs — keeps the score in the markup the
 * `node`-environment tests render.
 */
export function ScoreGauge({
  className,
  label,
  score,
  tone = 'brand',
}: {
  className?: string;
  label: string;
  score: number;
  tone?: ChartTone;
}) {
  const normalizedScore = ringPercent(score);
  const config = useMemo(
    () => toneChartConfig(GAUGE_KEY, tone, label),
    [label, tone],
  );
  const data = useMemo(
    () => [{ name: GAUGE_KEY, value: normalizedScore }],
    [normalizedScore],
  );

  return (
    <div
      aria-label={`${label}: ${score} out of 100`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={normalizedScore}
      className={cn('relative mx-auto w-full max-w-40', className)}
      data-score-gauge
      role="meter"
    >
      <EChartsRadialChart
        className="aspect-[160/110] w-full"
        config={config}
        data={data}
        innerRadius="100%"
        max={100}
        nameKey="name"
        outerRadius="132%"
        variant="semi"
      >
        <EChartsRadialChart.RadialBar
          barSize={12}
          cornerRadius={8}
          dataKey="value"
          showBackground
        />
      </EChartsRadialChart>
      {/* Each line is anchored to the polar centre (70% of the height) rather
          than stacked: the dome's opening narrows fast towards the top, so a
          two-line block sitting entirely above the centre pushes the score up
          into the arc at small widths. The score's baseline rests on the centre
          line and the caption drops into the empty space under the arc. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute inset-x-0 top-[70%] -translate-y-full text-center text-[30px] font-semibold leading-none tracking-[-0.06em] tabular-nums">
          {score}
        </span>
        <span className="absolute inset-x-0 top-[70%] mt-1 text-center text-[10px] font-medium text-muted-foreground">
          out of 100
        </span>
      </div>
    </div>
  );
}
