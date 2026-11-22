import { Cpu } from 'lucide-react';
import { notFound } from 'next/navigation';
import { ModelConsole } from '@/components/admin/model-console';
import { PageHeader } from '@/components/page-header';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { ApiError } from '@/lib/api/client';
import { getCurrentModelConsole } from '@/lib/model-console-server';

export default async function ModelConsolePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dictionary = await getDictionary(lang);
  let data;
  try {
    data = await getCurrentModelConsole();
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 403) notFound();
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
      <PageHeader
        description={dictionary.modelConsole.description}
        icon={Cpu}
        title={dictionary.modelConsole.title}
      />
      <ModelConsole
        catalog={data.catalog}
        consoleData={data.console}
        copy={dictionary.modelConsole}
        locale={lang}
      />
    </div>
  );
}
