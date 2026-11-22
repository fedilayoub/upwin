import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScoreTrendChart, type ScoreTrendPoint } from './score-trend-chart';

const points: ScoreTrendPoint[] = [
  { createdAt: '2026-07-02T08:00:00.000Z', id: 'a', score: 64 },
  { createdAt: '2026-08-11T08:00:00.000Z', id: 'b', score: 72 },
  { createdAt: '2026-09-02T08:00:00.000Z', id: 'c', score: 84 },
];

describe('ScoreTrendChart', () => {
  it('keeps the scores readable without the canvas', () => {
    const markup = renderToStaticMarkup(
      <ScoreTrendChart label="Winning Score history" points={points} />,
    );

    expect(markup).toContain('data-score-trend');
    expect(markup).toContain('aria-label="Winning Score history"');
    expect(markup).toContain('64 → 72 → 84');
  });

  it('renders a single-analysis history without a trend to draw', () => {
    const markup = renderToStaticMarkup(
      <ScoreTrendChart label="Winning Score history" points={[points[0]!]} />,
    );

    expect(markup).toContain('data-score-trend');
    expect(markup).toContain('>64<');
  });

  it('scopes its colour variables to the instance and to this repo’s dark selector', () => {
    const markup = renderToStaticMarkup(
      <ScoreTrendChart label="Winning Score history" points={points} />,
    );

    expect(markup).toContain('--color-winningScore-0: var(--chart-brand-from)');
    expect(markup).toContain('[data-theme="dark"] [data-chart=');
    expect(markup).not.toContain('.dark [data-chart=');
  });
});
