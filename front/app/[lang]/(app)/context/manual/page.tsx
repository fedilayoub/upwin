import { ArrowLeft, PenLine } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContextStepper } from '@/components/onboarding/context-stepper';
import { ManualContextForm } from '@/components/onboarding/manual-context-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getBackendApiClient } from '@/lib/api/server';

export default async function ManualContextPage({
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
  const context = await api.getFreelancerContext();
  const copy = dictionary.onboarding;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
      <PageHeader
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link href={`/${lang}/context`}>
              <ArrowLeft />
              {copy.backToOverview}
            </Link>
          </Button>
        }
        description={copy.manual.description}
        icon={PenLine}
        title={copy.manual.title}
      />

      <ContextStepper copy={copy.steps} current="add" />

      <ManualContextForm context={context} copy={copy} locale={lang} />
    </div>
  );
}
