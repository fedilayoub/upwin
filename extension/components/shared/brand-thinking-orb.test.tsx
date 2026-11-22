import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandThinkingOrb } from './brand-thinking-orb';

describe('BrandThinkingOrb', () => {
  it('uses the upwin WebGL green token as its custom theme by default', () => {
    const markup = renderToStaticMarkup(
      <BrandThinkingOrb aria-label="Analyzing profile…" state="solving" />,
    );

    expect(markup).toContain('data-orb-state="solving"');
    expect(markup).toContain('color:var(--thinking-orb-ink)');
    expect(markup).toContain('aria-label="Analyzing profile…"');
  });

  it('accepts a caller-controlled CSS color and tuned inline size', () => {
    const markup = renderToStaticMarkup(
      <BrandThinkingOrb color="#123456" size={20} state="composing" />,
    );

    expect(markup).toContain('data-orb-state="composing"');
    expect(markup).toContain('color:#123456');
    expect(markup).toContain('height:20px');
    expect(markup).toContain('width:20px');
  });
});
