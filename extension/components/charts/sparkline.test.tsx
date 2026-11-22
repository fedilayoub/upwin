import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Sparkline } from './sparkline';

describe('Sparkline', () => {
  it('renders an empty svg for zero points', () => {
    const markup = renderToStaticMarkup(<Sparkline values={[]} />);

    expect(markup).toContain('<svg');
    expect(markup).not.toContain('<circle');
    expect(markup).not.toContain('<polyline');
  });

  it('renders a dot for one point', () => {
    const markup = renderToStaticMarkup(<Sparkline values={[72]} />);

    expect(markup).toContain('data-sparkline-point="true"');
    expect(markup).not.toContain('<polyline');
  });

  it('renders one polyline for multiple points', () => {
    const markup = renderToStaticMarkup(
      <Sparkline values={[64, 72, 84]} />,
    );

    expect(markup).toContain('data-sparkline-line="true"');
    expect(markup).toContain('points="');
    expect(markup).not.toContain('<circle');
  });
});
