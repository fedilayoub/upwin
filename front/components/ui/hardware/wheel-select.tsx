"use client"

import * as React from "react"
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox"

import { haptic } from "@/lib/hardware/haptics"

import type { HardwareChoiceProps } from "./hardware"

// The drum. Rows sit 22 degrees apart on it, so its radius follows from the
// row height, and the ridges on its rails are spaced along its surface.
const ROW = 32
const RADIUS = ROW / ((22 * Math.PI) / 180)
const RIDGE_PITCH = 4
const RIDGES = Array.from(
  { length: Math.ceil((Math.PI * RADIUS) / RIDGE_PITCH) + 2 },
  (_, position) => position
)

interface WheelParts {
  faces: HTMLElement[]
  ridges: HTMLElement[]
}

// The rails' ridges and the row faces, found once per set of options rather
// than queried on every scroll event.
function findParts(list: HTMLElement): WheelParts {
  return {
    faces: [...list.querySelectorAll<HTMLElement>('[data-kit="wheel-face"]')],
    ridges: [
      ...(list.parentElement?.querySelectorAll<HTMLElement>("[data-ridge]") ??
        []),
    ],
  }
}

// Draws the drum at its current turn: each row leans back as it leaves the
// lens, and the ridges crowd and thin toward the top and bottom.
function paint(list: HTMLElement, parts: WheelParts) {
  const at = list.scrollTop / ROW
  const phase = ((list.scrollTop % RIDGE_PITCH) + RIDGE_PITCH) % RIDGE_PITCH
  const half = RIDGES.length / 2
  for (const ridge of parts.ridges) {
    const angle =
      ((Number(ridge.dataset.ridge) - half) * RIDGE_PITCH - phase) / RADIUS
    const visible = Math.abs(angle) < Math.PI / 2
    ridge.style.transform = visible
      ? `translateY(${(RADIUS * Math.sin(angle)).toFixed(2)}px) scaleY(${Math.cos(angle).toFixed(3)})`
      : "scaleY(0)"
    ridge.style.opacity = visible
      ? (0.2 + 0.8 * Math.cos(angle)).toFixed(2)
      : "0"
  }
  parts.faces.forEach((face, position) => {
    const distance = position - at
    const angle = Math.max(-90, Math.min(90, distance * 22))
    const radians = (angle * Math.PI) / 180
    face.style.transform = `perspective(500px) translateY(${RADIUS * Math.sin(radians) - distance * ROW}px) translateZ(${RADIUS * (Math.cos(radians) - 1)}px) rotateX(${-angle}deg)`
    // The registry fades a row by 0.28 per step from the lens. With three
    // rows showing, the neighbors are the other choices and have to be read.
    face.style.opacity = String(Math.max(0, 1 - Math.abs(distance) * 0.15))
  })
}

/**
 * A select drawn as a picker wheel: options sit on a drum that turns behind a
 * fixed lens, and whichever one stops in the lens is chosen. Scroll it, swipe
 * it, drag it with a mouse, click an option, or use the arrow keys and typing,
 * which the listbox underneath already handles.
 *
 * For a list that is set once and may grow: it takes the same room for two
 * options as for twenty. For a handful of options that should all stay in
 * view, use `SlideSwitch`, `ModeDial` or `Segmented` instead.
 *
 * From the SPEC-01 registry (registry/hardware/ui/select.tsx), changed to fit
 * a form: it is controlled and submits under `name`. It renders no label of
 * its own; name it with `aria-labelledby`. Not the app's own `Select` in
 * `components/ui/select`, which is the one to use outside a `<Hardware>` root.
 */
