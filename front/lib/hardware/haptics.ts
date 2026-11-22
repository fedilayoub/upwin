// Haptic feedback for the hardware controls, from the SPEC-01 registry
// (registry/hardware/lib/haptics.ts), cut down for this app:
//
// - No interaction sounds. The registry plays a synthesized click with every
//   haptic and a keyboard sound in every text field on the page.
// - No page-wide click listener. The controls here tick from their own change
//   handlers, so nothing is installed on the document.
//
// - Android and other browsers with the Vibration API: navigator.vibrate.
// - Safari, which has no Vibration API: iOS 18 and later play the system
//   haptic when an <input type="checkbox" switch> is toggled through a label
//   tied to it, including a label clicked from script. So there is one hidden
//   switch in a label, and the label is clicked for each tap. The label is
//   inert, so its click cannot move focus.
// - Anywhere else, nothing happens.

type Haptic = "selection" | "light" | "medium"

const patterns: Record<Haptic, number> = {
  selection: 8,
  light: 12,
  medium: 22,
}

const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function"

// Safari 17.4 added the switch; iOS 18 gave it its haptic. Where it is
// missing, the click below does nothing at all.
const hasSwitch = () =>
  typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype

// The hidden switch, set up as iOS expects: a full-size switch inside a
// one-pixel label that clips it, still in the render tree, and out of the way
// of pointers, focus and assistive technology.
let label: HTMLLabelElement | null = null

function tapSwitch() {
  if (!label) {
    label = document.createElement("label")
    label.dataset.hapticSwitch = ""
    label.inert = true
    label.setAttribute("aria-hidden", "true")
    label.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0.01;pointer-events:none"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.setAttribute("switch", "")
    input.tabIndex = -1
    label.append(input)
    document.body.append(label)
  }
  label.click()
}

let last = 0

// Two haptics within 30ms count as one, so a fast drag does not blur into a
// buzz, while a steady drag still ticks at every detent.
function haptic(kind: Haptic) {
  if (typeof document === "undefined") return
  const now = performance.now()
  if (now - last < 30) return
  last = now
  if (canVibrate()) {
    navigator.vibrate(patterns[kind])
  } else if (hasSwitch()) {
    // Outside a gesture iOS stays silent, so the switch is left alone.
    if (navigator.userActivation && !navigator.userActivation.isActive) return
    tapSwitch()
  }
}

export { haptic }
export type { Haptic }
