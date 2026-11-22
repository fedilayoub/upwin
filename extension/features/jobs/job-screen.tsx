import { ErrorReference } from '@/components/shared/error-notice';
import type { ErrorRecord } from '@/features/diagnostics/errors';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  ScanSearch,
} from 'lucide-react';
import { PageHeading } from '@/components/shared/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PageState } from '@/features/extension/use-page-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n, type Translate } from '@/features/i18n/i18n-context';
import type { Locale } from '@/features/i18n/locale';
import type { AppSection } from '@/features/navigation/types';
import { ScoreBreakdown } from '@/features/profile/profile-breakdown';
import { ScoreSummaryCard } from '@/features/profile/score-summary-card';
import {
  DraftChainOfThought,
  draftStageLabel,
} from '@/features/proposals/draft-chain-of-thought';
import { useProposal } from '@/features/proposals/proposal-context';
import {
  type DraftFlowStage,
} from '@/features/proposals/use-draft-flow';
import {
  JOB_MATCH_DIMENSION_IDS,
  type JobAnalysis,
  type JobSnapshot,
} from '@/types/job';
import { DIMENSION_LABELS } from './dimension-labels';
import { JobEntryCard } from './job-entry-card';
import { useJobPageStatus } from './use-job-page-status';

export { DIMENSION_LABELS };

export function JobScreen({
  onNavigate,
}: {
  onNavigate: (section: AppSection) => void;
}) {
  const { t } = useI18n();
  const { flow, retry, start } = useProposal();
  const pageStatus = useJobPageStatus();
  const snapshot = flow.capture?.snapshot ?? null;

  if (!snapshot && flow.stage === null && !flow.error) {
    return (
      <JobEntry
        onRecheckPage={pageStatus.recheck}
        onStart={() => void start()}
        pageState={pageStatus.status}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading
        description={t('job.description')}
        icon={BriefcaseBusiness}
        title={t('job.title')}
      />

      {flow.stage || flow.failedStage || flow.draft ? (
        <DraftChainOfThought
          analysis={flow.analysis}
          capture={flow.capture}
          draft={flow.draft}
          failedStage={flow.failedStage}
          onViewProposal={() => onNavigate('proposal')}
          stage={flow.stage}
        />
      ) : null}
      {flow.error && flow.failedStage ? (
        <JobFlowError
          failure={flow.failure}
          message={flow.error}
          onRetry={() => void retry()}
          stage={flow.failedStage}
        />
      ) : null}

      {snapshot && flow.analysis ? (
        <JobMatchResults analysis={flow.analysis} snapshot={snapshot} />
      ) : snapshot ? (
        <JobSummary snapshot={snapshot} />
      ) : null}

    </div>
  );
}

function JobEntry({
  onRecheckPage,
  onStart,
  pageState,
}: {
  onRecheckPage: () => void;
  onStart: () => void;
  pageState: PageState;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <PageHeading
        description={t('job.entryDescription')}
        icon={BriefcaseBusiness}
        title={t('job.title')}
      />
      <JobEntryCard
        help={t('job.entryHelp')}
        icon={ScanSearch}
        onRecheckPage={onRecheckPage}
        onStart={onStart}
        pageState={pageState}
        title={t('job.entryTitle')}
      />
    </div>
  );
}

export function JobFlowError({
  failure = null,
  message,
  onRetry,
  stage,
}: {
  failure?: ErrorRecord | null;
  message: string;
  onRetry: () => void;
  stage: DraftFlowStage;
}) {
  const { locale, t } = useI18n();
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
        {failure ? <ErrorReference failure={failure} /> : null}
        <Button onClick={onRetry} variant="outline">
          {t('job.retryStage', {
            stage: draftStageLabel(stage, t).toLocaleLowerCase(locale),
          })}
        </Button>
      </CardContent>
    </Card>
  );
}

export function JobMatchResults({
  analysis,
  snapshot,
}: {
  analysis: JobAnalysis;
  snapshot: JobSnapshot;
}) {
  const { t } = useI18n();

  return (
    <section
      className="grid min-w-0 gap-5 min-[760px]:grid-cols-12"
      data-job-results
    >
      <div className="min-w-0 min-[760px]:col-span-7">
        <JobSummary snapshot={snapshot} />
      </div>

      <div className="min-w-0 min-[760px]:col-span-5">
        <ScoreSummaryCard
          className="h-full"
          context={t('job.matchContext')}
          label={t('job.matchScore')}
          score={analysis.matchScore}
          summary={analysis.summary}
        />
      </div>

      <div className="min-w-0 min-[760px]:col-span-12">
        <ScoreBreakdown
          labels={{
            budget: t('job.dimension.budget'),
            domain: t('job.dimension.domain'),
            experience: t('job.dimension.experience'),
            goalAlignment: t('job.dimension.goalAlignment'),
            skills: t('job.dimension.skills'),
          }}
          orderedIds={JOB_MATCH_DIMENSION_IDS}
          sections={analysis.dimensions}
          title={t('job.breakdown')}
        />
      </div>

      <div className="grid min-w-0 gap-3 min-[760px]:col-span-7 min-[1040px]:grid-cols-2">
        <FindingCard
          empty={t('job.noStrengths')}
          icon={Check}
          items={analysis.strengths}
          title={t('job.strengths')}
          tone="success"
        />
        <FindingCard
          empty={t('job.noConcerns')}
          icon={AlertTriangle}
          items={analysis.concerns}
          title={t('job.concerns')}
          tone="warning"
        />
      </div>

      <div className="min-w-0 min-[760px]:col-span-5">
        <AboutJob snapshot={snapshot} />
      </div>
    </section>
  );
}

