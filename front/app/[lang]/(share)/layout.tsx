import { notFound } from 'next/navigation';
import { LogoMark } from '@/components/logo/logo-mark';
import { isLocale } from '@/i18n/config';

/**
 * The public share pages: a quiet branded frame, no app chrome, and no link
 * into the rest of the site, which is the freelancer's own private app.
 */
export default async function ShareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip bg-[var(--landing-page-background)] text-[var(--marketing-text)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem]"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 0%, color-mix(in oklch, var(--hero-palette-orange) 20%, transparent), transparent 72%), radial-gradient(28% 36% at 82% 8%, color-mix(in oklch, var(--hero-palette-amber) 12%, transparent), transparent 70%)',
        }}
      />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <span className="inline-flex items-center gap-2 font-semibold">
          <LogoMark className="size-5" />
          upwin
        </span>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
