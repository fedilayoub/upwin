import Link from 'next/link';
import { ActivityHeatmap } from '@/components/dashboard/activity-heatmap';
import { FunnelBars } from '@/components/dashboard/funnel-bars';
import { KpiTile } from '@/components/dashboard/kpi-tile';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { RecentApplications } from '@/components/dashboard/recent-applications';
import type { SaveProposalOutcome } from '@/components/dashboard/recent-applications';
import { ScoreTrendChart } from '@/components/dashboard/score-trend-chart';
import { SectionMovement } from '@/components/dashboard/section-movement';
import { SetupChecklist } from '@/components/dashboard/setup-checklist';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StarBorder } from '@/components/ui/star-border';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import {
  FUNNEL_WINDOWS,
  type InsightsActivity,
  type InsightsFunnel,
  type InsightsScoreHistory,
  type InsightsSummary,
  type ProposalOutcomesPage,
} from '@/lib/api';
import { buildSetupSteps, isSetupComplete, type SetupContextState } from '@/lib/setup-checklist';
import { cn } from '@/lib/utils';

export function DashboardContent({
  activity,
  contextState,
  copy,
  funnel,
  goalLabels,
  history,
  locale,
  outcomes,
  saveOutcomeAction,
  summary,
}: {
  activity: InsightsActivity;
  /** Whether the freelancer's details exist and are confirmed; drives the setup checklist. */
  contextState: SetupContextState;
  copy: Dictionary['dashboard'];
  funnel: InsightsFunnel;
  goalLabels: Dictionary['goals']['objectives'];
  history: InsightsScoreHistory;
  locale: Locale;
  outcomes: ProposalOutcomesPage;
  saveOutcomeAction: SaveProposalOutcome;
  summary: InsightsSummary;
}) {
  const setupProgress = {
    context: contextState,
    hasActiveGoal: summary.profile.activeGoal !== null,
    hasAnalysis: summary.profile.analysesCount > 0,
  };

  // No analysis yet: the checklist is the whole dashboard, and the tour's
  // "first analysis" step points at it.
  if (!setupProgress.hasAnalysis) {
    return <SetupChecklist copy={copy.setup} locale={locale} progress={setupProgress} tourTarget />;
  }

  // An analysis exists but the goal or the details have since gone missing.
  // The extension will refuse the next analysis, so say why here.
  const setupIncomplete = !isSetupComplete(buildSetupSteps(setupProgress));

  const percent = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    style: 'percent',
  });
  // Zero applications is not a zero reply rate. `0 of 0 replied` reads as a
  // measured result when nothing has been measured, so suppress it entirely —
  // the contract's own rule that null, zero, and empty are three states.
  const hasSentApplications = summary.outcomes.sent > 0;
  const replyValue = !hasSentApplications
    ? copy.kpis.noScore
    : summary.outcomes.sufficientData && summary.outcomes.replyRate !== null
      ? percent.format(summary.outcomes.replyRate)
      : fill(copy.kpis.replyFraction, {
          replied: summary.outcomes.replied,
          sent: summary.outcomes.sent,
        });
  const replyHint = !hasSentApplications
    ? copy.kpis.replyEmpty
    : summary.outcomes.sufficientData
      ? undefined
      : fill(copy.kpis.minimumSample, {
          minimum: summary.outcomes.minimumSample,
        });

  return (
    <div className="space-y-5 sm:space-y-6" data-dashboard-grid>
      {setupIncomplete ? (
        <SetupChecklist copy={copy.setup} locale={locale} progress={setupProgress} />
      ) : null}
      <StarBorder as="section" className="grid bg-card lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]" data-tour="analysis">
        <KpiTile
          featured
          delta={summary.profile.deltaSincePrevious}
          hint={
            summary.profile.activeGoal
              ? fill(copy.kpis.activeGoal, {
                  goal: goalLabels[summary.profile.activeGoal.objective],
                })
              : undefined
          }
          label={copy.kpis.winningScore}
          value={summary.profile.latestWinningScore ?? copy.kpis.noScore}
        />
        <div className="grid border-t border-dashed sm:grid-cols-2 lg:border-t-0 lg:border-l xl:grid-cols-3">
          <KpiTile
            className="border-b border-dashed sm:border-r"
            hint={fill(copy.kpis.analysesLast30Days, {
              count: summary.profile.analysesLast30Days,
            })}
            label={copy.kpis.profileAnalyses}
            value={summary.profile.analysesCount}
          />
          <KpiTile
            className="border-b border-dashed xl:border-r"
            hint={fill(copy.kpis.jobsLast30Days, {
              count: summary.jobs.analysesLast30Days,
            })}
            label={copy.kpis.jobsAnalyzed}
            value={summary.jobs.analysesCount}
          />
          <KpiTile
            className="border-b border-dashed sm:border-r xl:border-r-0"
            hint={fill(copy.kpis.highFitThreshold, {
              threshold: summary.jobs.highFitThreshold,
            })}
            label={copy.kpis.highFitJobs}
            value={`${summary.jobs.highFitCount} / ${percent.format(summary.jobs.highFitShare)}`}
          />
          <KpiTile
            className="border-b border-dashed xl:border-b-0 xl:border-r"
            hint={fill(copy.kpis.proposalsLast30Days, {
              count: summary.proposals.draftedLast30Days,
            })}
            label={copy.kpis.proposalsDrafted}
            value={summary.proposals.draftedCount}
          />
          <KpiTile
            className="sm:col-span-2 xl:col-span-2"
            hint={replyHint}
            label={copy.kpis.replyRate}
            value={replyValue}
          />
        </div>
      </StarBorder>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <DashboardCard
          description={copy.scoreTrend.description}
          title={copy.scoreTrend.title}
        >
          <ScoreTrendChart
            copy={copy.scoreTrend}
            goalLabels={goalLabels}
            history={history}
            locale={locale}
          />
        </DashboardCard>

        <DashboardCard
          description={`${copy.activity.description} ${fill(copy.activity.timeZone, {
            timeZone: activity.timeZone,
          })}`}
          title={copy.activity.title}
          className="flex flex-col"
          contentClassName="flex-1"
        >
          <ActivityHeatmap activity={activity} copy={copy.activity} locale={locale} />
        </DashboardCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <DashboardCard description={copy.funnel.description} title={copy.funnel.title}>
          <nav aria-label={copy.funnel.title} className="mb-5 flex flex-wrap gap-2">
            {FUNNEL_WINDOWS.map((window) => (
              <Link
                aria-current={funnel.window === window ? 'page' : undefined}
                className={
                  funnel.window === window
                    ? 'rounded-lg bg-[var(--dashboard-accent)] px-3 py-1.5 text-xs font-medium text-[var(--dashboard-accent-foreground)]'
                    : 'rounded-lg border border-border/80 px-3 py-1.5 text-xs font-medium hover:bg-muted'
                }
                href={`/${locale}?window=${window}`}
                key={window}
              >
                {copy.funnel.windows[window]}
              </Link>
            ))}
          </nav>
          <FunnelBars copy={copy.funnel} funnel={funnel} />
        </DashboardCard>

        <DashboardCard description={copy.sections.description} title={copy.sections.title}>
          <SectionMovement copy={copy.sections} sectionDeltas={history.sectionDeltas} />
        </DashboardCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <DashboardCard
          description={copy.applications.description}
          title={copy.applications.title}
        >
          <RecentApplications
            copy={copy.applications}
            items={outcomes.items}
            locale={locale}
            outcomeStatuses={copy.outcomeStatuses}
            saveOutcomeAction={saveOutcomeAction}
          />
        </DashboardCard>
        <DashboardCard
          description={copy.recentActivity.description}
          title={copy.recentActivity.title}
        >
          <RecentActivity
            copy={copy.recentActivity}
            items={summary.recentActivity}
            locale={locale}
            outcomeStatuses={copy.outcomeStatuses}
          />
        </DashboardCard>
      </section>
    </div>
  );
}

function DashboardCard({
  children,
  className,
  contentClassName,
  description,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  description: string;
  title: string;
}) {
  return (
    <StarBorder
      className={cn(
        'min-w-0 bg-card text-card-foreground',
        className,
      )}
    >
      <CardHeader className="space-y-1 px-5 pt-5 sm:px-6 sm:pt-6">
        <CardTitle className="text-base font-semibold tracking-[-0.015em] sm:text-lg">
          {title}
        </CardTitle>
        <CardDescription className="max-w-2xl text-xs leading-5 sm:text-sm">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn('px-5 pb-5 sm:px-6 sm:pb-6', contentClassName)}>
        {children}
      </CardContent>
    </StarBorder>
  );
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}
