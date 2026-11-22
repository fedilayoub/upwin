import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScoreGauge } from './score-gauge';

describe('ScoreGauge', () => {
  it('exposes the score as a meter and keeps the value in the markup', () => {
    const markup = renderToStaticMarkup(
      <ScoreGauge label="Winning Score" score={72} />,
    );

    expect(markup).toContain('data-score-gauge');
    expect(markup).toContain('role="meter"');
    expect(markup).toContain('aria-label="Winning Score: 72 out of 100"');
    expect(markup).toContain('aria-valuenow="72"');
    // The canvas is empty until an effect runs, so the number has to be HTML.
    expect(markup).toContain('>72<');
    expect(markup).toContain('out of 100');
  });

  it('clamps the meter value while still showing the raw score', () => {
    const markup = renderToStaticMarkup(
      <ScoreGauge label="Match Score" score={128} />,
    );

    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('aria-label="Match Score: 128 out of 100"');
  });

  it('defaults to the brand ring and honours an explicit tone', () => {
    const brand = renderToStaticMarkup(<ScoreGauge label="Score" score={40} />);
    const weak = renderToStaticMarkup(
      <ScoreGauge label="Score" score={40} tone="weak" />,
    );

    expect(brand).toContain('--color-score-0: var(--chart-brand-from)');
    expect(weak).toContain('--color-score-0: var(--chart-weak-from)');
  });

  it('scopes its colour variables to the instance and to this repo’s dark selector', () => {
    const markup = renderToStaticMarkup(
      <ScoreGauge label="Score" score={40} />,
    );

    expect(markup).toContain('data-chart=');
    expect(markup).toContain('[data-theme="dark"] [data-chart=');
    expect(markup).not.toContain('.dark [data-chart=');
  });
});
