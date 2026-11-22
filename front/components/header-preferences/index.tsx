'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { cn } from '@/lib/utils';

const THEME_BUTTON =
  'relative size-7 cursor-pointer shadow-none [&_svg]:relative [&_svg]:size-3';

/**
 * The active fill is an inset pill on `::before` rather than the button's own
 * background, so the group border and a sliver of padding stay visible around it.
 */
const THEME_BUTTON_ACTIVE =
  'z-10 text-background before:absolute before:inset-[3px] before:rounded-[5px] before:bg-foreground hover:bg-background hover:text-background hover:before:bg-foreground/90 dark:hover:bg-input/30';

export function HeaderPreferences({
  copy,
  locale,
}: {
  copy: Dictionary['common'];
  locale: Locale;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  /**
   * `resolvedTheme` reads localStorage, so it is undefined on the server and
   * already resolved on the client's first render. Pressing a button on that
   * first render is a hydration mismatch, and React answers one by discarding
   * the whole server tree — which loses unrelated markup elsewhere on the page.
   * Neither button is marked active until after hydration.
   */
  const activeTheme = useIsHydrated() ? resolvedTheme : undefined;

  return (
    <ButtonGroup aria-label={copy.preferences}>
      <Button
        aria-label={copy.lightTheme}
        aria-pressed={activeTheme === 'light'}
        className={cn(THEME_BUTTON, activeTheme === 'light' && THEME_BUTTON_ACTIVE)}
        onClick={() => setTheme('light')}
        size="icon"
        title={copy.lightTheme}
        type="button"
        variant="outline"
      >
        <Sun aria-hidden="true" />
      </Button>
      <Button
        aria-label={copy.darkTheme}
        aria-pressed={activeTheme === 'dark'}
        className={cn(THEME_BUTTON, activeTheme === 'dark' && THEME_BUTTON_ACTIVE)}
        onClick={() => setTheme('dark')}
        size="icon"
        title={copy.darkTheme}
        type="button"
        variant="outline"
      >
        <Moon aria-hidden="true" />
      </Button>
      <LocaleSwitcher
        compact
        label={copy.language}
        locale={locale}
        languageNames={copy.languages}
      />
    </ButtonGroup>
  );
}

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

function subscribeToNothing() {
  return () => {};
}
