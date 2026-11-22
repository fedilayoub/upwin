"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  /** Primary line, and what the trigger shows when selected. */
  label: string
  /** Secondary line under the label inside the list. */
  description?: string
  /** Optional group heading; options keep their given order within a group. */
  group?: string
  /** Extra text matched by the filter but never rendered. */
  keywords?: readonly string[]
}

export interface ComboboxLabels {
  /** Trigger text when nothing is selected. */
  placeholder: string
  /** Placeholder and accessible name for the filter box. */
  search: string
  /** Shown when the filter matches nothing. */
  empty: string
}

/**
 * Single-select picker with an integrated filter box. Same shape as the
 * shadcn combobox (popover + searchable list) built on this project's Popover,
 * so it needs no extra dependency and matches `multi-select.tsx`.
 */
function Combobox({
  className,
  disabled = false,
  id,
  invalid = false,
  labels,
  name,
  onValueChange,
  options,
  value,
}: {
  className?: string
  disabled?: boolean
  id: string
  invalid?: boolean
  labels: ComboboxLabels
  name?: string
  onValueChange: (value: string) => void
  options: readonly ComboboxOption[]
  value: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  // Highlight is tracked by value, not index, so it survives a filter change
  // without an effect that re-syncs it. `null` means "first match".
  const [activeValue, setActiveValue] = React.useState<string | null>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const listId = `${id}-listbox`

  const selected = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  )

  const matches = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (needle.length === 0) return [...options]
    return options.filter((option) =>
      [option.value, option.label, option.group ?? "", ...(option.keywords ?? [])].some(
        (candidate) => candidate.toLocaleLowerCase().includes(needle)
      )
    )
  }, [options, query])

  const groups = React.useMemo(() => {
    const byGroup = new Map<string, ComboboxOption[]>()
    for (const option of matches) {
      const key = option.group ?? ""
      const bucket = byGroup.get(key) ?? []
      bucket.push(option)
      byGroup.set(key, bucket)
    }
    return [...byGroup.entries()]
  }, [matches])

  // Index into `matches`, so keyboard order follows what is rendered.
  const indexOf = React.useCallback(
    (option: ComboboxOption) => matches.indexOf(option),
    [matches]
  )

  const found = matches.findIndex((option) => option.value === activeValue)
  const activeIndex = found >= 0 ? found : 0

  function moveTo(index: number) {
    setActiveValue(matches[index]?.value ?? null)
  }

  React.useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open])

  function select(option: ComboboxOption) {
    onValueChange(option.value)
    setOpen(false)
    setQuery("")
    setActiveValue(null)
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (matches.length === 0) return
      const step = event.key === "ArrowDown" ? 1 : matches.length - 1
      moveTo((activeIndex + step) % matches.length)
      return
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      moveTo(event.key === "Home" ? 0 : Math.max(matches.length - 1, 0))
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const option = matches[activeIndex]
      if (option) select(option)
    }
  }

  return (
    <>
      {name && <input name={name} type="hidden" value={value} />}
      <Popover
        onOpenChange={(next) => {
          setOpen(next)
          setQuery("")
          setActiveValue(next ? value : null)
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <button
            aria-controls={open ? listId : undefined}
            aria-expanded={open}
            className={cn(
              "border-input bg-background flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
              open &&
                "border-[var(--dashboard-accent)] ring-[3px] ring-[var(--dashboard-accent)]/20",
              invalid && "border-destructive ring-destructive/20",
              className
            )}
            data-slot="combobox"
            disabled={disabled}
            id={id}
            role="combobox"
            type="button"
          >
            <span
              className={cn("truncate", !selected && "text-muted-foreground")}
            >
              {selected ? selected.label : labels.placeholder}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) min-w-64 p-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            searchRef.current?.focus()
          }}
        >
          <input
            aria-autocomplete="list"
            aria-controls={listId}
            aria-label={labels.search}
            className="placeholder:text-muted-foreground w-full border-b px-3 py-2.5 text-sm outline-none"
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveValue(null)
            }}
            onKeyDown={onSearchKeyDown}
            placeholder={labels.search}
            ref={searchRef}
            value={query}
          />
          <div
            className="max-h-72 overflow-y-auto p-1"
            id={listId}
            ref={listRef}
            role="listbox"
          >
            {matches.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                {labels.empty}
              </p>
            ) : (
              groups.map(([group, groupOptions]) => (
                <div key={group || "_"} role="group">
                  {group && (
                    <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                      {group}
                    </p>
                  )}
                  {groupOptions.map((option) => {
                    const index = indexOf(option)
                    const active = index === activeIndex
                    return (
                      <button
                        aria-selected={option.value === value}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-left outline-none",
                          active && "bg-accent text-accent-foreground"
                        )}
                        data-active={active}
                        key={option.value}
                        onClick={() => select(option)}
                        onMouseEnter={() => setActiveValue(option.value)}
                        role="option"
                        type="button"
                      >
                        <CheckIcon
                          className={cn(
                            "mt-0.5 size-3.5 shrink-0",
                            option.value === value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {option.label}
                          </span>
                          {option.description && (
                            <span className="text-muted-foreground block truncate text-xs">
                              {option.description}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

export { Combobox }
