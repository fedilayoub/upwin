import * as React from 'react';
import { StarBorder } from '@/components/ui/star-border';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <StarBorder
      as="section"
      className={cn(
        'bg-card text-card-foreground',
        className,
        'rounded-none border-dashed shadow-none',
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('space-y-1 p-4 pb-2.5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2 className={cn('text-sm font-semibold tracking-tight', className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p className={cn('text-xs leading-relaxed text-muted-foreground', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4 pt-1.5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center p-4 pt-2.5', className)} {...props} />;
}
