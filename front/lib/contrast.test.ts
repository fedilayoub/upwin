import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, oklchToSrgb, parseOklch } from './contrast';

interface ContrastTheme {
  name: 'light' | 'dark';
  page: string;
  ink: string;
  focus: string;
  border: string;
  ctaBorder: string;
  ctaStops: readonly (readonly [name: string, value: string])[];
  accentStops: readonly [from: string, to: string];
}

const THEMES: readonly ContrastTheme[] = [
  {
    name: 'light',
    page: 'oklch(0.985 0.01 150)',
    ink: 'oklch(0.985 0.015 150)',
    focus: 'oklch(0.45 0.17 152)',
    border: 'oklch(0.58 0.06 153)',
    ctaBorder: 'oklch(0.58 0.06 153)',
    ctaStops: [
      ['from', 'oklch(0.40 0.115 152)'],
      ['mid', 'oklch(0.44 0.115 151)'],
      ['to', 'oklch(0.47 0.115 150)'],
    ],
    accentStops: ['oklch(0.30 0.12 158)', 'oklch(0.48 0.18 152)'],
  },
  {
    name: 'dark',
    page: 'oklch(0.095 0.028 158)',
    ink: 'oklch(0.985 0.014 148)',
    focus: 'oklch(0.69 0.14 147)',
    border: 'oklch(0.50 0.08 150)',
    ctaBorder: 'oklch(0.50 0.08 150)',
    ctaStops: [
      ['from', 'oklch(0.34 0.10 152)'],
      ['mid', 'oklch(0.37 0.10 151)'],
      ['to', 'oklch(0.40 0.10 150)'],
    ],
    accentStops: ['oklch(0.68 0.14 148)', 'oklch(0.84 0.09 143)'],
  },
];

function rgb(value: string) {
  const { l, c, h } = parseOklch(value);
  return oklchToSrgb(l, c, h);
}

describe.each(THEMES)('$name auth contrast', (theme) => {
  it.each(theme.ctaStops)(
    'keeps the CTA %s stop at 4.5:1 for its label',
    (_stop, value) => {
      expect(contrastRatio(rgb(theme.ink), rgb(value))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('keeps the CTA boundary at 3:1 against the page', () => {
    expect(contrastRatio(rgb(theme.ctaBorder), rgb(theme.page))).toBeGreaterThanOrEqual(3);
  });

  it('keeps the focus ring at 3:1 against the page', () => {
    expect(contrastRatio(rgb(theme.focus), rgb(theme.page))).toBeGreaterThanOrEqual(3);
  });

  it('keeps both heading accent stops at 4.5:1 against the page', () => {
    for (const stop of theme.accentStops) {
      expect(contrastRatio(rgb(stop), rgb(theme.page))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the opaque SSO outline at 3:1 against the page', () => {
    expect(contrastRatio(rgb(theme.border), rgb(theme.page))).toBeGreaterThanOrEqual(3);
  });
});

describe('committed auth color tokens', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const rootBlock = css.match(/:root\s*{([\s\S]*?)\n}/)?.[1] ?? '';
  // `.dark` shares its declaration block with `.landing-dark-panel`, the opt-in class
  // for regions that stay dark in both themes, so the selector is a list.
  const darkBlock = css.match(/^\.dark[^{]*{([\s\S]*?)\n}/m)?.[1] ?? '';

  it.each(THEMES)('matches the tested $name literals in globals.css', (theme) => {
    const block = theme.name === 'light' ? rootBlock : darkBlock;
    const [from, mid, to] = theme.ctaStops.map(([, value]) => value);

    expect(block).toContain(`--auth-cta-from: ${from};`);
    expect(block).toContain(`--auth-cta-mid: ${mid};`);
    expect(block).toContain(`--auth-cta-to: ${to};`);
    expect(block).toContain(`--auth-cta-ink: ${theme.ink};`);
    expect(block).toContain(`--auth-cta-border: ${theme.ctaBorder};`);
    expect(block).toContain(`--auth-page-surface: ${theme.page};`);
    expect(block).toContain(`--auth-focus: ${theme.focus};`);
    expect(block).toContain(`--auth-accent-from: ${theme.accentStops[0]};`);
    expect(block).toContain(`--auth-accent-to: ${theme.accentStops[1]};`);
    expect(block).toContain(`--auth-sso-border: ${theme.border};`);
  });

  it('derives the rendered CTA gradient from the live WebGL palette', () => {
    expect(rootBlock).toContain('--auth-cta-webgl-gradient:');
    expect(rootBlock).toContain('var(--hero-palette-maroon) 80%');
    expect(rootBlock).toContain('var(--hero-palette-core)');
  });
});

describe('footer wordmark color treatment', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const wordmarkBlock = css.match(/\.footer-wordmark-container\s*{([\s\S]*?)\n}/)?.[1] ?? '';

  it('uses a visible gradient derived from the live WebGL palette', () => {
    expect(wordmarkBlock).toContain('var(--hero-palette-maroon) 82%');
    expect(wordmarkBlock).toContain('var(--hero-palette-maroon) 58%');
    expect(wordmarkBlock).toContain('var(--hero-palette-maroon) 38%');
    expect(wordmarkBlock.match(/var\(--hero-palette-core\)/g)).toHaveLength(3);
    expect(wordmarkBlock).not.toContain('var(--hero-palette-amber)');
  });
});

describe('hero fallback color treatment', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const rootBlock = css.match(/:root\s*{([\s\S]*?)\n}/)?.[1] ?? '';
  const heroPoster = rootBlock.match(/--hero-poster:\s*([\s\S]*?);/)?.[1] ?? '';
  const heroLayerGlow = rootBlock.match(/--hero-layer-glow:\s*([\s\S]*?);/)?.[1] ?? '';

  it.each([
    ['poster', heroPoster],
    ['animated fallback glow', heroLayerGlow],
  ])('derives the %s from the live WebGL palette', (_name, gradient) => {
    expect(gradient).toContain('var(--hero-palette-core)');
    expect(gradient).toContain('var(--hero-palette-maroon)');
    expect(gradient).not.toContain('var(--hero-palette-amber)');
    expect(gradient).not.toContain('var(--hero-palette-orange)');
  });
});

describe('oklch parsing', () => {
  it('anchors the conversion against the WCAG black/white ratio', () => {
    expect(contrastRatio(rgb('oklch(0 0 0)'), rgb('oklch(1 0 0)'))).toBeCloseTo(21, 5);
  });

  it('rejects unsupported or malformed color syntax', () => {
    expect(() => parseOklch('rgb(0 0 0)')).toThrow('Invalid oklch color');
    expect(() => parseOklch('oklch(0.5 0.1)')).toThrow('Invalid oklch color');
  });
});
