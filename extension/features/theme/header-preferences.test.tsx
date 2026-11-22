import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/features/i18n/i18n-context';
import { HeaderPreferences } from './header-preferences';

vi.mock('./theme-context', () => ({
  useTheme: () => ({
    preference: 'dark',
    resolvedTheme: 'dark',
    setPreference: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('HeaderPreferences', () => {
  it('matches the compact web header control group', () => {
    const markup = renderToStaticMarkup(
      <HeaderPreferences />,
    );

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Appearance and language"');
    expect(markup).toContain('aria-label="Use light theme"');
    expect(markup).toContain('aria-label="Use dark theme"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-label="Language: English"');
    expect(markup).toContain('role="combobox"');
    expect(markup).not.toContain('>EN<');
    expect(markup).not.toContain('href=');
    expect(markup).toContain('before:inset-[3px]');
    expect(markup.match(/size-7/g)).toHaveLength(3);
  });

  it('localizes its accessible labels', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale="fr">
        <HeaderPreferences />
      </I18nProvider>,
    );

    expect(markup).toContain('aria-label="Apparence et langue"');
    expect(markup).toContain('aria-label="Utiliser le thème clair"');
    expect(markup).toContain('aria-label="Langue: Français"');
  });
});
