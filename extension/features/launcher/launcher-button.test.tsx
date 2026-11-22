import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LauncherButton } from './launcher-button';
import type { LauncherShortcut } from './shortcuts';

describe('LauncherButton', () => {
  it('renders the composing orb for the side-panel toggle', () => {
    const shortcut: LauncherShortcut = {
      id: 'toggle-side-panel',
      label: 'upwin',
      run: vi.fn().mockResolvedValue(undefined),
      visual: { kind: 'orb', state: 'composing' },
    };

    const markup = renderToStaticMarkup(
      <LauncherButton shortcut={shortcut} />,
    );

    expect(markup).toContain('aria-label="upwin"');
    expect(markup).toMatch(/<button class="[^"]*\bsize-8\b/);
    expect(markup).toMatch(/<button class="[^"]*\bcursor-pointer\b/);
    expect(markup).toContain('data-orb-state="composing"');
    expect(markup).toContain('height:24px');
    expect(markup).toContain('width:24px');
    expect(markup).toContain('aria-hidden="true"');
  });
});
