import type * as React from 'react';
import { cn } from '@/lib/utils';

const cornerClassName =
  'absolute block size-6 border-dashed border-muted-foreground';

type CornerBorderProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  cornerClassName?: string;
};

/** Decorative dashed corner marks for a positioned parent element. */
export function CornerBorder({
  className,
  cornerClassName: cornerClassNameOverride,
  ...props
}: CornerBorderProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 z-10', className)}
      data-slot="corner-border"
    >
      <span
        className={cn(
          cornerClassName,
          'top-0 left-0 border-t border-l',
          cornerClassNameOverride,
        )}
      />
      <span
        className={cn(
          cornerClassName,
          'top-0 right-0 border-t border-r',
          cornerClassNameOverride,
        )}
      />
      <span
        className={cn(
          cornerClassName,
          'bottom-0 left-0 border-b border-l',
          cornerClassNameOverride,
        )}
      />
      <span
        className={cn(
          cornerClassName,
          'right-0 bottom-0 border-r border-b',
          cornerClassNameOverride,
        )}
      />
    </span>
  );
}
