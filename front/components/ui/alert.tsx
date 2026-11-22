import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-1 rounded-xl border px-4 py-3.5 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*5)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "border-border/70 bg-card text-card-foreground [&>svg]:text-muted-foreground",
        accent:
          "border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)] text-foreground [&>svg]:text-[var(--dashboard-accent)]",
        warning:
          "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
        info: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-100 [&>svg]:text-sky-600 dark:[&>svg]:text-sky-400",
        destructive:
          "border-destructive/40 bg-destructive/8 text-foreground [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm leading-6 opacity-90 [&_p]:leading-6",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
