"use client"

import * as React from "react"
import { Radio, RadioGroup } from "@ui-sdk/react/radio"

import { haptic } from "@/lib/hardware/haptics"

import type { HardwareChoiceProps } from "./hardware"

/**
 * A mode dial, as on a camera: labeled stops on a printed arc of ticks, the
 * chosen one in a filled chip, and a knurled knob whose pointer turns to it.
 * Click a stop, drag anywhere on the dial round, or use the arrow keys. For a
 * handful of unordered options that should all stay visible; it is a radio
 * group underneath.
 *
 * From the SPEC-01 registry (registry/hardware/ui/mode-dial.tsx), changed to
 * fit a form: it is controlled and submits under `name`. It renders no label
 * of its own; name it with `aria-labelledby`.
 */
function ModeDial<Value extends string>({
  name,
  onValueChange,
  options,
  sweep = 240,
  value,
  ...props
}: HardwareChoiceProps<Value> & {
  /** The arc the stops are spread over, in degrees. */
  sweep?: number
}) {
  const step = options.length > 1 ? sweep / (options.length - 1) : 0
  const angleOf = (position: number) => -sweep / 2 + position * step
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  const turning = React.useRef(false)

  // A tick at each stop the knob turns to.
  const choose = (next: Value) => {
    if (next === value) return
    haptic("selection")
    onValueChange(next)
  }

  // The angle from the knob's center, which sits half the dial's width down.
  const turnTo = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const angle =
      (Math.atan2(
        event.clientX - box.left - box.width / 2,
        -(event.clientY - box.top - box.width / 2)
      ) *
        180) /
      Math.PI
    let nearest = 0
    options.forEach((_, position) => {
      if (
        Math.abs(angleOf(position) - angle) <
        Math.abs(angleOf(nearest) - angle)
      ) {
        nearest = position
      }
    })
    choose(options[nearest].value)
  }

  return (
    <RadioGroup
      data-kit="mode-dial"
      name={name}
      onPointerCancel={() => {
        turning.current = false
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        turning.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        turnTo(event)
      }}
      onPointerMove={(event) => {
        if (turning.current) turnTo(event)
      }}
      onPointerUp={() => {
        turning.current = false
      }}
      onValueChange={(next) => {
        if (next) choose(next)
      }}
      style={
        {
          "--sweep": `${sweep}deg`,
          "--at": `${angleOf(index)}deg`,
        } as React.CSSProperties
      }
      value={value}
      {...props}
    >
      <span aria-hidden data-kit="mode-dial-scale" />
      <span aria-hidden data-kit="mode-dial-knob">
        <span data-kit="mode-dial-pointer" />
      </span>
      {options.map((option, position) => (
        <Radio
          data-kit="mode-stop"
          key={option.value}
          style={{ "--a": `${angleOf(position)}deg` } as React.CSSProperties}
          value={option.value}
        >
          <span data-kit="mode-stop-label">{option.label}</span>
        </Radio>
      ))}
    </RadioGroup>
  )
}

export { ModeDial }
