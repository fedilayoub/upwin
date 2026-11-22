'use client';

import { ExternalLink } from 'lucide-react';
import { ProposalStatusSelect } from '@/components/applications/proposal-status-select';
import type { MoveApplication } from '@/components/applications/application-kanban';
import type { Dictionary } from '@/i18n/types';
import type { ApplicationCard } from '@/lib/application-kanban-data';

const LABELLED_CELL =
  'max-md:grid max-md:grid-cols-[6.5rem_minmax(0,1fr)] max-md:items-center max-md:gap-3 max-md:p-0 max-md:before:text-xs max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]';

/** The same cards as the board, as rows. Status saves on change. */
export function ApplicationTable({
  cards,
  copy,
  locale,
  moveApplication,
  statusLabels,
}: {
  cards: readonly ApplicationCard[];
  copy: Dictionary['applications'];
  locale: string;
  moveApplication: MoveApplication;
  statusLabels: Dictionary['dashboard']['outcomeStatuses'];
}) {
  const rows = [...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div className="min-w-0 border border-dashed bg-card px-4 py-2 max-md:border-0 max-md:bg-transparent max-md:p-0">
      <table className="w-full table-fixed text-left text-sm max-md:block">
        <colgroup className="max-md:hidden">
          <col className="w-[46%]" />
          <col className="w-[14%]" />
          <col className="w-[22%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead className="border-b text-xs text-muted-foreground max-md:hidden">
          <tr>
            <th className="py-3 pr-4 font-medium">{copy.table.job}</th>
            <th className="py-3 pr-4 font-medium whitespace-nowrap">{copy.table.matchScore}</th>
            <th className="py-3 pr-4 font-medium">{copy.table.status}</th>
            <th className="py-3 font-medium">{copy.table.date}</th>
          </tr>
        </thead>
        <tbody className="divide-y max-md:grid max-md:gap-3 max-md:divide-y-0">
          {rows.map((card) => (
            <tr
              className="max-md:grid max-md:gap-3 max-md:border max-md:border-dashed max-md:bg-muted/20 max-md:p-4"
              key={card.id}
            >
              <td
                className={`min-w-0 py-3 pr-4 font-medium ${LABELLED_CELL}`}
                data-label={copy.table.job}
              >
                <a
                  className="flex min-w-0 max-w-full items-center gap-1 hover:text-[var(--dashboard-accent)]"
                  href={card.jobUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="block min-w-0 truncate">{card.name}</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </td>
              <td
                className={`py-3 pr-4 whitespace-nowrap tabular-nums ${LABELLED_CELL}`}
                data-label={copy.table.matchScore}
              >
                {card.matchScore}/100
              </td>
              <td
                className={`min-w-0 py-3 pr-4 ${LABELLED_CELL}`}
                data-label={copy.table.status}
              >
                <ProposalStatusSelect
                  ariaLabel={`${copy.table.status}: ${card.name}`}
                  initialStatus={card.column}
                  messages={copy.messages}
                  outcomeStatuses={statusLabels}
                  saveStatus={(formData) =>
                    moveApplication(card.jobAnalysisId, formData)
                  }
                />
              </td>
              <td
                className={`py-3 whitespace-nowrap tabular-nums ${LABELLED_CELL}`}
                data-label={copy.table.date}
              >
                {/* sentAt stays null until the proposal leaves in-progress. */}
                <span className="text-muted-foreground">
                  {card.sentAt ? copy.board.sent : copy.board.enrolled}
                </span>{' '}
                {dateFormat.format(new Date(card.sentAt ?? card.createdAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
