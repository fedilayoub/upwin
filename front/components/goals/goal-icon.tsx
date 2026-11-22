import { cn } from '@/lib/utils';

/**
 * Crosshair mark for goals: a dashed ring with fading horizontal and vertical
 * axes. Sized by `className` and coloured by `currentColor`, like a lucide icon.
 */
export function GoalIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative block size-4 shrink-0', className)}>
      <span className="pointer-events-none absolute left-1/2 top-1/2 size-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-current" />
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-transparent via-current to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-linear-to-b from-transparent via-current to-transparent" />
    </span>
  );
}
