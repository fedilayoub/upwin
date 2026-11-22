import type { LucideIcon } from 'lucide-react';
import { StarBorder } from '@/components/ui/star-border';
import { cn } from '@/lib/utils';

/**
 * The header every protected page opens with. Dashboard, applications,
 * proposals, and goals all render this shape by hand; keeping it in one place
 * stops the two reworked pages from drifting away from them again.
 */
export function PageHeader({
  actions,
  children,
  className,
  description,
  icon: Icon,
  title,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 border-b border-border/70 pb-6',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StarBorder
              aria-hidden="true"
              as="span"
              className="grid size-9 shrink-0 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
            >
              <Icon className="size-[18px]" strokeWidth={2} />
            </StarBorder>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-[1.75rem]">
              {title}
            </h1>
          </div>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
