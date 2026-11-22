import { ChartNoAxesCombined } from 'lucide-react';
import { notFound } from 'next/navigation';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { StarBorder } from '@/components/ui/star-border';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale } from '@/i18n/config';
import { FUNNEL_WINDOWS } from '@/lib/api';
import { getBackendApiClient } from '@/lib/api/server';
import { setupContextState } from '@/lib/setup-checklist';
import { saveProposalOutcomeAction } from '@/app/[lang]/(app)/actions';

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ window?: string | string[] }>;
}) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(lang)) notFound();

  const requestedWindow = Array.isArray(query.window)
    ? query.window[0]
    : query.window;
  const funnelWindow = memberOf(requestedWindow, FUNNEL_WINDOWS) ?? 'all';
  // The web app runs on the freelancer's own machine, so its time zone is theirs.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [dictionary, api] = await Promise.all([
    getDictionary(lang),
    getBackendApiClient(),
  ]);
  const [summary, activity, history, funnel, outcomes, context] = await Promise.all([
    api.getInsightsSummary(),
    api.getInsightsActivity(timeZone),
    api.getInsightsScoreHistory(),
    api.getInsightsFunnel(funnelWindow),
    api.listProposalOutcomes({ pageSize: 20 }),
    api.getFreelancerContext(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StarBorder
              aria-hidden="true"
              as="span"
              className="grid size-9 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
            >
              <ChartNoAxesCombined className="size-[18px]" strokeWidth={2} />
            </StarBorder>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-[1.75rem]">
            {dictionary.dashboard.title}
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {dictionary.dashboard.description}
          </p>
        </div>
      </header>

      <DashboardContent
        activity={activity}
        contextState={setupContextState(context)}
        copy={dictionary.dashboard}
        funnel={funnel}
        goalLabels={dictionary.goals.objectives}
        history={history}
        locale={lang}
        outcomes={outcomes}
        saveOutcomeAction={saveProposalOutcomeAction}
        summary={summary}
      />
    </div>
  );
}

function memberOf<const Values extends readonly string[]>(
  value: string | undefined,
  values: Values,
): Values[number] | undefined {
  return values.find((candidate) => candidate === value);
}
