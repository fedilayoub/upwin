import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

vi.mock('@/features/theme/header-preferences', () => ({
  HeaderPreferences: () => <div aria-label="Appearance and language" />,
}));

describe('AppShell', () => {
  it('uses the same star border treatment as the web app top bar', () => {
    const markup = renderToStaticMarkup(
      <AppShell activeSection="home" onNavigate={vi.fn()}>
        <p>Content</p>
      </AppShell>,
    );

    expect(markup).toContain('data-slot="star-border"');
    expect(markup).toContain('border-dashed');
    expect(markup).toContain('top-3');
    expect(markup).toContain('mx-4');
    expect(markup).toContain('h-12');
    expect(markup).toContain('min-[360px]:px-4');
    expect(markup).toContain('max-w-[100vw]');
    expect(markup).toContain('overflow-x-clip');
    expect(markup).toContain('max-w-[min(1180px,100vw)]');
    expect(markup).toContain('min-[760px]:px-6');
    expect(markup).toContain('data-slot="app-content"');
    expect(markup).toContain('px-3');
    expect(markup.match(/size-4 text-muted/g)).toHaveLength(4);
    expect(markup).toContain('<header class="flex h-full');
  });
});
