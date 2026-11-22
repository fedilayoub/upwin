import type * as React from 'react';
import { cn } from '@/lib/utils';

type StarBorderElement = 'article' | 'aside' | 'div' | 'fieldset' | 'li' | 'nav' | 'section' | 'span';

function Star({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('size-4 text-muted', className)}>
      <svg aria-hidden="true" className="size-full" focusable="false" viewBox="0 0 30 30">
        <path
          d="
          M15 0
          C19 9 21 11 30 15
          C21 19 19 21 15 30
          C11 21 9 19 0 15
          C9 11 11 9 15 0
          Z
          "
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export function StarBorder({
  as: Component = 'div',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: StarBorderElement }) {
  return (
    <Component
      className={cn(
        'relative isolate overflow-hidden border border-dashed',
        className,
      )}
      {...props}
    >
      <Star className="absolute -top-[7.9px] -left-[7.8px] z-50" />
      <Star className="absolute -top-[7.9px] -right-[7.6px] z-50" />
      <Star className="absolute -bottom-[8px] -left-[7.8px] z-50" />
      <Star className="absolute -bottom-[8px] -right-[7.8px] z-50" />
      {children}
    </Component>
  );
}
