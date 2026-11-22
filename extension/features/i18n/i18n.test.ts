import { describe, expect, it } from 'vitest';
import { en } from './dictionaries/en';
import { fr } from './dictionaries/fr';
import { translate } from './i18n-context';
import { normalizeLocale } from './locale';

describe('extension i18n', () => {
  it('keeps English and French dictionaries in parity', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('normalizes supported browser language tags', () => {
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('en_GB')).toBe('en');
    expect(normalizeLocale('de-DE')).toBe('en');
  });

  it('interpolates translated values', () => {
    expect(translate('fr', 'settings.connected', { version: '1.2.3' })).toBe(
      'Connectée · v1.2.3',
    );
  });
});
