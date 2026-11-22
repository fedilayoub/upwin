import * as React from 'react';
import { cn } from '@/lib/utils';

export function Pill({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--hero-border-hairline)] bg-[var(--hero-secondary-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--hero-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl',
        className,
      )}
      data-slot="pill"
      {...props}
    />
  );
}
