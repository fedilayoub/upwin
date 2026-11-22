import { Check } from 'lucide-react';
import { StarBorder } from '@/components/ui/star-border';
import type { Dictionary } from '@/i18n/types';
import { cn } from '@/lib/utils';

export type ContextStep = 'add' | 'review' | 'confirm';

const ORDER: ContextStep[] = ['add', 'review', 'confirm'];

/**
 * The three-beat path through this page group: add details, review them,
 * confirm. Rendered on every sub-page so the freelancer always knows how much
 * is left before the context becomes usable in an analysis.
 */
export function ContextStepper({
  copy,
  current,
  done = [],
}: {
  copy: Dictionary['onboarding']['steps'];
  current: ContextStep;
  done?: ContextStep[];
}) {
  const labels: Record<ContextStep, { description: string; title: string }> = {
    add: { description: copy.addDescription, title: copy.addTitle },
    review: { description: copy.reviewDescription, title: copy.reviewTitle },
    confirm: { description: copy.confirmDescription, title: copy.confirmTitle },
  };
  const currentIndex = ORDER.indexOf(current);

  return (
    <ol
      aria-label={copy.label
        .replace('{step}', String(currentIndex + 1))
        .replace('{total}', String(ORDER.length))}
      className="grid gap-3 sm:grid-cols-3"
    >
      {ORDER.map((step, index) => {
        const isDone = done.includes(step);
        const isCurrent = step === current;

        return (
          <StarBorder
            as="li"
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex items-start gap-3 px-4 py-3 transition-colors',
              isCurrent
                ? 'border-[var(--dashboard-accent)]/35 bg-[var(--dashboard-accent-soft)]'
                : 'bg-card',
            )}
            key={step}
          >
            <span
              aria-hidden="true"
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
                isDone || isCurrent
                  ? 'bg-[var(--dashboard-accent)] text-[var(--dashboard-accent-foreground)]'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {isDone ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p
                className={cn(
                  'text-sm font-medium leading-5',
                  isCurrent ? 'text-[var(--dashboard-accent)]' : undefined,
                )}
              >
                {labels[step].title}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                {labels[step].description}
              </p>
            </div>
          </StarBorder>
        );
      })}
    </ol>
  );
}
