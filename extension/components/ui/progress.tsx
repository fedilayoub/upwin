import { cn } from '@/lib/utils';
import type { ScoreTone } from '@/features/profile/score-tone';

export type ProgressTone = 'brand' | ScoreTone;

const TONE_FILL: Record<ProgressTone, string> = {
  brand: 'bg-primary',
  strong: 'bg-success',
  moderate: 'bg-warning',
  weak: 'bg-score-weak',
};

interface ProgressProps {
  className?: string;
  label: string;
  /** Defaults to the brand fill so existing call sites are unchanged. */
  tone?: ProgressTone;
  value: number;
}

export function Progress({
  className,
  label,
  tone = 'brand',
  value,
}: ProgressProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={normalizedValue}
      // The unfilled track is `--foreground` at low alpha, not `--muted`: muted
      // sits within ~0.06 lightness of both `--card` and `--background` in the
      // dark theme, so the 100% baseline was invisible on a card. An alpha of
      // the foreground contrasts against whatever surface it is dropped on, in
      // either theme.
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-foreground/12',
        className,
      )}
      role="progressbar"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300',
          TONE_FILL[tone],
        )}
        style={{ width: `${normalizedValue}%` }}
      />
    </div>
  );
}
