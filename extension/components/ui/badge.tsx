import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
  {
    defaultVariants: { variant: 'default' },
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary-strong',
        outline: 'border border-border text-muted-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/12 text-warning-foreground',
      },
    },
  },
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
