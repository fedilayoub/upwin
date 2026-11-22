"use client"

import * as React from "react"
import { Radio, RadioGroup } from "@ui-sdk/react/radio"

import { haptic } from "@/lib/hardware/haptics"

import type { HardwareChoiceProps } from "./hardware"

/**
 * A multi-position slide switch: a slot with a detent per option, each
 * labeled, and a ribbed lever that snaps to the chosen one. Click a position,
 * use the arrow keys, or drag the lever along the slot. For a few short,
 * ordered options; it is a radio group underneath.
 *
 * From the SPEC-01 registry (registry/hardware/ui/slide-switch.tsx), changed
 * to fit a form: it is controlled, it submits under `name`, and an option's
 * value is separate from its label so the label can be translated. It renders
 * no label of its own; name it with `aria-labelledby`.
 */
function SlideSwitch<Value extends string>({
  name,
  onValueChange,
  options,
  value,
  ...props
}: HardwareChoiceProps<Value>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  const [drag, setDrag] = React.useState<number | null>(null)

  // A tick at each detent the lever reaches, clicked or dragged.
  const choose = (next: Value) => {
    if (next === value) return
    haptic("selection")
    onValueChange(next)
  }

  // Where the pointer is along the slot, in positions: 0 at the first detent,
  // n - 1 at the last.
  const at = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const share = (event.clientX - box.left) / box.width
    return Math.min(
      options.length - 1,
      Math.max(0, share * options.length - 0.5)
    )
  }

  return (
    <RadioGroup
      data-dragging={drag !== null || undefined}
      data-kit="slide-switch"
      data-orientation="horizontal"
      name={name}
      onPointerCancel={() => setDrag(null)}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag(at(event))
      }}
      onPointerMove={(event) => {
        if (drag === null) return
        const position = at(event)
        setDrag(position)
        choose(options[Math.round(position)].value)
      }}
      onPointerUp={(event) => {
        if (drag === null) return
        choose(options[Math.round(at(event))].value)
        setDrag(null)
      }}
      onValueChange={(next) => {
        if (next) choose(next)
      }}
      style={
        { "--n": options.length, "--i": drag ?? index } as React.CSSProperties
      }
      value={value}
      {...props}
    >
      <span aria-hidden data-kit="slide-switch-lever" />
      {options.map((option) => (
        <Radio
          data-kit="slide-switch-stop"
          key={option.value}
          value={option.value}
        >
          {option.label}
        </Radio>
      ))}
    </RadioGroup>
  )
}

export { SlideSwitch }
