import { storage } from '#imports';
import { THEME_STORAGE_KEY, type ThemePreference } from './resolve-theme';

/**
 * Shared by the side panel and the page launcher, so changing the theme in
 * settings repaints both without either knowing about the other.
 */
export const themePreferenceItem = storage.defineItem<ThemePreference>(
  `sync:${THEME_STORAGE_KEY}`,
  { fallback: 'system' },
);
