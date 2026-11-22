import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  it('renders the refreshed upwin mark with the web app neutral treatment', () => {
    const markup = renderToStaticMarkup(<BrandMark size="large" />);

    expect(markup).toContain('aria-label="upwin"');
    expect(markup).toContain('bg-foreground');
    expect(markup).toContain('text-background');
    expect(markup).toContain('size-10');
    expect(markup).toContain('>upwin</span>');
  });

  it('matches the compact logo sizing used by the web app header', () => {
    const markup = renderToStaticMarkup(<BrandMark size="small" />);

    expect(markup).toContain('size-6');
    expect(markup).toContain('size-3');
    expect(markup).toContain('text-[0.95rem]');
  });
});
