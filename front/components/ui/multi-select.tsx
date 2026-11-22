"use client"

import * as React from "react"
import { CheckIcon, PlusIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface MultiSelectLabels {
  /** Text on the button that opens the suggestion list. */
  add: string
  /** Placeholder for the filter box inside the popover. */
  search: string
  /** Shown when the filter matches no remaining suggestion. */
  empty: string
  /** Offer to keep a value that is not in the suggestion list. */
  create: (query: string) => string
  /** Accessible name for a chip's remove button. */
  remove: (value: string) => string
  /** Shown once `max` values are selected. */
  limit: string
}

/**
 * Chip picker over a suggestion list that also accepts free text. Selected
 * values are posted as one form field per chip, so a value may contain a comma
 * and the server never has to guess at a separator.
 */
function MultiSelect({
  className,
  defaultValue = [],
  id,
  invalid = false,
  labels,
  max = 50,
  name,
  suggestions,
}: {
  className?: string
  defaultValue?: string[]
  id: string
  invalid?: boolean
  labels: MultiSelectLabels
  max?: number
  name: string
  suggestions: readonly string[]
}) {
  const [selected, setSelected] = React.useState<string[]>(defaultValue)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const full = selected.length >= max

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return suggestions.filter(
      (suggestion) =>
        !selected.includes(suggestion) &&
        suggestion.toLowerCase().includes(needle)
    )
  }, [query, selected, suggestions])

  const creatable = React.useMemo(() => {
    const value = query.trim()
    if (!value) return null
    const exists = [...selected, ...matches].some(
      (item) => item.toLowerCase() === value.toLowerCase()
    )
    return exists ? null : value
  }, [matches, query, selected])

  const options = React.useMemo(
    () => (creatable ? [...matches, creatable] : matches),
    [creatable, matches]
  )

  function search(value: string) {
    setQuery(value)
    setActiveIndex(0)
  }

  function add(value: string) {
    const trimmed = value.trim()
    if (!trimmed || full || selected.includes(trimmed)) return
    setSelected([...selected, trimmed])
    search("")
    searchRef.current?.focus()
  }

  function remove(value: string) {
    setSelected(selected.filter((item) => item !== value))
    setActiveIndex(0)
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (options.length === 0) return
      const step = event.key === "ArrowDown" ? 1 : options.length - 1
      setActiveIndex((current) => (current + step) % options.length)
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const option = options[activeIndex] ?? creatable
      if (option) add(option)
      return
    }
    if (event.key === "Backspace" && query === "" && selected.length > 0) {
      remove(selected[selected.length - 1] ?? "")
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "border-input bg-background flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border p-1.5 text-sm shadow-xs transition-[color,box-shadow] dark:bg-input/30",
            open &&
              "border-[var(--dashboard-accent)] ring-[3px] ring-[var(--dashboard-accent)]/20",
            invalid && "border-destructive ring-destructive/20",
            className
          )}
          data-slot="multi-select"
        >
          {selected.map((value) => (
            <input key={`${name}-${value}`} name={name} type="hidden" value={value} />
          ))}
          {selected.map((value) => (
            <Badge
              className="gap-1 rounded-md py-1 pr-1 pl-2 font-normal"
              key={value}
              variant="secondary"
            >
              <span className="max-w-52 truncate">{value}</span>
              <button
                aria-label={labels.remove(value)}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 cursor-pointer rounded-sm outline-none focus-visible:ring-2"
                onClick={() => remove(value)}
                type="button"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <PopoverTrigger asChild>
            <button
              className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={full}
              id={id}
              type="button"
            >
              <PlusIcon className="size-3" />
              {full ? labels.limit : labels.add}
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
      >
        <input
          aria-label={labels.search}
          className="placeholder:text-muted-foreground w-full border-b px-3 py-2.5 text-sm outline-none"
          onChange={(event) => search(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={labels.search}
          ref={searchRef}
          value={query}
        />
        <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
          {options.length === 0 ? (
            <li className="text-muted-foreground px-2 py-6 text-center text-sm">
              {labels.empty}
            </li>
          ) : (
            options.map((option, index) => (
              <li key={option} role="presentation">
                <button
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                    index === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60"
                  )}
                  onClick={() => add(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  {option === creatable ? (
                    <PlusIcon className="size-3.5 shrink-0" />
                  ) : (
                    <CheckIcon className="size-3.5 shrink-0 opacity-0" />
                  )}
                  <span className="truncate">
                    {option === creatable ? labels.create(option) : option}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export { MultiSelect }
