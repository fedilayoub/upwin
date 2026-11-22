import { describe, expect, it } from 'vitest';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';

function leaves(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    expect(value.trim()).not.toBe('');
    return [path];
  }
  if (!value || typeof value !== 'object')
    throw new Error(`Missing copy at ${path}`);
  return Object.entries(value)
    .flatMap(([key, child]) => leaves(child, `${path}.${key}`))
    .sort();
}
describe('video locales', () => {
  it.each(['video', 'videos', 'share'] as const)(
    'has matching non-empty %s keys',
    (key) => {
      expect(leaves(en[key])).toEqual(leaves(fr[key]));
    },
  );
});
