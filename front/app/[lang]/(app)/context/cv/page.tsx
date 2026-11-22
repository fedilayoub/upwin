import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContextStepper } from '@/components/onboarding/context-stepper';
import { UploadCvForm } from '@/components/onboarding/upload-cv-form';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { StarBorder } from '@/components/ui/star-border';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function UploadCvPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = (await getDictionary(lang)).onboarding;

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
        description={copy.upload.description}
        icon={FileText}
        title={copy.upload.title}
      />

      <ContextStepper copy={copy.steps} current="add" />

      <StarBorder as="section" className="bg-card p-5 sm:p-6">
        <UploadCvForm copy={copy.upload} locale={lang} />
      </StarBorder>

      <Alert variant="accent">
        <ShieldCheck />
        <AlertTitle>{copy.upload.whatHappens}</AlertTitle>
        <AlertDescription>{copy.upload.whatHappensDescription}</AlertDescription>
      </Alert>
    </div>
  );
}
