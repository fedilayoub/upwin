import { SlidersHorizontal } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PromptConsoleEditor } from '@/components/admin/prompt-console-editor';
import { PageHeader } from '@/components/page-header';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { ApiError } from '@/lib/api/client';
import { getCurrentPromptConsole } from '@/lib/prompt-console-server';

export default async function PromptConsolePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dictionary = await getDictionary(lang);
  let data;
  try {
    data = await getCurrentPromptConsole();
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 403) notFound();
    throw error;
  }
  const copy = dictionary.promptConsole;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
      <PageHeader
        description={copy.description}
        icon={SlidersHorizontal}
        title={copy.title}
      />

      <PromptConsoleEditor
        consoleData={data.console}
        copy={copy}
        locale={lang}
        revisions={data.revisions}
      />
    </div>
  );
}
