import { describe, expect, it } from 'vitest';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';

describe('dashboard locales', () => {
  it('resolves every dashboard key in both locales', () => {
    expect(leafPaths(fr.dashboard)).toEqual(leafPaths(en.dashboard));
    expect(leafValues(en.dashboard).every(Boolean)).toBe(true);
    expect(leafValues(fr.dashboard).every(Boolean)).toBe(true);
    expect(en.navigation.overview).toBeTruthy();
    expect(fr.navigation.overview).toBeTruthy();
  });
});

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function leafValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(leafValues);
}
