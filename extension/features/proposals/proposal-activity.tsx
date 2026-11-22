import { useCallback, useEffect } from 'react';
import {
  ActivityHeatmap,
  ActivityLegend,
} from '@/components/charts/activity-heatmap';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useConnection } from '@/features/connection/connection-context';
import { useI18n } from '@/features/i18n/i18n-context';
import { buildCalendarWeeks } from '@/features/insights/build-calendar-weeks';
import { useAsyncAction } from '@/hooks/use-async-action';
import { insightsService } from '@/services/insights';
import type { ActivityCalendar } from '@/types/insights';

/**
 * The endpoint returns 12 months. The panel renders the trailing 26 weeks
 * because 53 columns of day cells in ~336px is illegible — at 9px cells that is
 * 309px of grid, the familiar contribution-graph size. Slicing a calendar to fit
 * its container is layout, not aggregation; the full year is on the dashboard.
 */
export const ACTIVITY_WEEKS = 26;

/** The Draft tab's record of drafting: it loads its own calendar. */
export function ProposalActivity() {
  const { getToken } = useConnection();
  const load = useCallback(
    () => insightsService.getActivity(getToken),
    [getToken],
  );
  const request = useAsyncAction(load, { operation: 'proposal.activity' });

  useEffect(() => {
    if (request.status === 'idle') void request.execute();
  }, [request.execute, request.status]);

  // A secondary card: on failure it steps aside (the failure is still reported)
  // instead of putting an error under the drafting controls.
  if (request.status === 'error') return null;
  if (!request.data) return <Skeleton className="h-44 rounded-2xl" />;
  return <ProposalActivityCard activity={request.data} />;
}

export function ProposalActivityCard({
  activity,
}: {
  activity: ActivityCalendar;
}) {
  const { t } = useI18n();
  const weeks = buildCalendarWeeks(
    activity.days,
    activity.from,
    activity.to,
  ).slice(-ACTIVITY_WEEKS);
  return (
    // Container query, not a viewport one: what matters is the card's width.
    <Card
      className="@container rounded-2xl border-border/70"
      data-proposal-activity
    >
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t('proposal.activity.title')}</CardTitle>
        <Badge variant="outline">{t('proposal.activity.sixMonths')}</Badge>
      </CardHeader>
      <CardContent>
        {/* Past ~480px of card the totals move alongside the grid. The grid
            track is capped so cells stop growing once they are comfortably
            readable — the leftover width goes to the copy, not to 20px
            squares. */}
        <div className="grid gap-x-5 gap-y-3 @[480px]:grid-cols-[minmax(252px,420px)_minmax(150px,1fr)] @[480px]:items-start">
          <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1">
            <ActivityHeatmap
              className="min-w-[252px] max-w-[420px]"
              weeks={weeks}
            />
          </div>
          <div className="min-w-0">
            <div className="grid gap-1 text-xs leading-5 text-muted-foreground min-[390px]:grid-cols-2 @[480px]:grid-cols-1">
              {/* The grid shows 26 weeks but this total covers the endpoint's
                  full 12 months. Say so — re-summing the visible days
                  client-side would be aggregation, which belongs in the
                  backend. */}
              <span>
                {t('proposal.activity.drafted', {
                  count: activity.totals.drafted,
                })}
              </span>
              <span className="min-[390px]:text-right @[480px]:text-left">
                {t('proposal.activity.streak', {
                  best: activity.longestStreakWeeks,
                  current: activity.currentStreakWeeks,
                })}
              </span>
            </div>
            <ActivityLegend className="mt-2 text-[11px] text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