function WheelSelect<Value extends string>({
  name,
  onValueChange,
  options,
  value,
  className,
  ...props
}: HardwareChoiceProps<Value>) {
  const list = React.useRef<HTMLDivElement>(null)
  const parts = React.useRef<WheelParts | null>(null)
  const settle = React.useRef(0)
  const painting = React.useRef(0)
  const drag = React.useRef<{ y: number; top: number; moved: boolean } | null>(
    null
  )
  const dragged = React.useRef(false)
  const ready = React.useRef(false)
  const fromScroll = React.useRef(false)
  const target = React.useRef<number | null>(null)
  const chosen = React.useRef(value)
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )

  const repaint = React.useCallback(() => {
    const el = list.current
    if (!el) return
    parts.current ??= findParts(el)
    paint(el, parts.current)
  }, [])

  // A new set of options has new rows to find.
  React.useLayoutEffect(() => {
    parts.current = null
  }, [options.length])

  // The wheel turns to the chosen row, unless turning it is what chose it.
  React.useLayoutEffect(() => {
    chosen.current = value
    const el = list.current
    if (!el) return
    if (fromScroll.current) {
      fromScroll.current = false
      repaint()
      return
    }
    if (Math.abs(el.scrollTop - index * ROW) < 1 || drag.current) {
      ready.current = true
      repaint()
      return
    }
    target.current = index * ROW
    el.scrollTo({
      top: target.current,
      behavior: ready.current ? "smooth" : "instant",
    })
    ready.current = true
    repaint()
  }, [index, repaint, value])

  React.useEffect(
    () => () => {
      window.clearTimeout(settle.current)
      cancelAnimationFrame(painting.current)
    },
    []
  )

  const optionAt = (el: HTMLElement) =>
    options[
      Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ROW)))
    ]

  // The row in the lens is chosen as it passes, while the wheel turns.
  const chooseCentered = () => {
    const el = list.current
    if (!el) return
    const option = optionAt(el)
    if (option.value === chosen.current) return
    chosen.current = option.value
    haptic("selection")
    fromScroll.current = true
    onValueChange(option.value)
  }

  // Once the wheel stops, keyboard focus joins the row in the lens, so arrow
  // keys continue from there. Moving it mid-turn would make the listbox
  // scroll to the focused row and fight the drag.
  const focusCentered = () => {
    const el = list.current
    if (!el || !el.contains(document.activeElement)) return
    const row = el.querySelectorAll<HTMLElement>('[role="option"]')[
      Math.round(el.scrollTop / ROW)
    ]
    if (row && row !== document.activeElement) {
      row.focus({ preventScroll: true })
    }
  }

  // Scroll events can come faster than frames while the wheel is flung, so
  // the repaint runs at most once a frame.
  const onScroll = () => {
    if (!painting.current) {
      painting.current = requestAnimationFrame(() => {
        painting.current = 0
        repaint()
      })
    }
    const el = list.current
    if (!el) return
    // A scroll the wheel started itself, toward a chosen row, passes over
    // others on the way; only scrolls the person makes choose as they pass.
    if (target.current !== null) {
      if (Math.abs(el.scrollTop - target.current) < 1) target.current = null
    } else {
      chooseCentered()
    }
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      target.current = null
      if (drag.current) return
      chooseCentered()
      focusCentered()
    }, 120)
  }

  return (
    <div
      className={className}
      data-kit="wheel-frame"
      // The rows take focus from script, which browsers ring as they would a
      // keyboard's. `data-pointer` marks focus that a press put there, so
      // app.css can keep the ring for the keyboard.
      onKeyDownCapture={(event) => {
        delete event.currentTarget.dataset.pointer
      }}
      onPointerDownCapture={(event) => {
        event.currentTarget.dataset.pointer = ""
      }}
      style={{ "--wheel-row": `${ROW}px` } as React.CSSProperties}
    >
      {["left", "right"].map((side) => (
        <div aria-hidden data-kit="wheel-rail" data-side={side} key={side}>
          {RIDGES.map((ridge) => (
            <i data-ridge={ridge} key={ridge} />
          ))}
        </div>
      ))}
      <Listbox
        data-kit="wheel"
        name={name}
        onClickCapture={(event) => {
          // WebKit sends the click to the row the drag started on.
          if (!dragged.current) return
          dragged.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
        onMouseDown={(event) => {
          // Focusing a row on press scrolls it into view at once; focus it
          // without scrolling, and let the wheel roll to it instead.
          const option = (event.target as HTMLElement).closest<HTMLElement>(
            '[role="option"]'
          )
          if (!option) return
          event.preventDefault()
          option.focus({ preventScroll: true })
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onPointerDown={(event) => {
          dragged.current = false
          if (event.pointerType !== "mouse" || event.button !== 0) return
          drag.current = {
            y: event.clientY,
            top: event.currentTarget.scrollTop,
            moved: false,
          }
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current) return
          const dy = event.clientY - current.y
          const el = event.currentTarget
          if (!current.moved) {
            if (Math.abs(dy) < 3) return
            current.moved = true
            el.setPointerCapture(event.pointerId)
            el.dataset.dragging = ""
          }
          el.scrollTop = current.top - dy
        }}
        onPointerUp={(event) => {
          const current = drag.current
          drag.current = null
          if (!current?.moved) return
          const el = event.currentTarget
          delete el.dataset.dragging
          const option = optionAt(el)
          el.scrollTo({
            top: options.indexOf(option) * ROW,
            behavior: "smooth",
          })
          dragged.current = true
          if (option.value !== chosen.current) {
            chosen.current = option.value
            haptic("selection")
            fromScroll.current = true
            onValueChange(option.value)
          }
        }}
        onScroll={onScroll}
        onValueChange={(next) => {
          if (next && next !== value) onValueChange(next)
        }}
        ref={list}
        value={value}
        {...props}
      >
        {options.map((option) => (
          <ListboxItem
            data-kit="wheel-item"
            key={option.value}
            value={option.value}
          >
            <span data-kit="wheel-face">{option.label}</span>
          </ListboxItem>
        ))}
      </Listbox>
    </div>
  )
}

export { WheelSelect }
