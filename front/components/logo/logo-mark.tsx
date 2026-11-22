import { cn } from '@/lib/utils';
import { LOGO_MARK_ARCH, LOGO_MARK_ARROW, LOGO_MARK_VIEW_BOX } from './logo-mark-paths';

/**
 * The upwin glyph on its own: an arch with a rising arrow off its right shoulder.
 * Separate from `Logo` because `Logo` is a `Link` capped at 32px, which is a nav
 * control, not something you can drop into an illustration.
 *
 * Paints with `currentColor`, so the caller owns the color.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('size-4', className)}
      fill="none"
      viewBox={LOGO_MARK_VIEW_BOX}
    >
      <path
        d={LOGO_MARK_ARCH.d}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={LOGO_MARK_ARCH.strokeWidth}
      />
      <path
        d={LOGO_MARK_ARROW.d}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={LOGO_MARK_ARROW.strokeWidth}
      />
    </svg>
  );
}
