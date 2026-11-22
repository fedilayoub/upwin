import { Trophy, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ScoreGauge } from '@/components/charts/score-gauge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';

export function ScoreSummaryCard({
  afterProgress,
  children,
  className,
  collapsibleSummary = false,
  context,
  icon: Icon = Trophy,
  label,
  score,
  summary,
  visual = 'bar',
}: {
  afterProgress?: ReactNode;
  children?: ReactNode;
  className?: string;
  collapsibleSummary?: boolean;
  context?: string;
  icon?: LucideIcon;
  label: string;
  score: number;
  summary: string;
  visual?: 'bar' | 'gauge';
}) {
  const { t } = useI18n();

  if (visual === 'bar') {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className="space-y-4 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_42%)] pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary-strong">
                <Icon className="size-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em]">
                  {label}
                </p>
              </div>
              {context ? (
                <p className="mt-2 text-xs text-muted-foreground">{context}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-4xl font-semibold tracking-[-0.06em] tabular-nums">
              {score}
              <span className="ml-1 text-base font-medium tracking-normal text-muted-foreground">
                / 100
              </span>
            </p>
          </div>

          <Progress label={label} value={score} />
          {afterProgress}
          <p className="text-sm leading-relaxed">{summary}</p>
          {children}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        '@container/score-summary overflow-hidden rounded-2xl border-primary/18 shadow-[0_22px_52px_-36px_var(--profile-shadow)]',
        className,
      )}
      data-score-summary
    >
      <CardContent className="p-0">
        <div className="bg-primary/7 p-4">
          <div className="grid items-start gap-3 @min-[340px]/score-summary:grid-cols-[minmax(0,1fr)_minmax(138px,0.72fr)] @min-[340px]/score-summary:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-primary-strong">
                <Icon className="size-4" />
                <p className="text-xs font-semibold">{label}</p>
              </div>
              {context ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {context}
                </p>
              ) : null}
            </div>
            <ScoreGauge label={label} score={score} />
          </div>

          {afterProgress ? <div className="mt-3">{afterProgress}</div> : null}
        </div>
        <div className="space-y-4 border-t border-primary/10 p-4">
          {collapsibleSummary ? (
            <details className="group" data-score-summary-copy>
              <summary className="cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/35 [&::-webkit-details-marker]:hidden">
                <p className="line-clamp-3 text-sm leading-relaxed text-pretty group-open:line-clamp-none">
                  {summary}
                </p>
                <span className="mt-2 inline-flex text-xs font-semibold text-primary-strong group-open:hidden">
                  {t('profile.readSummary')}
                </span>
                <span className="mt-2 hidden text-xs font-semibold text-primary-strong group-open:inline-flex">
                  {t('profile.showLess')}
                </span>
              </summary>
            </details>
          ) : (
            <p className="text-sm leading-relaxed text-pretty">{summary}</p>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
