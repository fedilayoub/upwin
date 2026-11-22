import { storage } from '#imports';
import type { Locale } from './locale';

export const localePreferenceItem = storage.defineItem<Locale | null>(
  'sync:locale-preference',
  { fallback: null },
);
