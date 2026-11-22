import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { en, type TranslationKey } from './dictionaries/en';
import { fr } from './dictionaries/fr';
import { normalizeLocale, type Locale } from './locale';
import { localePreferenceItem } from './locale-storage';

type TranslationVariables = Readonly<Record<string, string | number>>;
export type Translate = (
  key: TranslationKey,
  variables?: TranslationVariables,
) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: Translate;
}

const dictionaries = { en, fr } satisfies Record<
  Locale,
  Record<TranslationKey, string>
>;

export function translate(
  locale: Locale,
  key: TranslationKey,
  variables: TranslationVariables = {},
): string {
  return Object.entries(variables).reduce(
    (message, [name, value]) =>
      message.replaceAll(`{${name}}`, String(value)),
    dictionaries[locale][key],
  );
}

const defaultContext: I18nContextValue = {
  locale: 'en',
  setLocale: async () => undefined,
  t: (key, variables) => translate('en', key, variables),
};

const I18nContext = createContext<I18nContextValue>(defaultContext);

function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale;
}

export async function initializeLocale({
  applyToDocument = true,
}: {
  applyToDocument?: boolean;
} = {}): Promise<Locale> {
  try {
    const preference = await localePreferenceItem.getValue();
    const locale = preference ?? normalizeLocale(navigator.language);
    if (applyToDocument) applyLocale(locale);
    return locale;
  } catch {
    const locale = normalizeLocale(navigator.language);
    if (applyToDocument) applyLocale(locale);
    return locale;
  }
}

export function I18nProvider({
  children,
  initialLocale,
  syncDocumentLanguage = true,
}: {
  children: ReactNode;
  initialLocale: Locale;
  syncDocumentLanguage?: boolean;
}) {
  const [locale, setLocaleState] = useState(initialLocale);

  useEffect(
    () =>
      localePreferenceItem.watch((nextLocale) => {
        if (!nextLocale) return;
        setLocaleState(nextLocale);
        if (syncDocumentLanguage) applyLocale(nextLocale);
      }),
    [syncDocumentLanguage],
  );

  const setLocale = useCallback(
    async (nextLocale: Locale) => {
      setLocaleState(nextLocale);
      if (syncDocumentLanguage) applyLocale(nextLocale);
      await localePreferenceItem.setValue(nextLocale);
    },
    [syncDocumentLanguage],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, variables) => translate(locale, key, variables),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
