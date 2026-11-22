'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isLocale } from '@/i18n/config';

/**
 * Most failures of a self-hosted install are "the API is not running", and
 * every page but Connection needs it. So this page points there: Connection
 * renders without the API and says what is wrong.
 */
const copy = {
  en: {
    title: 'Something went wrong',
    description: 'This page could not load. The most common cause is that the upwin API is not running.',
    retry: 'Try again',
    connection: 'Check the connection',
  },
  fr: {
    title: "Une erreur s'est produite",
    description: "Cette page n'a pas pu se charger. La cause la plus fréquente : l'API upwin n'est pas démarrée.",
    retry: 'Réessayer',
    connection: 'Vérifier la connexion',
  },
};

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const params = useParams<{ lang: string }>();
  const locale = isLocale(params.lang) ? params.lang : 'en';
  const text = copy[locale];

  return (
    <section className="container mx-auto flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-4xl font-bold md:text-6xl">{text.title}</h1>
        <p className="mb-6 mt-4 text-lg text-muted-foreground">{text.description}</p>
        <div className="flex items-center justify-center gap-6">
          <button className="font-medium text-primary hover:underline" onClick={reset} type="button">
            {text.retry}
          </button>
          <Link className="font-medium text-primary hover:underline" href={`/${locale}/settings/connection`}>
            {text.connection}
          </Link>
        </div>
      </div>
    </section>
  );
}
