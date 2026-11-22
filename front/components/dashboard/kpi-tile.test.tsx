import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KpiTile } from '@/components/dashboard/kpi-tile';

describe('KpiTile', () => {
  it('adds the diagonal background pattern to featured tiles only', () => {
    const featuredMarkup = renderToStaticMarkup(
      <KpiTile featured label="Winning Score" value={82} />,
    );
    const standardMarkup = renderToStaticMarkup(
      <KpiTile label="Profile analyses" value={12} />,
    );

    expect(featuredMarkup).toContain('repeating-linear-gradient');
    expect(featuredMarkup).toContain('aria-hidden="true"');
    expect(standardMarkup).not.toContain('repeating-linear-gradient');
  });

  it('renders the raw reply fraction and sample hint instead of a percentage', () => {
    const markup = renderToStaticMarkup(
      <KpiTile
        hint="Needs 5 marked applications"
        label="Reply rate"
        value="2 of 3 replied"
      />,
    );

    expect(markup).toContain('2 of 3 replied');
    expect(markup).toContain('Needs 5 marked applications');
    expect(markup).not.toContain('67%');
  });
});
