import { FilePenLine } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ProposalPreferencesForm } from '@/components/proposals/proposal-preferences-form';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getBackendApiClient } from '@/lib/api/server';
import { hardwareFont } from '@/lib/hardware/font';
import { cn } from '@/lib/utils';

export default async function ProposalsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dictionary, api] = await Promise.all([
    getDictionary(lang),
    getBackendApiClient(),
  ]);
  const preferences = await api.getProposalPreferences();
  const copy = dictionary.proposals;

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4',
        // The form's hardware panel prints in this face.
        hardwareFont.variable,
      )}
    >
      <PageHeader
        description={copy.description}
        icon={FilePenLine}
        title={copy.title}
      />

      <ProposalPreferencesForm
        copy={copy}
        locale={lang}
        preferences={preferences}
      />
    </div>
  );
}
