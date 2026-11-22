export const locales = ['en', 'fr'] as const;

export type Locale = (typeof locales)[number];

export function normalizeLocale(value: string | null | undefined): Locale {
  const language = value?.trim().toLocaleLowerCase().split(/[-_]/)[0];
  return language === 'fr' ? 'fr' : 'en';
}
