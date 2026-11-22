import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/features/i18n/i18n-context';
import { AppNavigation } from './app-navigation';

describe('AppNavigation', () => {
  it('uses the dock for all five application sections', () => {
    const markup = renderToStaticMarkup(
      <AppNavigation activeSection="proposal" onNavigate={vi.fn()} />,
    );

    expect(markup).toContain('aria-label="Primary navigation"');
    expect(markup).toContain('data-slot="dock"');
    expect(markup.match(/data-slot="dock-item"/g)).toHaveLength(5);
    expect(markup).toContain('aria-label="Home"');
    expect(markup).toContain('aria-label="Match"');
    expect(markup).toContain('aria-label="Draft"');
    expect(markup).toContain('aria-label="Profile"');
    expect(markup).toContain('aria-label="Settings"');
    expect(markup).toContain('aria-current="page" aria-label="Draft"');
    expect(markup).toContain('px-2');
    expect(markup).toContain('--dock-slot-width:34px');
  });

  it('uses translated labels for navigation and accessibility', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale="fr">
        <AppNavigation activeSection="home" onNavigate={vi.fn()} />
      </I18nProvider>,
    );

    expect(markup).toContain('aria-label="Navigation principale"');
    expect(markup).toContain('aria-label="Accueil"');
    expect(markup).toContain('aria-label="Paramètres"');
  });
});
