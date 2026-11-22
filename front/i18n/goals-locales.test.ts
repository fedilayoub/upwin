import { describe, expect, it } from 'vitest';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';

describe('goals locales', () => {
  it('resolves every goals key in both locales', () => {
    expect(leafPaths(fr.goals)).toEqual(leafPaths(en.goals));
    expect(leafValues(en.goals).every(Boolean)).toBe(true);
    expect(leafValues(fr.goals).every(Boolean)).toBe(true);
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
