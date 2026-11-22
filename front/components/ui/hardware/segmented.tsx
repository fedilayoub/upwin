"use client"

import * as React from "react"
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"

import { haptic } from "@/lib/hardware/haptics"

import type { HardwareChoiceProps } from "./hardware"

// Drag the key across the segments: it follows the pointer, the segment under
// it is chosen as it passes, and it snaps into place on release. A press
// without movement is left to the segment's own click.
function useSegmentDrag(select: (value: string) => void) {
  const drag = React.useRef<{ x: number; id: number; moved: boolean } | null>(
    null
  )
  const segments = (root: HTMLElement) => [
    ...root.querySelectorAll<HTMLElement>('[data-kit="segment"]'),
  ]

  const follow = (root: HTMLElement, clientX: number) => {
    const all = segments(root)
    if (!all.length) return
    const x = clientX - root.getBoundingClientRect().left
    const under =
      all.find((segment) => x < segment.offsetLeft + segment.offsetWidth) ??
      all[all.length - 1]
    const first = all[0].offsetLeft
    const last = all[all.length - 1].offsetLeft
    const left = Math.min(last, Math.max(first, x - under.offsetWidth / 2))
    root.style.setProperty("--drag-left", `${left}px`)
    if (under.dataset.value) select(under.dataset.value)
  }

  return {
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
      drag.current = null
      delete event.currentTarget.dataset.dragging
    },
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      drag.current = { x: event.clientX, id: event.pointerId, moved: false }
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const current = drag.current
      if (!current || current.id !== event.pointerId) return
      const root = event.currentTarget
      if (!current.moved) {
        if (Math.abs(event.clientX - current.x) < 4) return
        current.moved = true
        root.setPointerCapture(event.pointerId)
        root.dataset.dragging = ""
      }
      follow(root, event.clientX)
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      const root = event.currentTarget
      if (drag.current?.moved) root.releasePointerCapture(event.pointerId)
      drag.current = null
      delete root.dataset.dragging
      root.style.removeProperty("--drag-left")
    },
  }
}

/**
 * A row of segments with a key that slides to the chosen one and a lamp under
 * each. Click a segment, use the arrow keys, or drag the key across.
 *
 * From the SPEC-01 registry (registry/hardware/ui/segmented-control.tsx),
 * changed to fit a form: it is controlled, it submits under `name`, and an
 * option's value is separate from its label so the label can be translated.
 * It renders no label of its own; name it with `aria-labelledby`.
 *
 * Not the app's own `SegmentedControl` in `components/ui/segmented-control`,
 * which is the one to use outside a `<Hardware>` root.
 */
function Segmented<Value extends string>({
  name,
  onValueChange,
  options,
  value,
  ...props
}: HardwareChoiceProps<Value>) {
  const choose = (next: Value) => {
    if (next === value) return
    haptic("selection")
    onValueChange(next)
  }
  const drag = useSegmentDrag((raw) => {
    const option = options.find((candidate) => candidate.value === raw)
    if (option) choose(option.value)
  })

  return (
    <SegmentedControl
      data-kit="segmented"
      name={name}
      onValueChange={(next) => {
        if (next) choose(next)
      }}
      value={value}
      {...drag}
      {...props}
    >
      <SegmentedControlIndicator data-kit="segmented-indicator" />
      {options.map((option) => (
        <SegmentedControlItem
          data-kit="segment"
          data-value={option.value}
          key={option.value}
          value={option.value}
        >
          <span aria-hidden data-kit="led" />
          {option.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}

export { Segmented }
