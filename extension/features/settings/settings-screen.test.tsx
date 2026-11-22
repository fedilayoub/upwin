import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/features/i18n/i18n-context';
import { fr } from '@/features/i18n/dictionaries/fr';

vi.mock('@/features/connection/connection-context', () => ({
  useConnection: () => ({
    connection: {
      apiUrl: 'http://localhost:3002',
      appUrl: 'http://localhost:3000',
      token: null,
    },
    extensionOrigin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    save: vi.fn(),
    status: 'connected',
  }),
}));

vi.mock('@/features/theme/theme-context', () => ({
  useTheme: () => ({
    preference: 'system',
    setPreference: vi.fn(),
  }),
}));

vi.mock('@/services/extension', () => ({
  extensionService: {
    getRuntimeStatus: vi.fn(),
  },
}));

import { SettingsScreen } from './settings-screen';

describe('SettingsScreen', () => {
  it('uses the available width for a responsive preference grid', () => {
    const markup = renderToStaticMarkup(<SettingsScreen />);

    expect(markup).toContain('Settings');
    expect(markup).toContain('min-[760px]:grid-cols-2');
    expect(markup).toContain('min-[760px]:border-r');
    expect(markup).toContain('id="connection-api-url"');
    expect(markup).toContain('value="http://localhost:3002"');
    expect(markup).not.toContain('Sign out');
    expect(markup).toContain('aria-label="Language"');
    expect(markup).not.toContain('Enable notifications');
    expect(markup).not.toContain('Assistant preferences');
    expect(markup).not.toContain('Proposal tone');
    expect(markup).not.toContain('Platform connected');
    // Diagnostics is collapsed until opened, and hands a check to support by
    // sending it, never by copying.
    expect(markup).toMatch(/<details class="group"><summary[^>]*>.*Diagnostics/);
    expect(markup).not.toMatch(/<details[^>]*\sopen/);
    expect(markup).toContain('Copy report');
    expect(markup).not.toContain('Save to API log');
    expect(markup).not.toContain('Recent errors');
    expect(markup).not.toContain('No errors recorded');
  });

  it('renders settings in French from the shared locale provider', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale="fr">
        <SettingsScreen />
      </I18nProvider>,
    );

    expect(markup).toContain('Paramètres');
    expect(markup).toContain('aria-label="Langue"');
    expect(markup).toContain('Adresse de l');
    expect(markup).not.toContain('Se déconnecter');
    // The option labels live in Radix's SelectContent, which portals only once
    // the select is open, so static markup never carries them. Assert the
    // dictionary supplies them instead.
    expect(fr['settings.french']).toBe('Français');
  });
});
