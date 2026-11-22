import { Hardware } from '@/components/ui/hardware/hardware';
import { ApplicationWindowControl } from './application-window-control';
import type { ApplicationStats } from '@/lib/api';
import type { Dictionary } from '@/i18n/types';
import type { ApplicationView } from '@/lib/application-view';

/**
 * A hardware panel with a period selector beside the server counts. Every
 * number arrives computed — `applied` in particular filters
 * `sentAt` while `counts` partitions `createdAt`, so it is not derivable here.
 */
export function ApplicationStatsBar({
  copy,
  locale,
  stats,
  view,
}: {
  copy: Dictionary['applications']['stats'];
  locale: string;
  stats: ApplicationStats;
  /** Carried through period changes so switching period keeps the layout. */
  view?: ApplicationView;
}) {
  const figures = [
    { key: 'applied', label: copy.applied, value: stats.applied },
    { key: 'viewed', label: copy.viewed, value: stats.counts.viewed },
    { key: 'messaged', label: copy.messaged, value: stats.counts.messaged },
    {
      key: 'interviewing',
      label: copy.interviewing,
      value: stats.counts.interviewing,
    },
    { key: 'hired', label: copy.hired, value: stats.counts.hired },
    {
      key: 'no-response',
      label: copy.noResponse,
      value: stats.counts['no-response'],
    },
  ];

  return (
    <Hardware className="hardware-stats hardware-stats-bar grid gap-3 rounded-lg px-4 py-2 lg:grid-cols-[minmax(0,1fr)_248px] lg:items-center">
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {figures.map((figure) => (
          <div className="flex items-baseline gap-2" key={figure.key}>
            <dd className="text-lg font-semibold tabular-nums">
              {figure.value}
            </dd>
            <dt data-hardware="muted" className="text-xs">
              {figure.label}
            </dt>
          </div>
        ))}
      </dl>

      <div className="w-full max-w-[248px]">
        <ApplicationWindowControl
          copy={copy}
          locale={locale}
          value={stats.window}
          view={view}
        />
      </div>
    </Hardware>
  );
}
