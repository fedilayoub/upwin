import { Badge } from '@/components/ui/badge';
import type { Dictionary } from '@/i18n/types';
import type { RecentActivityItem } from '@/lib/api/types';

export function RecentActivity({
  copy,
  items,
  locale,
  outcomeStatuses,
}: {
  copy: Dictionary['dashboard']['recentActivity'];
  items: RecentActivityItem[];
  locale: string;
  outcomeStatuses: Dictionary['dashboard']['outcomeStatuses'];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.empty}</p>;
  }

  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li className="flex min-w-0 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={`${item.kind}-${item.id}`}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {copy.kinds[item.kind]} ·{' '}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(item.occurredAt))}
            </p>
          </div>
          <div className="flex shrink-0 justify-end">
            {item.score !== null ? (
              <Badge className="tabular-nums" variant="secondary">
                {item.score}/100
              </Badge>
            ) : item.kind === 'proposal-outcome' ? (
              <Badge variant="outline">{outcomeStatuses[item.status]}</Badge>
            ) : (
              <Badge className="text-muted-foreground" variant="outline">
                {copy.notScored}
              </Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
