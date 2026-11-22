import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function GradientDiagonalPattern() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full bg-[repeating-linear-gradient(315deg,var(--pattern-fg)_0,var(--pattern-fg)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] opacity-10"
    />
  );
}

export function KpiTile({
  className,
  delta,
  featured = false,
  hint,
  label,
  value,
}: {
  className?: string;
  delta?: number | null;
  featured?: boolean;
  hint?: string;
  label: string;
  value: string | number;
}) {
  return (
    <article
      className={cn(
        'relative isolate flex min-w-0 flex-col justify-between gap-5 overflow-hidden p-5 sm:p-6',
        featured
          ? 'min-h-52 bg-[var(--dashboard-feature)] text-[var(--dashboard-feature-foreground)] [--pattern-fg:var(--dashboard-feature-foreground)] lg:min-h-full'
          : 'min-h-36 bg-card',
        className,
      )}
    >
      {featured ? <GradientDiagonalPattern /> : null}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <p
          className={cn(
            'text-sm font-medium',
            featured
              ? 'text-[var(--dashboard-feature-foreground)] opacity-75'
              : 'text-muted-foreground',
          )}
        >
          {label}
        </p>
        {delta !== undefined && delta !== null ? (
          <Badge
            className={cn(
              featured &&
                delta >= 0 &&
                'border-white/15 bg-white/12 text-[var(--dashboard-feature-foreground)]',
            )}
            variant={delta >= 0 ? 'secondary' : 'destructive'}
          >
            {delta > 0 ? '+' : ''}{delta}
          </Badge>
        ) : null}
      </div>
      <div className="relative z-10 space-y-1.5">
        <p
          className={cn(
            'font-semibold tracking-[-0.035em] tabular-nums',
            featured ? 'text-5xl sm:text-6xl' : 'text-2xl sm:text-[1.75rem]',
          )}
        >
          {value}
        </p>
        {hint ? (
          <p
            className={cn(
              'text-xs leading-5',
              featured
                ? 'text-[var(--dashboard-feature-foreground)] opacity-75'
                : 'text-muted-foreground',
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
    </article>
  );
}
