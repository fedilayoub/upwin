import { useEffect, useState } from 'react';
import { resolveTheme, type ThemePreference, type ResolvedTheme } from './resolve-theme';
import { themePreferenceItem } from './theme-storage';

/**
 * The theme for surfaces that cannot read it off the document, such as the
 * page launcher — its shadow root sits inside a page we do not own, so it
 * derives the theme itself instead of reading `data-theme` off <html>.
 */
export function useResolvedTheme(): ResolvedTheme {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    void themePreferenceItem
      .getValue()
      .then(setPreference)
      .catch(() => undefined);

    // Storage changes cross contexts, so switching the theme in settings
    // repaints the launcher in every open tab.
    return themePreferenceItem.watch(setPreference);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return resolveTheme(preference, prefersDark);
}
