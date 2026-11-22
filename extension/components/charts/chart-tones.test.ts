import { describe, expect, it } from 'vitest';
import { ringPercent, toneChartConfig } from './chart-tones';

describe('ringPercent', () => {
  it('clamps outside the 0-100 domain', () => {
    expect(ringPercent(-12)).toBe(0);
    expect(ringPercent(140)).toBe(100);
  });

  it('rounds to whole percents so aria-valuenow stays readable', () => {
    expect(ringPercent((8 / 21) * 100)).toBe(38);
  });

  it('treats any non-finite value as empty rather than propagating NaN', () => {
    expect(ringPercent(Number.NaN)).toBe(0);
    expect(ringPercent(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('toneChartConfig', () => {
  it('points both themes at the same tone tokens', () => {
    const config = toneChartConfig('score', 'brand', 'Winning Score');

    expect(config.score?.label).toBe('Winning Score');
    expect(config.score?.colors).toEqual({
      dark: ['var(--chart-brand-from)', 'var(--chart-brand-to)'],
      light: ['var(--chart-brand-from)', 'var(--chart-brand-to)'],
    });
  });

  it('gives each tone its own gradient', () => {
    expect(toneChartConfig('s', 'weak', 'Weak').s?.colors).toEqual({
      dark: ['var(--chart-weak-from)', 'var(--chart-weak-to)'],
      light: ['var(--chart-weak-from)', 'var(--chart-weak-to)'],
    });
  });
});
