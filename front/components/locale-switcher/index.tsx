'use client';

import { Languages } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isLocale, localeCookieName, locales, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function LocaleSwitcher({
  locale,
  label,
  languageNames,
  compact = false,
}: {
  locale: Locale;
  label: string;
  languageNames: Record<Locale, string>;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (nextLocale: string) => {
    if (!isLocale(nextLocale) || nextLocale === locale) return;

    const segments = pathname.split('/');
    segments[1] = nextLocale;
    const nextPath = segments.join('/') || `/${nextLocale}`;
    document.cookie = `${localeCookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.push(`${nextPath}${window.location.search}${window.location.hash}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`${label}: ${languageNames[locale]}`}
          className={cn(
            'cursor-pointer gap-2 shadow-none data-[state=open]:z-10 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
            compact && 'size-7 p-0 [&_svg]:size-3',
          )}
          size={compact ? 'icon' : 'sm'}
          title={`${label}: ${languageNames[locale]}`}
          type="button"
          variant="outline"
        >
          <Languages aria-hidden="true" className="size-4" />
          {!compact && <span>{languageNames[locale]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={switchLocale}>
          {locales.map((availableLocale) => (
            <DropdownMenuRadioItem
              className={cn(
                'cursor-pointer',
                availableLocale === locale && 'bg-accent/70 font-medium',
              )}
              key={availableLocale}
              value={availableLocale}
            >
              <span>{languageNames[availableLocale]}</span>
              <span className="ml-auto text-xs font-medium uppercase text-muted-foreground">
                {availableLocale}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
