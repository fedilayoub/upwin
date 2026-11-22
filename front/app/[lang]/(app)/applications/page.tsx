import { KanbanSquare } from 'lucide-react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ApplicationKanban } from '@/components/applications/application-kanban';
import { ApplicationsEmptyState } from '@/components/applications/applications-empty-state';
import { ApplicationStatsBar } from '@/components/applications/application-stats';
import { ApplicationTable } from '@/components/applications/application-table';
import { ApplicationViewToggle } from '@/components/applications/application-view-toggle';
import { StarBorder } from '@/components/ui/star-border';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale } from '@/i18n/config';
import { FUNNEL_WINDOWS, type ProposalOutcomeStatus } from '@/lib/api';
import { getBackendApiClient } from '@/lib/api/server';
import { BOARD_LANES } from '@/lib/application-flow';
import { toApplicationCards } from '@/lib/application-kanban-data';
import {
  APPLICATION_VIEW_COOKIE,
  APPLICATION_VIEWS,
  DEFAULT_APPLICATION_VIEW,
  type ApplicationView,
} from '@/lib/application-view';
import { moveApplicationAction } from '@/app/[lang]/(app)/applications/actions';

/** Per-lane page size. The backend caps `pageSize` at 100. */
const LANE_PAGE_SIZE = 50;

export default async function ApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    window?: string | string[];
    view?: string | string[];
  }>;
}) {
  const [{ lang }, query, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);
  if (!isLocale(lang)) notFound();

  const window = memberOf(first(query.window), FUNNEL_WINDOWS) ?? '30d';
  // The URL wins so a link opens the view it names; the cookie remembers the
  // last pick for a bare /applications.
  const view =
    memberOf(first(query.view), APPLICATION_VIEWS) ??
    memberOf(cookieStore.get(APPLICATION_VIEW_COOKIE)?.value, APPLICATION_VIEWS) ??
    DEFAULT_APPLICATION_VIEW;
  const viewHrefs = Object.fromEntries(
    APPLICATION_VIEWS.map((option) => [
      option,
      `/${lang}/applications?${new URLSearchParams({ window, view: option }).toString()}`,
    ]),
  ) as Record<ApplicationView, string>;

  const [dictionary, api] = await Promise.all([
    getDictionary(lang),
    getBackendApiClient(),
  ]);
  const copy = dictionary.applications;

  // One request per lane, so each card arrives already in the column its stored
  // status names. A revisit therefore rebuilds the board from the server, not
  // from anything the browser kept.
  const [stats, ...lanePages] = await Promise.all([
    api.getApplicationStats(window),
    ...BOARD_LANES.map((status) =>
      api.listProposalOutcomes({
        status: [status],
        pageSize: LANE_PAGE_SIZE,
      }),
    ),
  ]);

  const cards = toApplicationCards(
    lanePages.flatMap((page) => page?.items ?? []),
  );
  const truncatedLanes = BOARD_LANES.filter(
    (_status, index) => lanePages[index]?.hasMore ?? false,
  );

  const moveApplication = moveApplicationAction.bind(null, lang);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-10 pt-2 sm:pt-4">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <StarBorder
            aria-hidden="true"
            as="span"
            className="grid size-9 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
          >
            <KanbanSquare className="size-[18px]" strokeWidth={2} />
          </StarBorder>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-[1.75rem]">
            {copy.title}
          </h1>
          {cards.length === 0 ? null : (
            <div className="ml-auto">
              <ApplicationViewToggle
                copy={copy.view}
                current={view}
                hrefFor={viewHrefs}
              />
            </div>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {copy.description}
        </p>
      </header>

      {/* Gate on the loaded cards, not stats.total: stats are windowed by
          createdAt, so older applications would otherwise hide the board. */}
      {cards.length === 0 ? (
        <ApplicationsEmptyState copy={copy.empty} />
      ) : (
        <>
          <ApplicationStatsBar
            copy={copy.stats}
            locale={lang}
            stats={stats}
            view={view}
          />
          {view === 'table' ? (
            <ApplicationTable
              cards={cards}
              copy={copy}
              locale={lang}
              moveApplication={moveApplication}
              statusLabels={dictionary.dashboard.outcomeStatuses}
            />
          ) : (
            <ApplicationKanban
              copy={copy}
              initialCards={cards}
              locale={lang}
              moveApplication={moveApplication}
              statusLabels={dictionary.dashboard.outcomeStatuses}
              truncatedLanes={truncatedLanes as ProposalOutcomeStatus[]}
            />
          )}
        </>
      )}
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function memberOf<const Values extends readonly string[]>(
  value: string | undefined,
  values: Values,
): Values[number] | undefined {
  return values.find((candidate) => candidate === value);
}
