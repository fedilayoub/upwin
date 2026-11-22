import * as SelectPrimitive from '@radix-ui/react-select';
import { Circle, Languages, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { SelectContent } from '@/components/ui/select';
import { useI18n } from '@/features/i18n/i18n-context';
import { locales, type Locale } from '@/features/i18n/locale';
import { cn } from '@/lib/utils';
import { useTheme } from './theme-context';

/**
 * The web header's outline control. Its dark surface is spelled with
 * `in-[[data-theme=dark]]` because the panel themes on `data-theme`, and this
 * build's `dark:` still follows the OS colour scheme.
 */
const CONTROL =
  'size-7 cursor-pointer shadow-none [&_svg]:relative [&_svg]:size-3 in-[[data-theme=dark]]:border-input in-[[data-theme=dark]]:bg-input/30 in-[[data-theme=dark]]:hover:bg-input/50';

/**
 * The active fill is an inset pill on `::before` rather than the button's own
 * background, so the group border and a sliver of padding stay visible around it.
 */
const CONTROL_ACTIVE =
  'z-10 text-background before:absolute before:inset-[3px] before:rounded-[5px] before:bg-foreground hover:bg-background hover:text-background hover:before:bg-foreground/90 in-[[data-theme=dark]]:hover:bg-input/30';

const LANGUAGE_NAME_KEYS = {
  en: 'settings.english',
  fr: 'settings.french',
} as const satisfies Record<Locale, string>;

export function HeaderPreferences() {
  const { resolvedTheme, setPreference } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const languageLabel = `${t('settings.language')}: ${t(LANGUAGE_NAME_KEYS[locale])}`;

  return (
    <ButtonGroup aria-label={t('app.appearanceAndLanguage')}>
      <Button
        aria-label={t('app.useLightTheme')}
        aria-pressed={resolvedTheme === 'light'}
        className={cn(CONTROL, resolvedTheme === 'light' && CONTROL_ACTIVE)}
        onClick={() => void setPreference('light')}
        size="icon"
        title={t('app.useLightTheme')}
        type="button"
        variant="outline"
      >
        <Sun aria-hidden="true" />
      </Button>
      <Button
        aria-label={t('app.useDarkTheme')}
        aria-pressed={resolvedTheme === 'dark'}
        className={cn(CONTROL, resolvedTheme === 'dark' && CONTROL_ACTIVE)}
        onClick={() => void setPreference('dark')}
        size="icon"
        title={t('app.useDarkTheme')}
        type="button"
        variant="outline"
      >
        <Moon aria-hidden="true" />
      </Button>
      <SelectPrimitive.Root
        onValueChange={(value: Locale) => void setLocale(value)}
        value={locale}
      >
        <SelectPrimitive.Trigger asChild>
          <Button
            aria-label={languageLabel}
            className={cn(
              CONTROL,
              'data-[state=open]:z-10 data-[state=open]:bg-muted in-[[data-theme=dark]]:data-[state=open]:bg-input/50',
            )}
            size="icon"
            title={languageLabel}
            type="button"
            variant="outline"
          >
            <Languages aria-hidden="true" />
          </Button>
        </SelectPrimitive.Trigger>
        <SelectContent
          align="end"
          className="min-w-40 shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
        >
          <SelectPrimitive.Group>
            <SelectPrimitive.Label className="px-2 py-1.5 text-sm font-medium">
              {t('settings.language')}
            </SelectPrimitive.Label>
            {locales.map((availableLocale) => (
              <SelectPrimitive.Item
                className={cn(
                  'relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm outline-none data-[highlighted]:bg-muted',
                  availableLocale === locale && 'bg-muted/70 font-medium',
                )}
                key={availableLocale}
                value={availableLocale}
              >
                <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Circle aria-hidden="true" className="size-2 fill-current" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>
                  {t(LANGUAGE_NAME_KEYS[availableLocale])}
                </SelectPrimitive.ItemText>
                <span className="ml-auto text-xs font-medium uppercase text-muted-foreground">
                  {availableLocale}
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Group>
        </SelectContent>
      </SelectPrimitive.Root>
    </ButtonGroup>
  );
}
