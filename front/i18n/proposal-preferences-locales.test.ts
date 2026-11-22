import { describe, expect, it } from 'vitest';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';

describe('proposal preferences locales', () => {
  it('resolves every new key in both locales', () => {
    const englishKeys = leafPaths(en.proposals);
    const frenchKeys = leafPaths(fr.proposals);

    expect(frenchKeys).toEqual(englishKeys);
    expect(leafValues(en.proposals).every(Boolean)).toBe(true);
    expect(leafValues(fr.proposals).every(Boolean)).toBe(true);
    expect(en.navigation.proposalStyle).toBeTruthy();
    expect(fr.navigation.proposalStyle).toBeTruthy();
  });
});

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];

  return Object.entries(value)
    .flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    )
    .sort();
}

function leafValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(leafValues);
}
