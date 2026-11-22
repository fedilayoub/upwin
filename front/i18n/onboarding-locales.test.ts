import { describe, expect, it } from 'vitest';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';

describe('onboarding and prompt console locales', () => {
  it('resolves every onboarding key in both locales', () => {
    expect(leafPaths(fr.onboarding)).toEqual(leafPaths(en.onboarding));
    expect(leafValues(en.onboarding).every(Boolean)).toBe(true);
    expect(leafValues(fr.onboarding).every(Boolean)).toBe(true);
  });

  it('resolves every prompt console key in both locales', () => {
    expect(leafPaths(fr.promptConsole)).toEqual(leafPaths(en.promptConsole));
    expect(leafValues(en.promptConsole).every(Boolean)).toBe(true);
    expect(leafValues(fr.promptConsole).every(Boolean)).toBe(true);
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
