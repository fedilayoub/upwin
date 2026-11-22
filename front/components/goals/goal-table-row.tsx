'use client';

import { Check } from 'lucide-react';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { GoalActionsMenu } from '@/components/goals/goal-actions-menu';
import { GoalEditorSheet } from '@/components/goals/goal-editor-sheet';
import { GoalIcon } from '@/components/goals/goal-icon';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { GoalConfiguration, GoalRateRange } from '@/lib/api';

/**
 * Clicking anywhere on the row opens the goal's editor sheet. Clicks on the
 * row's own controls (the actions menu trigger) are left alone, and so are
 * events that only bubble here through React portals — the dropdown items,
 * the delete dialog, and the sheet itself are not DOM descendants of the row.
 */
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="menuitem"]';

export function GoalTableRow({
  copy,
  goal,
  locale,
}: {
  copy: Dictionary['goals'];
  goal: GoalConfiguration;
  locale: Locale;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const visibleProjectTypes = goal.targetProjectTypes.slice(0, 2);
  const remainingProjectTypes = goal.targetProjectTypes.length - visibleProjectTypes.length;

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!event.currentTarget.contains(target)) return;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    setEditorOpen(true);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setEditorOpen(true);
  }

  return (
    <>
      <TableRow
        className={
          goal.isActive
            ? 'cursor-pointer bg-[var(--dashboard-accent-soft)]/55 hover:bg-[var(--dashboard-accent-soft)]/75'
            : 'cursor-pointer hover:bg-muted/30'
        }
        data-active={goal.isActive ? 'true' : undefined}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
        tabIndex={0}
      >
        <TableCell className="px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className={
                goal.isActive
                  ? 'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--dashboard-accent)] text-[var(--dashboard-accent-foreground)]'
                  : 'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border/80 bg-background text-muted-foreground'
              }
            >
              <GoalIcon className="size-full" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium tracking-[-0.01em]">{goal.targetRole}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {copy.objectives[goal.objective]}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex max-w-64 flex-wrap gap-1.5">
            {visibleProjectTypes.map((projectType) => (
              <Badge
                className="max-w-40 rounded-md bg-background font-normal text-muted-foreground"
                key={projectType}
                variant="outline"
              >
                <span className="truncate">{projectType}</span>
              </Badge>
            ))}
            {remainingProjectTypes > 0 ? (
              <Badge className="rounded-md font-normal text-muted-foreground" variant="secondary">
                +{remainingProjectTypes}
              </Badge>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="font-medium tabular-nums">
          {formatRate(goal.targetRate, locale)}
        </TableCell>
        <TableCell>
          {goal.isActive ? (
            <Badge className="rounded-md border-0 bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]">
              <Check />
              {copy.activeBadge}
            </Badge>
          ) : (
            <Badge className="rounded-md font-normal text-muted-foreground" variant="outline">
              {copy.inactiveBadge}
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-xs tabular-nums text-muted-foreground">
          {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
            new Date(goal.updatedAt),
          )}
        </TableCell>
        <TableCell className="px-5 sm:px-6">
          <div className="flex justify-end">
            <GoalActionsMenu
              copy={copy}
              goal={goal}
              locale={locale}
              onEdit={() => setEditorOpen(true)}
            />
          </div>
        </TableCell>
      </TableRow>

      <GoalEditorSheet
        copy={copy}
        goal={goal}
        locale={locale}
        onOpenChange={setEditorOpen}
        open={editorOpen}
        showTrigger={false}
      />
    </>
  );
}

function formatRate(rate: GoalRateRange | null, locale: Locale): string {
  if (!rate || (rate.min === undefined && rate.max === undefined)) return '—';

  const formatter = new Intl.NumberFormat(locale, {
    currency: 'USD',
    maximumFractionDigits: 0,
    style: 'currency',
  });
  if (rate.min !== undefined && rate.max !== undefined) {
    return `${formatter.format(rate.min)}–${formatter.format(rate.max)}`;
  }
  if (rate.min !== undefined) return `${formatter.format(rate.min)}+`;
  return `≤${formatter.format(rate.max ?? 0)}`;
}
