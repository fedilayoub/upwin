"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A radio group styled as a segmented control. Native radios, so a form action
 * receives the value under `name` and arrow-key navigation works without any
 * extra keyboard handling. Prefer it over a Select for short ordinal choices,
 * where seeing every option at once is the whole point.
 */
function SegmentedControl<Value extends string>({
  className,
  name,
  onValueChange,
  options,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  name: string
  onValueChange: (value: Value) => void
  options: ReadonlyArray<{ label: string; value: Value }>
  value: Value
}) {
  return (
    <div
      data-slot="segmented-control"
      role="radiogroup"
      className={cn(
        "flex w-full items-stretch gap-1 rounded-xl border border-border/70 bg-muted/50 p-1",
        className
      )}
      {...props}
    >
      {options.map((option) => (
        <label
          data-slot="segmented-control-option"
          key={option.value}
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
            "hover:text-foreground",
            "has-[input:checked]:bg-background has-[input:checked]:text-foreground has-[input:checked]:shadow-sm",
            "has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50"
          )}
        >
          <input
            checked={option.value === value}
            className="sr-only"
            name={name}
            onChange={() => onValueChange(option.value)}
            type="radio"
            value={option.value}
          />
          <span className="truncate">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

export { SegmentedControl }
