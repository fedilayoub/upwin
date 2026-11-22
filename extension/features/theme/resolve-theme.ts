/**
 * The key the theme setting is stored under in `storage.sync`. The in-page recorder host reads
 * it directly, without WXT's storage wrapper, to stay small.
 */
export const THEME_STORAGE_KEY = "theme-preference";

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

/**
 * Turns a stored preference into the theme actually painted.
 *
 * Kept free of browser globals so both the side panel and the content script
 * decide the same way from whichever signal each of them can read.
 */
export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference !== 'system') return preference;
  return prefersDark ? 'dark' : 'light';
}
