import * as React from "react"

import "./skin.css"
import "./app.css"

/**
 * The root of the SPEC-01 hardware skin. Everything inside it is styled by the
 * skin, and nothing outside it is: every rule is scoped to this element.
 *
 * Unlike the registry's root, this one installs nothing on the document. The
 * registry adds page-wide listeners for interaction sounds, a block caret and
 * Safari's Tab order; none of the controls used here need them.
 *
 * The plate's finish and key color come from app.css: sage in the light
 * theme, forest in the dark. Text inside the root must take its color from
 * the skin's variables there, never from the app's theme tokens.
 *
 * `keyColor` overrides the key color for one root, in both themes: an OKLCH
 * lightness, chroma and hue. Keep the lightness at or under 0.68.
 */
function Hardware({
  keyColor,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  keyColor?: { l: number; c: number; h: number }
}) {
  const theme =
    keyColor &&
    ({
      "--theme-l": keyColor.l,
      "--theme-c": keyColor.c,
      "--theme-h": keyColor.h,
    } as React.CSSProperties)

  return <div data-skin="hardware" style={{ ...theme, ...style }} {...props} />
}

interface HardwareOption<Value extends string> {
  label: string
  value: Value
}

/** What every hardware choice control takes: a named, controlled radio group. */
interface HardwareChoiceProps<Value extends string> {
  "aria-describedby"?: string
  "aria-labelledby"?: string
  className?: string
  /** The name the value submits under in a form. */
  name: string
  onValueChange: (value: Value) => void
  options: ReadonlyArray<HardwareOption<Value>>
  value: Value
}

export { Hardware }
export type { HardwareChoiceProps, HardwareOption }
