const PROPERTY_RULE = /@property\s+(--[\w-]+)\s*\{([^}]*)\}/g;
const INITIAL_VALUE = /(?:^|;)\s*initial-value\s*:\s*([^;]+?)\s*(?:;|$)/;

/**
 * Rewrites Tailwind's `@property` registrations as plain defaults scoped to
 * the stylesheet's own elements.
 *
 * A shadow root ignores `@property`, so WXT's `createShadowRootUi` hoists those
 * rules into the host page's <head>. A registration is global: on Upwork it
 * re-types every `--tw-*` variable the page's own CSS uses (`inherits: false`,
 * typed syntaxes), which visibly breaks Upwork's layout. With no `@property`
 * left, WXT hoists nothing.
 *
 * The replacement is the same fallback Tailwind ships for browsers without
 * `@property`, minus its `@supports` gate: every element gets each variable's
 * initial value, so nothing inherits — the behaviour `inherits: false` gave.
 * It goes first so `properties` stays the lowest cascade layer.
 */
export function inlineRegisteredProperties(css: string): string {
  const declarations: string[] = [];
  const stripped = css.replace(
    PROPERTY_RULE,
    (_rule, name: string, body: string) => {
      declarations.push(`${name}:${INITIAL_VALUE.exec(body)?.[1] ?? 'initial'}`);
      return '';
    },
  );

  if (declarations.length === 0) return css;
  return `@layer properties{*,::before,::after,::backdrop{${declarations.join(';')}}}\n${stripped}`;
}
