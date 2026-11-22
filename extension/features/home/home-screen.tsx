import { ErrorReference } from '@/components/shared/error-notice';
import type { ErrorRecord } from '@/features/diagnostics/errors';
import { useCallback, useEffect } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  MessageCircleReply,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { ScoreGauge } from '@/components/charts/score-gauge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StarBorder } from '@/components/ui/star-border';
import { useConnection } from '@/features/connection/connection-context';
import { useI18n, type Translate } from '@/features/i18n/i18n-context';
import type { AppSection } from '@/features/navigation/types';
import { useAsyncAction } from '@/hooks/use-async-action';
import { formatGoal } from '@/lib/utils';
import type { RequestStatus } from '@/services/api';
import { insightsService } from '@/services/insights';
import { profileService } from '@/services/profile';
import type {
  InsightsSummary,
} from '@/types/insights';
import type { ProfileRecommendation } from '@/types/profile';

export interface HomeData {
  priorities: ProfileRecommendation[];
  summary: InsightsSummary;
}

export function HomeScreen({
  onNavigate,
}: {
  onNavigate: (section: AppSection) => void;
}) {
  const { getToken } = useConnection();
  const loadHome = useCallback(async (): Promise<HomeData> => {
    const summary = await insightsService.getInsightsSummary(getToken);
    const latestAnalysis = summary.profile.latestAnalysisId
      ? await profileService.getAnalysis(
          summary.profile.latestAnalysisId,
          getToken,
        )
      : null;

    return {
      priorities: latestAnalysis?.priorities.slice(0, 3) ?? [],
      summary,
    };
  }, [getToken]);
  const request = useAsyncAction(loadHome);

  useEffect(() => {
    if (request.status === 'idle') void request.execute();
  }, [request.execute, request.status]);

  return (
    <HomeView
      data={request.data}
      error={request.error}
      failure={request.failure}
      onNavigate={onNavigate}
      onRetry={() => void request.execute()}
      status={request.status}
    />
  );
}

