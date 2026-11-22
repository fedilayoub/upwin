import { BriefcaseBusiness } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ContextChoiceCards } from '@/components/onboarding/context-choice-cards';
import { ContextStepper } from '@/components/onboarding/context-stepper';
import { ContextSummary } from '@/components/onboarding/context-summary';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getBackendApiClient } from '@/lib/api/server';

export default async function MeAndMySkillsPage({
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
        description={copy.description}
        icon={BriefcaseBusiness}
        title={copy.title}
      />

      {context ? (
        <>
          <ContextSummary context={context} copy={copy} locale={lang} />
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-[-0.015em]">
                {copy.replaceTitle}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {copy.replaceDescription}
              </p>
            </div>
            <ContextChoiceCards copy={copy} locale={lang} />
          </section>
        </>
      ) : (
        <>
          <ContextStepper copy={copy.steps} current="add" />
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-[-0.015em]">
                {copy.choicesTitle}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {copy.choicesDescription}
              </p>
            </div>
            <ContextChoiceCards copy={copy} locale={lang} />
          </section>
        </>
      )}
    </div>
  );
}
