'use client';

import { KanbanSquare, Rows3 } from 'lucide-react';
import Link from 'next/link';
import type { Dictionary } from '@/i18n/types';
import {
  APPLICATION_VIEW_COOKIE,
  APPLICATION_VIEWS,
  type ApplicationView,
} from '@/lib/application-view';

const ICONS: Record<ApplicationView, typeof KanbanSquare> = {
  board: KanbanSquare,
  table: Rows3,
};

/** One year: a layout preference, nothing sensitive. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function remember(view: ApplicationView) {
  document.cookie = `${APPLICATION_VIEW_COOKIE}=${view}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function ApplicationViewToggle({
  copy,
  current,
  hrefFor,
}: {
  copy: Dictionary['applications']['view'];
  current: ApplicationView;
  hrefFor: Record<ApplicationView, string>;
}) {
  return (
    <nav
      aria-label={copy.label}
      className="flex shrink-0 items-center gap-1 border border-border/70 bg-muted/50 p-1"
    >
      {APPLICATION_VIEWS.map((view) => {
        const Icon = ICONS[view];
        const active = view === current;
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm'
                : 'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'
            }
            href={hrefFor[view]}
            key={view}
            onClick={() => remember(view)}
            scroll={false}
          >
            <Icon aria-hidden="true" className="size-4" />
            {copy[view]}
          </Link>
        );
      })}
    </nav>
  );
}
