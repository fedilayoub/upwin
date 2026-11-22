import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { HeaderPreferences } from '@/components/header-preferences';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { StarBorder } from '@/components/ui/star-border';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

/** The app runs on the freelancer's own machine; nothing here belongs in a search index. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = await getDictionary(lang);

  return (
    <SidebarProvider>
      <AppSidebar copy={dictionary.navigation} locale={lang} />
      {/* min-w-0: a flex item defaults to its content's min width, so the
          kanban's eight lanes would widen the page instead of scrolling. */}
      <SidebarInset className="min-w-0">
        <StarBorder
          className="sticky top-3 z-30 mx-4 mt-3 mb-1 h-12 shrink-0 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
        >
          <header className="flex h-full items-center justify-between px-3">
            <SidebarTrigger className="-ml-1" />
            <HeaderPreferences copy={dictionary.common} locale={lang} />
          </header>
        </StarBorder>
        <main className="relative flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="pointer-events-none absolute inset-0 h-[580px] bg-[linear-gradient(143.6deg,rgba(111,218,68,0)_20.79%,rgba(111,218,68,0.14)_40.92%,rgba(111,218,68,0)_70.35%)] blur-xl" />
          <div className="relative flex flex-1 flex-col">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
