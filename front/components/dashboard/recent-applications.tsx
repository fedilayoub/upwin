import { ExternalLink } from 'lucide-react';
import { ProposalStatusSelect } from '@/components/applications/proposal-status-select';
import type { Dictionary } from '@/i18n/types';
import type { ProposalOutcomeListItem } from '@/lib/api';
import type { FormActionState } from '@/lib/form-action-state';

export type SaveProposalOutcome = (
  locale: string,
  jobAnalysisId: string,
  formData: FormData,
) => Promise<FormActionState>;

export function RecentApplications({
  copy,
  items,
  locale,
  outcomeStatuses,
  saveOutcomeAction,
}: {
  copy: Dictionary['dashboard']['applications'];
  items: ProposalOutcomeListItem[];
  locale: string;
  outcomeStatuses: Dictionary['dashboard']['outcomeStatuses'];
  saveOutcomeAction: SaveProposalOutcome;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.empty}</p>;
  }

  return (
    <div className="min-w-0">
      <table className="w-full table-fixed text-left text-sm max-lg:block">
        <colgroup className="max-lg:hidden">
          <col className="w-[44%]" />
          <col className="w-[14%]" />
          <col className="w-[26%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="border-b text-xs text-muted-foreground max-lg:hidden">
          <tr>
            <th className="pb-3 font-medium">{copy.job}</th>
            <th className="pb-3 pr-4 font-medium whitespace-nowrap">{copy.matchScore}</th>
            <th className="pb-3 font-medium">{copy.status}</th>
            <th className="pb-3 font-medium">{copy.sentDate}</th>
          </tr>
        </thead>
        <tbody className="divide-y max-lg:grid max-lg:gap-3 max-lg:divide-y-0">
          {items.map((item) => (
            <tr
              className="max-lg:grid max-lg:gap-3 max-lg:border max-lg:border-dashed max-lg:bg-muted/20 max-lg:p-4"
              key={item.id}
            >
              <td
                className="min-w-0 overflow-hidden py-3 pr-4 font-medium max-lg:grid max-lg:max-w-none max-lg:grid-cols-[6.5rem_minmax(0,1fr)] max-lg:items-start max-lg:gap-3 max-lg:overflow-visible max-lg:p-0 max-lg:before:text-xs max-lg:before:font-medium max-lg:before:text-muted-foreground max-lg:before:content-[attr(data-label)]"
                data-label={copy.job}
              >
                <a
                  className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden hover:text-[var(--dashboard-accent)]"
                  href={item.jobUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="block min-w-0 truncate">{item.jobTitle}</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </td>
              <td
                className="py-3 pr-4 whitespace-nowrap tabular-nums max-lg:grid max-lg:grid-cols-[6.5rem_minmax(0,1fr)] max-lg:gap-3 max-lg:p-0 max-lg:before:text-xs max-lg:before:font-medium max-lg:before:text-muted-foreground max-lg:before:content-[attr(data-label)]"
                data-label={copy.matchScore}
              >
                {item.matchScore}/100
              </td>
              <td
                className="min-w-0 py-3 pr-4 max-lg:grid max-lg:grid-cols-[6.5rem_minmax(0,1fr)] max-lg:items-center max-lg:gap-3 max-lg:p-0 max-lg:before:text-xs max-lg:before:font-medium max-lg:before:text-muted-foreground max-lg:before:content-[attr(data-label)]"
                data-label={copy.status}
              >
                <ProposalStatusSelect
                  ariaLabel={`${copy.status}: ${item.jobTitle}`}
                  initialStatus={item.status}
                  messages={copy.messages}
                  outcomeStatuses={outcomeStatuses}
                  saveStatus={saveOutcomeAction.bind(
                    null,
                    locale,
                    item.jobAnalysisId,
                  )}
                />
              </td>
              <td
                className="py-3 whitespace-nowrap tabular-nums max-lg:grid max-lg:grid-cols-[6.5rem_minmax(0,1fr)] max-lg:gap-3 max-lg:p-0 max-lg:before:text-xs max-lg:before:font-medium max-lg:before:text-muted-foreground max-lg:before:content-[attr(data-label)]"
                data-label={copy.sentDate}
              >
                {item.sentAt
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                    }).format(new Date(item.sentAt))
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
