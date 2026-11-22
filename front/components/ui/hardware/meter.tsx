"use client"

import * as React from "react"
import {
  Meter as SdkMeter,
  MeterIndicator,
  MeterTrack,
} from "@ui-sdk/react/meter"

/**
 * From SPEC-01 registry/hardware/ui/meter.tsx. A controlled, read-only
 * allowance gauge. The caller supplies its label and visible reading, so
 * translated counts and units stay with the content. No field wrapper.
 */
function Meter({
  value,
  max = 100,
  valueText,
  ...props
}: Omit<
  React.ComponentProps<typeof SdkMeter>,
  "children" | "defaultValue" | "getValueLabel" | "value"
> & {
  value: number
  valueText?: string
}) {
  return (
    <SdkMeter
      data-kit="meter"
      max={max > 0 ? max : 1}
      value={value}
      getValueLabel={valueText === undefined ? undefined : () => valueText}
      {...props}
    >
      <MeterTrack data-kit="meter-track">
        <MeterIndicator data-kit="meter-indicator" />
      </MeterTrack>
    </SdkMeter>
  )
}

export { Meter }
