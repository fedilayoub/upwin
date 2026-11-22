import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ThemeProvider } from '@/components/theme-switcher/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, locales } from '@/i18n/config';
import { bodyFont, displayFont } from '@/lib/fonts';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dictionary = await getDictionary(lang);

  return {
    title: {
      default: dictionary.metadata.title,
      template: '%s | upwin',
    },
    description: dictionary.metadata.description,
    robots: { index: false, follow: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      className={`${bodyFont.variable} ${displayFont.variable}`}
      lang={lang}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
