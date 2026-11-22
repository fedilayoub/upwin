import {
  ArrowLeft,
  BriefcaseBusiness,
  FolderGit2,
  Palette,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmContextForm } from '@/components/onboarding/confirm-context-form';
import { ContextReplacementNotice } from '@/components/onboarding/context-replacement-notice';
import { ContextResetCard } from '@/components/onboarding/context-reset-card';
import { ContextStepper } from '@/components/onboarding/context-stepper';
import { ContextSummary } from '@/components/onboarding/context-summary';
import { ManualContextForm } from '@/components/onboarding/manual-context-form';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StarBorder } from '@/components/ui/star-border';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import type { Dictionary } from '@/i18n/types';
import type { FreelancerContext } from '@/lib/api';
import { getBackendApiClient } from '@/lib/api/server';
import { canConfirmFreelancerContext } from '@/lib/context-validation';

export default async function ContextReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ edit?: string; replaced?: string }>;
}) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(lang)) notFound();
  const [dictionary, api] = await Promise.all([
    getDictionary(lang),
    getBackendApiClient(),
  ]);
  const context = await api.getFreelancerContext();
  const copy = dictionary.onboarding;

  if (!context) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
        <PageHeader
          description={copy.review.noDraftDescription}
          icon={BriefcaseBusiness}
          title={copy.review.noDraftTitle}
        />
        <StarBorder className="bg-card p-6">
          <Button asChild>
            <Link href={`/${lang}/context`}>{copy.review.startOnboarding}</Link>
          </Button>
        </StarBorder>
      </div>
    );
  }

  if (query.edit === '1') {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
        <PageHeader
          actions={
            <Button asChild size="sm" variant="ghost">
              <Link href={`/${lang}/context/review`}>
                <ArrowLeft />
                {copy.manual.cancel}
              </Link>
            </Button>
          }
          description={copy.manual.editDescription}
          icon={Pencil}
          title={copy.manual.editTitle}
        />
        <ContextStepper copy={copy.steps} current="add" done={['add']} />
        <ManualContextForm context={context} copy={copy} editing locale={lang} />
      </div>
    );
  }

  const isTrusted = context.confirmedAt !== null;
  const canConfirm = canConfirmFreelancerContext(context);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
      <PageHeader
        actions={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/${lang}/context`}>
                <ArrowLeft />
                {copy.backToOverview}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/${lang}/context/review?edit=1`}>
                <Pencil />
                {copy.review.edit}
              </Link>
            </Button>
          </>
        }
        description={copy.review.description}
        icon={BriefcaseBusiness}
        title={copy.review.title}
      />

      <ContextStepper
        copy={copy.steps}
        current={isTrusted ? 'confirm' : 'review'}
        done={isTrusted ? ['add', 'review', 'confirm'] : ['add']}
      />

      <ContextReplacementNotice
        message={copy.review.replacementNotice}
        visible={query.replaced === '1'}
      />

      <Alert variant={isTrusted ? 'accent' : 'warning'}>
        {isTrusted ? <ShieldCheck /> : <ShieldAlert />}
        <AlertTitle>
          {isTrusted ? copy.review.trustedTitle : copy.review.untrustedTitle}
        </AlertTitle>
        <AlertDescription>
          {isTrusted
            ? copy.review.trustedDescription
            : copy.review.untrustedDescription}
        </AlertDescription>
      </Alert>

      <ContextSummary
        context={context}
        copy={copy}
        locale={lang}
        showActions={false}
      />

      {!isTrusted ? (
        <StarBorder className="flex flex-col gap-3 border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-[-0.015em]">
              {copy.steps.confirmTitle}
            </h2>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              {copy.steps.confirmDescription}
            </p>
          </div>
          <ConfirmContextForm
            canConfirm={canConfirm}
            copy={copy.review}
            locale={lang}
          />
        </StarBorder>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-[-0.015em]">
            {copy.review.detailsTitle}
          </h2>
          <Badge className="font-normal" variant="outline">
            {copy.review.sourceLabel}: {sourceLabel(context, copy.review)}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ReviewCard icon={Trophy} title={copy.review.experienceSection}>
            <Detail
              fallback={copy.review.sectionEmpty}
              label={copy.review.yearsExperience}
              value={context.experience.years?.toString()}
            />
            <ListDetail
              fallback={copy.review.sectionEmpty}
              label={copy.review.roles}
              values={context.experience.roles
                .map((role) =>
                  [role.title, role.company, role.period]
                    .filter(Boolean)
                    .join(' · '),
                )
                .filter(Boolean)}
            />
            <TagDetail
              fallback={copy.review.sectionEmpty}
              label={copy.review.skills}
              values={context.skills}
            />
          </ReviewCard>

          <ReviewCard icon={Target} title={copy.review.positioningSection}>
            <Detail
              fallback={copy.review.sectionEmpty}
              label={copy.review.targetRole}
              value={context.positioning.targetRole}
            />
            <TagDetail
              fallback={copy.review.sectionEmpty}
              label={copy.review.targetClients}
              values={context.positioning.targetClients ?? []}
            />
            <TagDetail
              fallback={copy.review.sectionEmpty}
              label={copy.review.targetIndustries}
              values={context.positioning.targetIndustries ?? []}
            />
            <Detail
              fallback={copy.review.sectionEmpty}
              label={copy.review.targetRate}
              value={context.positioning.targetRate?.toString()}
            />
          </ReviewCard>

          <ReviewCard icon={FolderGit2} title={copy.review.portfolioSection}>
            {context.portfolio.length > 0 ? (
              <ul className="space-y-3">
                {context.portfolio.map((project, index) => (
                  <StarBorder
                    as="li"
                    className="bg-muted/30 p-3"
                    key={`${project.title ?? ''}-${index}`}
                  >
                    <p className="text-sm font-medium">
                      {project.title ?? copy.review.noDetails}
                    </p>
                    {project.description ? (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {project.description}
                      </p>
                    ) : null}
                    {project.skills.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {project.skills.map((skill) => (
                          <span
                            className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground"
                            key={skill}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </StarBorder>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {copy.review.sectionEmpty}
              </p>
            )}
          </ReviewCard>

          <ReviewCard icon={Palette} title={copy.review.preferencesSection}>
            <Detail
              fallback={copy.review.sectionEmpty}
              label={copy.review.tone}
              value={context.preferences.tone}
            />
            <TagDetail
              fallback={copy.review.sectionEmpty}
              label={copy.review.services}
              values={context.preferences.services ?? []}
            />
          </ReviewCard>
        </div>
      </section>

      <ContextResetCard copy={copy.review} locale={lang} />
    </div>
  );
}

function ReviewCard({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <StarBorder as="article" className="flex flex-col gap-4 bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <StarBorder
          aria-hidden="true"
          as="span"
          className="grid size-8 shrink-0 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
        >
          <Icon className="size-4" strokeWidth={2} />
        </StarBorder>
        <h3 className="text-base font-semibold tracking-[-0.015em]">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </StarBorder>
  );
}

function Detail({
  fallback,
  label,
  value,
}: {
  fallback: string;
  label: string;
  value?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={value ? 'text-sm' : 'text-sm text-muted-foreground'}>
        {value || fallback}
      </p>
    </div>
  );
}

function ListDetail({
  fallback,
  label,
  values,
}: {
  fallback: string;
  label: string;
  values: string[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {values.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {values.map((value) => (
            <li className="flex gap-2" key={value}>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{fallback}</p>
      )}
    </div>
  );
}

function TagDetail({
  fallback,
  label,
  values,
}: {
  fallback: string;
  label: string;
  values: string[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              className="rounded-full bg-muted px-2.5 py-1 text-xs"
              key={value}
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{fallback}</p>
      )}
    </div>
  );
}

function sourceLabel(
  context: FreelancerContext,
  copy: Dictionary['onboarding']['review'],
): string {
  if (context.source === 'cv') return copy.sourceCv;
  if (context.source === 'mixed') return copy.sourceMixed;
  return copy.sourceManual;
}
