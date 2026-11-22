import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { resolveTheme } from './resolve-theme';
import { themePreferenceItem } from './theme-storage';

export type { ResolvedTheme, ThemePreference } from './resolve-theme';
import type { ResolvedTheme, ThemePreference } from './resolve-theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolvedTheme = resolveTheme(
    preference,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

export async function initializeTheme(): Promise<ThemePreference> {
  try {
    const preference = await themePreferenceItem.getValue();
    applyTheme(preference);
    return preference;
  } catch {
    applyTheme('system');
    return 'system';
  }
}

export function ThemeProvider({
  children,
  initialPreference,
}: {
  children: ReactNode;
  initialPreference: ThemePreference;
}) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(initialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    applyTheme(initialPreference),
  );

  const updateResolvedTheme = useCallback((nextPreference: ThemePreference) => {
    setResolvedTheme(applyTheme(nextPreference));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (preference === 'system') updateResolvedTheme('system');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [preference, updateResolvedTheme]);

  useEffect(
    () =>
      themePreferenceItem.watch((nextPreference) => {
        setPreferenceState(nextPreference);
        updateResolvedTheme(nextPreference);
      }),
    [updateResolvedTheme],
  );

  const setPreference = useCallback(
    async (nextPreference: ThemePreference) => {
      setPreferenceState(nextPreference);
      updateResolvedTheme(nextPreference);
      await themePreferenceItem.setValue(nextPreference);
    },
    [updateResolvedTheme],
  );

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context;
}
