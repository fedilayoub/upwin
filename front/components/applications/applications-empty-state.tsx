import { KanbanSquare } from 'lucide-react';
import { StarBorder } from '@/components/ui/star-border';
import type { Dictionary } from '@/i18n/types';

/**
 * Replaces the whole board at zero tracked applications. A new user must not
 * land on eight empty columns.
 */
export function ApplicationsEmptyState({
  copy,
}: {
  copy: Dictionary['applications']['empty'];
}) {
  return (
    <StarBorder as="article" className="flex flex-col items-start gap-3 bg-card p-6 sm:p-8">
      <StarBorder
        aria-hidden="true"
        as="span"
        className="grid size-10 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
      >
        <KanbanSquare className="size-5" strokeWidth={2} />
      </StarBorder>
      <h2 className="text-lg font-semibold tracking-[-0.02em]">{copy.title}</h2>
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        {copy.description}
      </p>
    </StarBorder>
  );
}
