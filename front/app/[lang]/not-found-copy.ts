import type { Locale } from '@/i18n/config';

/** Copy for `not-found.tsx`, in a plain module so the content-rules test can read it. */
export const NOT_FOUND_COPY = {
  en: { title: '404: Page not found', description: "The page you're looking for doesn't exist.", home: 'Return home' },
  fr: { title: '404 : Page introuvable', description: "La page que vous recherchez n'existe pas.", home: "Retour à l'accueil" },
} as const satisfies Record<Locale, { title: string; description: string; home: string }>;
