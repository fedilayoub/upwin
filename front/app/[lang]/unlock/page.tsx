import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { LogoMark } from '@/components/logo/logo-mark';
import { StarBorder } from '@/components/ui/star-border';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { configuredAppPassword, safeNextPath } from '@/lib/app-session';
import { UnlockForm } from './unlock-form';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function UnlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(lang)) notFound();
  if (configuredAppPassword() === null) redirect(`/${lang}`);
  const copy = (await getDictionary(lang)).unlock;
  const next = safeNextPath(
    Array.isArray(query.next) ? query.next[0] : query.next,
    `/${lang}`,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 text-foreground">
      <StarBorder as="section" className="w-full max-w-sm bg-card p-6">
        <div className="mb-4 flex items-center gap-2 font-semibold">
          <LogoMark className="size-5" /> upwin
        </div>
        <h1 className="text-lg font-semibold">{copy.title}</h1>
        <p className="mb-5 mt-2 text-sm leading-relaxed text-muted-foreground">
          {copy.description}
        </p>
        <UnlockForm copy={copy} locale={lang} next={next} />
      </StarBorder>
    </main>
  );
}