export function HomeView({
  data,
  error,
  failure = null,
  onNavigate,
  onRetry,
  status,
}: {
  data: HomeData | null;
  error: string | null;
  failure?: ErrorRecord | null;
  onNavigate: (section: AppSection) => void;
  onRetry: () => void;
  status: RequestStatus;
}) {
  const { t } = useI18n();
  const activeGoal = data?.summary.profile.activeGoal ?? null;

  return (
    <div className="space-y-4 min-[380px]:space-y-5" data-home-screen>
      <header className="px-0.5">
        {activeGoal ? (
          <p className="break-words text-sm font-medium">
            {formatGoal(activeGoal.objective)} ·{' '}
            <span className="text-muted-foreground">
              {activeGoal.targetRole}
            </span>
          </p>
        ) : data ? (
          <p className="text-sm text-muted-foreground">
            {t('home.noGoal')}
          </p>
        ) : status === 'error' ? (
          <p className="text-sm text-muted-foreground">
            {t('home.focusToday')}
          </p>
        ) : (
          <Skeleton className="h-4 w-56" />
        )}
      </header>

      {status === 'idle' || status === 'loading' ? <HomeLoading /> : null}
      {status === 'error' ? (
        <HomeError
          failure={failure}
          message={error ?? t('home.loadError')}
          onRetry={onRetry}
        />
      ) : null}
      {status === 'success' && data ? (
        data.summary.profile.latestWinningScore === null ? (
          <HomeEmpty onNavigate={onNavigate} />
        ) : (
          <div
            className="grid min-w-0 gap-4 min-[760px]:grid-cols-2 min-[1040px]:grid-cols-12"
            data-home-dashboard
          >
            <div className="min-w-0 space-y-2 min-[760px]:col-span-2 min-[1040px]:col-span-12">
              <HomeStats summary={data.summary} />
            </div>
            {/* Proposal activity lives in the Draft tab now. */}
            <div className="min-w-0 min-[760px]:col-span-2 min-[1040px]:col-span-12">
              <FocusActions
                onNavigate={onNavigate}
                priorities={data.priorities}
              />
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

export function HomeLoading() {
  const { t } = useI18n();

  return (
    <div
      aria-label={t('home.loading')}
      className="grid gap-3 min-[760px]:grid-cols-2"
    >
      <Skeleton className="h-52 rounded-none min-[760px]:col-span-2" />
      <Skeleton className="h-44 rounded-none min-[760px]:col-span-2" />
    </div>
  );
}

export function HomeError({
  failure = null,
  message,
  onRetry,
}: {
  failure?: ErrorRecord | null;
  message: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 pt-4">
        <div>
          <h2 className="text-sm font-semibold">
            {t('home.unavailableTitle')}
          </h2>
          <p className="mt-1 text-sm text-destructive" role="alert">
            {message}
          </p>
          {failure ? <ErrorReference className="mt-1.5" failure={failure} /> : null}
        </div>
        <Button onClick={onRetry} variant="outline">
          {t('common.tryAgain')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function HomeEmpty({
  onNavigate,
}: {
  onNavigate: (section: AppSection) => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="flex flex-col items-center px-5 py-10 text-center">
        <StarBorder
          aria-hidden="true"
          as="span"
          className="mb-4 flex size-11 items-center justify-center bg-primary/10 text-primary-strong"
        >
          <Sparkles className="size-5" />
        </StarBorder>
        <h2 className="text-sm font-semibold">{t('home.runFirstTitle')}</h2>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
          {t('home.runFirstDescription')}
        </p>
        <Button className="mt-5" onClick={() => onNavigate('profile')}>
          {t('home.analyzeProfile')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function HomeStats({ summary }: { summary: InsightsSummary }) {
  const { locale, t } = useI18n();
  const score = summary.profile.latestWinningScore;
  if (score === null) return null;

  // Below the minimum sample the backend nulls the rate on purpose: a percentage
  // off three applications is a number the user would act on and should not. Show
  // the raw fraction the server counted instead — never a derived percentage.
  // Zero applications is not a zero reply rate. `0 of 0` reads as a measured
  // result when nothing has been measured, so suppress it rather than render a
  // fraction of nothing.
  const hasSentApplications = summary.outcomes.sent > 0;
  const replyValue = !hasSentApplications
    ? '—'
    : summary.outcomes.sufficientData && summary.outcomes.replyRate !== null
      ? `${Math.round(summary.outcomes.replyRate * 100)}%`
      : `${summary.outcomes.replied} of ${summary.outcomes.sent}`;
  const replyHint = !hasSentApplications
    ? t('home.noApplications')
    : summary.outcomes.sufficientData
      ? t('home.markedApplications')
      : t('home.repliedNeeds', {
          count: summary.outcomes.minimumSample,
        });

  const metrics = [
    {
      hint: t('home.thisMonth'),
      icon: FileText,
      label: t('home.proposals'),
      value: String(summary.proposals.draftedLast30Days),
    },
    {
      hint: replyHint,
      icon: MessageCircleReply,
      label: t('home.replyRate'),
      value: replyValue,
    },
    {
      hint: t('home.lastCheck', {
        time: formatDaysAgo(summary.profile.daysSinceLastAnalysis, t).toLocaleLowerCase(
          locale,
        ),
      }),
      icon: CalendarDays,
      label: t('home.analyses'),
      value: String(summary.profile.analysesCount),
    },
  ];

  return (
    <section aria-label={t('home.yourStats')} data-home-kpi-panel>
      <Card className="overflow-hidden rounded-2xl border-primary/18 shadow-[0_22px_52px_-36px_var(--profile-shadow)]">
        <CardContent className="p-0">
          {/* Two columns at every width, not just wide ones: the side panel is
              ~340px, so a stacked score block pushed the KPI rings below the
              fold. The gauge's track is a fixed width, not `auto`: the gauge
              sizes itself from its container, so an intrinsic column would
              collapse it to its text. */}
          <div
            className="grid grid-cols-[minmax(0,1fr)_124px] items-center gap-3 bg-primary/7 px-4 py-3"
            data-home-kpi={t('home.winningScore')}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-primary-strong">
                <Trophy className="size-4" />
                <h2 className="text-xs font-semibold">
                  {t('home.winningScore')}
                </h2>
              </div>
              <div className="mt-2">
                {summary.profile.deltaSincePrevious === null ? (
                  <Badge variant="outline">{t('home.firstScore')}</Badge>
                ) : (
                  <Badge
                    variant={
                      summary.profile.deltaSincePrevious >= 0
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {t('home.sinceLast', {
                      delta: formatSigned(summary.profile.deltaSincePrevious),
                    })}
                  </Badge>
                )}
              </div>
            </div>
            <ScoreGauge label={t('home.winningScore')} score={score} />
          </div>
          <div className="grid grid-cols-3 border-t border-primary/10">
            {metrics.map((metric) => (
              <StatCard key={metric.label} {...metric} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function FocusActions({
  onNavigate,
  priorities,
}: {
  onNavigate: (section: AppSection) => void;
  priorities: ProfileRecommendation[];
}) {
  const { t } = useI18n();

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t('home.focusActions')}</CardTitle>
        <Badge variant="outline">
          {t('home.topCount', { count: Math.min(3, priorities.length) })}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1 p-2 pt-1">
        {priorities.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {t('home.refreshPriorities')}
          </p>
        ) : (
          priorities.slice(0, 3).map((priority, index) => (
            <button
              className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted"
              key={priority.id}
              onClick={() => onNavigate('profile')}
              type="button"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/8 text-[10px] font-bold text-primary-strong">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-snug">
                {priority.recommendation}
              </span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One KPI as a number. Sized to sit three across in a ~340px panel: the icon
 * shrinks to a marker above the value, since at this width a label-plus-value
 * row would wrap.
 */
function StatCard({
  hint,
  icon: Icon,
  label,
  value,
}: {
  hint: string;
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-col items-center border-l border-border/70 px-1.5 py-3 text-center first:border-l-0"
      data-home-kpi={label}
    >
      <Icon className="size-3.5 text-primary-strong" />
      <p className="mt-2 max-w-full break-words text-lg font-semibold leading-none tracking-[-0.025em] tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-medium leading-tight">{label}</p>
      <p className="mt-0.5 break-words text-[10px] leading-tight text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatDaysAgo(days: number | null, t: Translate): string {
  if (days === null) return t('home.notYet');
  if (days === 0) return t('home.today');
  return t('home.daysAgo', { count: days });
}
