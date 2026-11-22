import type { Dictionary } from '@/i18n/types';
import type { InsightsFunnel } from '@/lib/api';

/**
 * The bar's pixel width clamps at 100% so a step that exceeds the first one
 * cannot overflow the track. That is layout. The percentage beside it is printed
 * unclamped, because a step above 100% is a real condition the user should see.
 */
function barWidth(share: number): string {
  return `${Math.min(share, 1) * 100}%`;
}

export function FunnelBars({
  copy,
  funnel,
}: {
  copy: Dictionary['dashboard']['funnel'];
  funnel: InsightsFunnel;
}) {
  const hasShares = funnel.steps.some((step) => step.share !== null);

  return (
    <div className="space-y-3">
      {funnel.steps.map((step) => (
        <div className="space-y-1.5" key={step.id}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>{copy.steps[step.id]}</span>
            <span className="flex items-baseline gap-2">
              <span className="font-semibold tabular-nums">{step.count}</span>
              {step.share === null ? null : (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(step.share * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            {step.share === null ? null : (
              <div
                className="h-1.5 rounded-full bg-[var(--dashboard-accent)]"
                style={{ width: barWidth(step.share) }}
              />
            )}
          </div>
        </div>
      ))}
      {hasShares ? null : (
        <p className="text-xs text-muted-foreground">{copy.shareEmpty}</p>
      )}
    </div>
  );
}
