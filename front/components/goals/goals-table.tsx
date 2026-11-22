import { GoalIcon } from '@/components/goals/goal-icon';
import { GoalEditorSheet } from '@/components/goals/goal-editor-sheet';
import { GoalTableRow } from '@/components/goals/goal-table-row';
import { StarBorder } from '@/components/ui/star-border';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { GoalConfiguration } from '@/lib/api';

export function GoalsTable({
  copy,
  goals,
  locale,
}: {
  copy: Dictionary['goals'];
  goals: GoalConfiguration[];
  locale: Locale;
}) {
  return (
    <StarBorder as="section" className="bg-card">
      <div className="flex items-center justify-between gap-4 border-b border-dashed px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-semibold tracking-[-0.015em]">
            {copy.savedGoalsTitle}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {copy.tableDescription}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
            {goals.length}
          </span>
          <GoalEditorSheet copy={copy} locale={locale} />
        </div>
      </div>

      <Table className="min-w-[880px]">
        <TableHeader className="bg-muted/35">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[29%] px-5 text-xs text-muted-foreground sm:px-6">
              {copy.columns.goal}
            </TableHead>
            <TableHead className="w-[24%] text-xs text-muted-foreground">
              {copy.columns.targetWork}
            </TableHead>
            <TableHead className="w-[14%] text-xs text-muted-foreground">
              {copy.columns.hourlyRate}
            </TableHead>
            <TableHead className="w-[12%] text-xs text-muted-foreground">
              {copy.columns.status}
            </TableHead>
            <TableHead className="w-[11%] text-xs text-muted-foreground">
              {copy.columns.updated}
            </TableHead>
            <TableHead className="w-[10%] px-5 text-right text-xs text-muted-foreground sm:px-6">
              {copy.columns.actions}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {goals.length === 0 ? (
            <TableRow>
              <TableCell className="h-72 px-6 text-center" colSpan={6}>
                <div className="mx-auto flex max-w-sm flex-col items-center">
                  <StarBorder
                    aria-hidden="true"
                    as="span"
                    className="mb-4 grid size-11 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
                  >
                    <GoalIcon className="size-full" />
                  </StarBorder>
                  <p className="font-medium">{copy.createTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {copy.noActive}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            goals.map((goal) => (
              <GoalTableRow copy={copy} goal={goal} key={goal.id} locale={locale} />
            ))
          )}
        </TableBody>
      </Table>
    </StarBorder>
  );
}