function JobSummary({ snapshot }: { snapshot: JobSnapshot }) {
  const { locale, t } = useI18n();
  const { job } = snapshot;
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-primary" />
      <CardHeader>
        <div className="mb-1 flex items-center justify-between gap-3">
          <Badge variant="outline">{t('job.current')}</Badge>
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <CircleDollarSign className="size-3.5" />
            {budgetLabel(job.engagement, locale, t)}
          </span>
        </div>
        <h2 className="text-lg leading-snug font-semibold tracking-tight">
          {job.title}
        </h2>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-5 text-sm leading-relaxed text-muted-foreground">
          {job.description}
        </p>
        {job.skills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.skills.map((skill) => (
              <Badge key={`${skill.relevance}-${skill.name}`} variant="outline">
                {skill.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AboutJob({ snapshot }: { snapshot: JobSnapshot }) {
  const { locale, t } = useI18n();
  const { activity, client } = snapshot.job;
  const facts = [
    [t('job.payment'), paymentLabel(client.paymentVerified, t)],
    [
      t('job.clientRating'),
      ratingLabel(client.rating, client.reviewCount, locale, t),
    ],
    [t('job.clientSpend'), moneyLabel(client.totalSpend, locale)],
    [t('job.clientHires'), numberLabel(client.hires, locale)],
    [t('job.hireRate'), percentageLabel(client.hireRate, locale)],
    [t('job.applicants'), numberLabel(activity.applicants, locale)],
    [t('job.interviewing'), numberLabel(activity.interviewing, locale)],
  ].filter((entry): entry is [string, string] => entry[1] !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('job.about')}</CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('job.aboutHelp')}
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 pt-2.5">
        {facts.length > 0 ? (
          facts.map(([label, value]) => (
            <div className="rounded-lg bg-muted/55 p-2.5" key={label}>
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-sm font-semibold">{value}</p>
            </div>
          ))
        ) : (
          <p className="col-span-2 text-xs text-muted-foreground">
            {t('job.noClientDetails')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FindingCard({
  empty,
  icon: Icon,
  items,
  title,
  tone,
}: {
  empty: string;
  icon: typeof Check;
  items: string[];
  title: string;
  tone: 'success' | 'warning';
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {items.length > 0 ? (
          items.map((item) => (
            <div className="flex items-start gap-2 text-sm" key={item}>
              <Icon
                className={`mt-0.5 size-4 shrink-0 ${
                  tone === 'success' ? 'text-success' : 'text-warning'
                }`}
              />
              <span>{item}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function budgetLabel(
  engagement: JobSnapshot['job']['engagement'],
  locale: Locale,
  t: Translate,
): string {
  if (engagement.fixedBudget) {
    return `${engagement.fixedBudget.currency} ${engagement.fixedBudget.amount.toLocaleString(locale)}`;
  }
  if (engagement.hourlyBudget) {
    const { currency, min, max } = engagement.hourlyBudget;
    if (min !== undefined && max !== undefined) {
      return t('job.hourlyRange', { currency, max, min });
    }
    if (min !== undefined) {
      return t('job.hourlyMinimum', { amount: min, currency });
    }
    if (max !== undefined) {
      return t('job.upToHourly', { amount: max, currency });
    }
  }
  return engagement.budgetType === 'fixed'
    ? t('job.fixedPrice')
    : engagement.budgetType === 'hourly'
      ? t('job.hourly')
      : t('job.budgetMissing');
}

function paymentLabel(value: boolean | null, t: Translate): string | null {
  if (value === null) return null;
  return value ? t('job.verified') : t('job.notVerified');
}

function ratingLabel(
  rating: number | undefined,
  reviews: number | undefined,
  locale: Locale,
  t: Translate,
): string | null {
  if (rating === undefined) return null;
  const score = rating.toLocaleString(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  return reviews === undefined
    ? `${score} / 5`
    : `${score} / 5 · ${t('job.reviews', { count: reviews })}`;
}

function moneyLabel(value: number | undefined, locale: Locale): string | null {
  return value === undefined ? null : `$${value.toLocaleString(locale)}`;
}

function numberLabel(value: number | undefined, locale: Locale): string | null {
  return value === undefined ? null : value.toLocaleString(locale);
}

function percentageLabel(
  value: number | undefined,
  locale: Locale,
): string | null {
  return value === undefined
    ? null
    : `${value.toLocaleString(locale, { maximumFractionDigits: 0 })}%`;
}
