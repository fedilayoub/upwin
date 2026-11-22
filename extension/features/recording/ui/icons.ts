import { createLucideIcon, type IconNode } from "lucide-react";

const dot = (cx: number, cy: number, r: number): IconNode[number] => [
  "circle",
  {
    cx: String(cx),
    cy: String(cy),
    r: String(r),
    fill: "currentColor",
    stroke: "none",
    key: `dot-${cx}-${cy}`,
  },
];

/**
 * Background blur: a sharp person against dots that fade outwards, drawn on Lucide's 24-unit
 * grid so it sits with the bar's other icons. Lucide has no glyph for this.
 */
export const BackgroundBlur = createLucideIcon("background-blur", [
  ["circle", { cx: "12", cy: "10", r: "3", key: "head" }],
  ["path", { d: "M7 20a5 5 0 0 1 10 0", key: "shoulders" }],
  dot(5, 5, 1.1),
  dot(5, 10, 1.1),
  dot(5, 15, 1.1),
  dot(2, 7.5, 0.65),
  dot(2, 12.5, 0.65),
  dot(19, 5, 1.1),
  dot(19, 10, 1.1),
  dot(19, 15, 1.1),
  dot(22, 7.5, 0.65),
  dot(22, 12.5, 0.65),
]);
