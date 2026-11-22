import { describe, expect, it } from 'vitest';
import { inlineRegisteredProperties } from './shadow-root-css';

describe('inlineRegisteredProperties', () => {
  it('replaces every @property rule with an unregistered default', () => {
    const css = [
      '@layer properties;@layer theme,base,components,utilities;',
      '.border{border-style:var(--tw-border-style);border-width:1px}',
      '@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}',
      '@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}',
      '@property --tw-ring-offset-width{syntax:"<length>";inherits:false;initial-value:0}',
    ].join('');

    const result = inlineRegisteredProperties(css);

    expect(result).not.toContain('@property');
    expect(result).toContain(
      '@layer properties{*,::before,::after,::backdrop{--tw-border-style:solid;--tw-shadow:0 0 #0000;--tw-ring-offset-width:0}}',
    );
    expect(result).toContain(
      '.border{border-style:var(--tw-border-style);border-width:1px}',
    );
  });

  it('defaults a registration without initial-value to initial', () => {
    expect(
      inlineRegisteredProperties(
        '@property --tw-rotate-x{syntax:"*";inherits:false}',
      ),
    ).toContain('{--tw-rotate-x:initial}');
  });

  it('handles unminified rules', () => {
    const result = inlineRegisteredProperties(`
@property --tw-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}
`);

    expect(result).not.toContain('@property');
    expect(result).toContain('{--tw-shadow-alpha:100%}');
  });

  it('puts the defaults ahead of every other layer', () => {
    const result = inlineRegisteredProperties(
      '@layer theme,base,components,utilities;@property --tw-leading{syntax:"*";inherits:false}',
    );

    expect(result.startsWith('@layer properties{')).toBe(true);
  });

  it('leaves CSS without @property untouched', () => {
    const css = '.a{color:red}';
    expect(inlineRegisteredProperties(css)).toBe(css);
  });
});
