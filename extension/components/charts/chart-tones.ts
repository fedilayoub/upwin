import type { ChartConfig } from '@/components/charts/echarts/echarts-radial-chart';
import type { ScoreTone } from '@/features/profile/score-tone';

/** `brand` is the neutral gauge fill, which is what the Winning Score uses. */
export type ChartTone = 'brand' | ScoreTone;

/**
 * Ring gradients as CSS custom properties rather than literal colours.
 *
 * The radial chart resolves `--color-{key}-{n}` off the live DOM, so pointing
 * each slot at a theme token keeps one source of truth in `tokens.css` and lets
 * a light/dark flip retint the chart without a second palette living here. Both
 * theme arrays name the same tokens on purpose: the token values are what
 * differ per theme.
 */
const TONE_STOPS: Record<ChartTone, readonly [string, string]> = {
  brand: ['var(--chart-brand-from)', 'var(--chart-brand-to)'],
  strong: ['var(--chart-strong-from)', 'var(--chart-strong-to)'],
  moderate: ['var(--chart-moderate-from)', 'var(--chart-moderate-to)'],
  weak: ['var(--chart-weak-from)', 'var(--chart-weak-to)'],
};

/**
 * A one-series `ChartConfig` for a radial chart. Memoize at the call site: the
 * chart re-reads its colours whenever this object's identity changes.
 */
export function toneChartConfig(
  key: string,
  tone: ChartTone,
  label: string,
): ChartConfig {
  const stops = [...TONE_STOPS[tone]];
  return { [key]: { colors: { dark: stops, light: stops }, label } };
}

/**
 * Puts a score or percentage on the whole-percent 0-100 domain the gauge is
 * drawn on. Rounded because the number is also the meter's `aria-valuenow`,
 * where `38.095238095238095` is noise a screen reader would read out in full,
 * and a ring cannot show that precision anyway.
 */
export function ringPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}
