'use client';

import { ExternalLink } from 'lucide-react';
import type { Dictionary } from '@/i18n/types';
import type { ApplicationCard } from '@/lib/application-kanban-data';

/**
 * The visible body of a board card. Kept free of drag machinery so it renders
 * under `renderToStaticMarkup` and stays testable.
 */
export function ApplicationCardContent({
  card,
  copy,
  locale,
}: {
  card: ApplicationCard;
  copy: Dictionary['applications']['board'];
  locale: string;
}) {
  // sentAt is null until the application leaves `in-progress`; fall back to the
  // enrolment date rather than formatting null.
  const dateLabel = card.sentAt ? copy.sent : copy.enrolled;
  const dateValue = card.sentAt ?? card.createdAt;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="line-clamp-2 text-sm font-medium leading-5">{card.name}</p>

      <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <dt>{copy.matchScore}</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {card.matchScore}
          </dd>
        </div>
        {card.connectsSpent === null ? null : (
          <div className="flex items-center gap-1">
            <dt>{copy.connects}</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {card.connectsSpent}
            </dd>
          </div>
        )}
        <div className="flex items-center gap-1">
          <dt>{dateLabel}</dt>
          <dd className="tabular-nums">{formatDate(dateValue, locale)}</dd>
        </div>
      </dl>

      <a
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-[var(--dashboard-accent)]"
        href={card.jobUrl}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
      >
        {copy.openJob}
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}
