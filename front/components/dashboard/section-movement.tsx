'use client';

import {
  EChartsRadarChart,
  type ChartConfig,
} from '@/components/evilcharts/charts/echarts-radar-chart';
import type { Dictionary } from '@/i18n/types';
import { PROFILE_SECTION_IDS, type InsightsScoreHistory } from '@/lib/api';

const SECTION_SCORE_MAX = 100;

export function SectionMovement({
  copy,
  sectionDeltas,
}: {
  copy: Dictionary['dashboard']['sections'];
  sectionDeltas: InsightsScoreHistory['sectionDeltas'];
}) {
  const data = PROFILE_SECTION_IDS.map((sectionId) => {
    const movement = sectionDeltas.find(({ id }) => id === sectionId);

    return {
      section: copy.labels[sectionId],
      first: movement?.firstScore ?? 0,
      latest: movement?.latestScore ?? 0,
    };
  });
  const config = createChartConfig(copy.first, copy.latest);
  const needsMoreData =
    sectionDeltas.length < PROFILE_SECTION_IDS.length ||
    sectionDeltas.some(({ delta }) => delta === null);

  return (
    <div className="space-y-2">
      <div
        aria-label={copy.title}
        data-section-movement-radar
        role="group"
      >
        <EChartsRadarChart
          className="h-[360px] w-full px-2 pb-2"
          config={config}
          data={data}
          maxValue={SECTION_SCORE_MAX}
        >
          <EChartsRadarChart.PolarGrid />
          <EChartsRadarChart.PolarAngleAxis dataKey="section" />
          <EChartsRadarChart.Tooltip
            roundness="lg"
            variant="frosted-glass"
          />
          <EChartsRadarChart.Legend
            align="center"
            isClickable
            variant="horizontal-bar"
            verticalAlign="bottom"
          />
          <EChartsRadarChart.Radar
            dataKey="first"
            isClickable
            variant="lines"
          >
            <EChartsRadarChart.Dot variant="colored-border" />
            <EChartsRadarChart.ActiveDot variant="default" />
          </EChartsRadarChart.Radar>
          <EChartsRadarChart.Radar
            dataKey="latest"
            fillOpacity={0.22}
            isClickable
            variant="filled"
          >
            <EChartsRadarChart.Dot variant="colored-border" />
            <EChartsRadarChart.ActiveDot variant="default" />
          </EChartsRadarChart.Radar>
        </EChartsRadarChart>
      </div>

      {needsMoreData ? (
        <p className="text-center text-xs text-muted-foreground">
          {copy.noDelta}
        </p>
      ) : null}

      <div className="sr-only">
        {PROFILE_SECTION_IDS.map((sectionId) => {
          const movement = sectionDeltas.find(({ id }) => id === sectionId);

          return (
            <span data-section-movement={sectionId} key={sectionId}>
              {copy.labels[sectionId]}: {copy.first}{' '}
              {movement?.firstScore ?? 0}, {copy.latest}{' '}
              {movement?.latestScore ?? 0},{' '}
              {movement?.delta === null || movement === undefined
                ? copy.noDelta
                : `${movement.delta > 0 ? '+' : ''}${movement.delta}`}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function SectionMovementLoading() {
  const config = createChartConfig('First', 'Latest');

  return (
    <div
      aria-label="Loading section movement"
      data-section-movement-loading
      role="status"
    >
      <EChartsRadarChart
        className="h-[360px] w-full px-2 pb-2"
        config={config}
        data={[]}
        isLoading
        loadingPoints={PROFILE_SECTION_IDS.length}
        maxValue={SECTION_SCORE_MAX}
      >
        <EChartsRadarChart.PolarGrid />
        <EChartsRadarChart.PolarAngleAxis dataKey="section" />
        <EChartsRadarChart.Legend />
        <EChartsRadarChart.Tooltip />
        <EChartsRadarChart.Radar dataKey="first" variant="lines" />
        <EChartsRadarChart.Radar dataKey="latest" variant="filled" />
      </EChartsRadarChart>
    </div>
  );
}

function createChartConfig(firstLabel: string, latestLabel: string) {
  return {
    first: {
      colors: {
        dark: ['oklch(0.72 0.02 155)'],
        light: ['oklch(0.55 0.02 155)'],
      },
      label: firstLabel,
    },
    latest: {
      colors: {
        dark: ['var(--dashboard-accent)'],
        light: ['var(--dashboard-accent)'],
      },
      label: latestLabel,
    },
  } satisfies ChartConfig;
}
