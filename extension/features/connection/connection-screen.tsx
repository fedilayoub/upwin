import { LoaderCircle } from 'lucide-react';
import { StarBorder } from '@/components/ui/star-border';
import { useI18n } from '@/features/i18n/i18n-context';
import { useConnection } from './connection-context';
import { ConnectionForm } from './connection-form';

/**
 * Shown whenever the API is not answering as it should: on first run when the
 * defaults do not work, or later when the API stops. It replaces the old
 * sign-in screen; there are no accounts.
 */
export function ConnectionScreen() {
  const { status } = useConnection();
  const { t } = useI18n();

  if (status === 'checking') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <LoaderCircle aria-label={t('connection.checking')} className="size-5 animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-8 text-foreground">
      <StarBorder as="section" className="w-full max-w-sm bg-card p-5">
        <h1 className="text-base font-semibold">{t('connection.title')}</h1>
        <p className="mb-4 mt-2 text-sm leading-relaxed text-muted-foreground">
          {t('connection.description')}
        </p>
        <ConnectionForm />
      </StarBorder>
    </main>
  );
}
