import type * as React from 'react';
import { cn } from '@/lib/utils';

export function ButtonGroup({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex w-fit items-stretch [&>*]:relative [&>*]:focus-visible:z-10 [&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none',
        className,
      )}
      data-slot="button-group"
      role="group"
      {...props}
    />
  );
}
