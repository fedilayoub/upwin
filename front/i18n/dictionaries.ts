import 'server-only';

import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('@/i18n/dictionaries/en').then((module) => module.default),
  fr: () => import('@/i18n/dictionaries/fr').then((module) => module.default),
};

export function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
