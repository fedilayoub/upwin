import { browser } from "wxt/browser";
import type {
  BubbleSize,
  HostView,
  NormalizedRect,
} from "@/features/recording/protocol";
import {
  THEME_STORAGE_KEY,
  resolveTheme,
  type ThemePreference,
} from "@/features/theme/resolve-theme";
import {
  BUBBLE_PX,
  HANDLES,
  RATIOS,
  SHAPES,
  ZOOM_RANGE,
  BAR_GRIP,
  areaToolbarBox,
  barBox,
  clampBox,
  clampZoom,
  cogCenter,
  defaultBubble,
  denormalize,
  drawBox,
  fitRatio,
  formatZoom,
  isUsableArea,
  keepBubbleInArea,
  moveBox,
  nearestCorner,
  nearestShape,
  normalizeSelection,
  panelBox,
  ratioValue,
  resizeBox,
  type BarSize,
  type Box,
  type Handle,
  type Point,
  type RatioId,
  type ShapeId,
} from "@/features/recording/host-layout";
import {
  MARKER_ALPHA,
  MARKER_DEVICE_SIZE,
  MARKER_STEP_MS,
  MARKER_TINTS,
} from "@/features/recording/engine/marker-colors";

/**
 * The recorder's in-page host. Injected with `scripting.executeScript` under `activeTab`
 * after a toolbar click, the shortcut, or a Record button.
 *
 * It only lays out the recorder's own UI: a closed shadow root with two extension iframes (the
 * bar and the camera bubble), drag handles, the countdown and the area overlay. It reads nothing
 * from the page, and no media ever runs here or in the iframes (see the offscreen preview).
 */
const strings = {
  en: {
    areaDraw: "Drag to select the area to record",
    areaAdjust: "Drag to move, pull a handle to resize",
    areaKeys: { record: "record", cancel: "cancel" },
    record: "Record",
    recordArea: "Record this area",
    starting: "Starting…",
    cancel: "Cancel",
    ratio: "Aspect ratio",
    free: "Free",
    tooSmall: "Too small",
    move: "Move",
    size: { sm: "Small camera", md: "Medium camera", lg: "Large camera" },
    skip: "Skip countdown",
    settings: "Camera settings",
    camera: "Camera",
    sizeLabel: "Size",
    shapeLabel: "Shape",
    shapes: {
      square: "Square",
      rounded: "Rounded",
      soft: "Soft",
      circle: "Circle",
    },
    zoom: "Zoom",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    blur: "Background blur",
    hint: "Scroll on the camera to zoom",
    reset: "Reset",
    close: "Close",
  },
  fr: {
    areaDraw: "Faites glisser pour choisir la zone à enregistrer",
    areaAdjust: "Glissez pour déplacer, tirez une poignée pour redimensionner",
    areaKeys: { record: "enregistrer", cancel: "annuler" },
    record: "Enregistrer",
    recordArea: "Enregistrer cette zone",
    starting: "Démarrage…",
    cancel: "Annuler",
    ratio: "Format",
    free: "Libre",
    tooSmall: "Trop petit",
    move: "Déplacer",
    size: { sm: "Petite caméra", md: "Caméra moyenne", lg: "Grande caméra" },
    skip: "Passer le compte à rebours",
    settings: "Réglages de la caméra",
    camera: "Caméra",
    sizeLabel: "Taille",
    shapeLabel: "Forme",
    shapes: {
      square: "Carré",
      rounded: "Arrondi",
      soft: "Doux",
      circle: "Cercle",
    },
    zoom: "Zoom",
    zoomIn: "Zoom avant",
    zoomOut: "Zoom arrière",
    blur: "Flou d’arrière-plan",
    hint: "Faites défiler sur la caméra pour zoomer",
    reset: "Réinitialiser",
    close: "Fermer",
  },
} as const;
type Copy = (typeof strings)["en" | "fr"];

/** Lucide paths (settings, x, minus, plus), built with createElementNS: no innerHTML on pages. */
const ICONS = {
  gear: [
    [
      "path",
      {
        d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
      },
    ],
    ["circle", { cx: "12", cy: "12", r: "3" }],
  ],
  x: [
    ["path", { d: "M18 6 6 18" }],
    ["path", { d: "m6 6 12 12" }],
  ],
  minus: [["path", { d: "M5 12h14" }]],
  plus: [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "M12 5v14" }],
  ],
} as const satisfies Record<
  string,
  readonly (readonly [string, Record<string, string>])[]
>;
function icon(name: keyof typeof ICONS): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }))
    svg.setAttribute(k, v);
  for (const [tag, attrs] of ICONS[name]) {
    const child = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) child.setAttribute(k, v);
    svg.append(child);
  }
  return svg;
}

/**
 * The camera settings' styles. A constructable sheet adopted by the shadow root: CSSOM, so a
 * page's `style-src` cannot block it, and nothing leaks in or out of the shadow root.
 */
const PANEL_CSS = `
.layer{--g:oklch(0.88 0.1 138);--on-g:#18181b;--sel:oklch(0.88 0.1 138);--ease:cubic-bezier(.2,.8,.2,1);
  --sf:rgba(24,24,27,.97);--bar:oklch(0.205 0 0);--fg:#fafafa;--fg2:#e4e4e7;--fg3:#d4d4d8;--mut:#a1a1aa;--mut2:#71717a;
  --t:255,255,255;--edge:rgba(255,255,255,.08);--hover:#3f3f46;--warn:#fbbf24;--cd:rgba(24,24,27,.82);
  --swatch:linear-gradient(140deg,#d4d4d8,#71717a);--sh1:0 18px 50px rgba(0,0,0,.45);--sh2:0 8px 24px rgba(0,0,0,.3)}
.layer[data-theme=light]{--g:oklch(0.28 0.12 155);--on-g:oklch(0.985 0.015 150);--sel:oklch(0.55 0.16 152);
  --sf:rgba(255,255,255,.98);--bar:#fff;--fg:#18181b;--fg2:#27272a;--fg3:#3f3f46;--mut:#71717a;--mut2:#a1a1aa;
  --t:24,24,27;--edge:rgba(24,24,27,.1);--hover:#f4f4f5;--warn:#b45309;--cd:rgba(255,255,255,.9);
  --swatch:linear-gradient(140deg,#a1a1aa,#52525b);--sh1:0 18px 50px rgba(0,0,0,.16);--sh2:0 8px 24px rgba(0,0,0,.12)}
.cog{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;padding:0;border:0;border-radius:50%;
  display:grid;place-items:center;cursor:pointer;color:var(--fg);background:var(--sf);
  box-shadow:var(--sh2),0 0 0 1px rgba(var(--t),.14);opacity:0;transform:scale(.6);
  pointer-events:none;transition:opacity .15s ease,transform .2s var(--ease),background .15s,color .15s,left .22s var(--ease),top .22s var(--ease)}
.cog.show{opacity:1;transform:scale(1);pointer-events:auto}
.cog:hover{background:var(--hover)}
.cog svg{width:16px;height:16px;transition:transform .4s var(--ease)}
.cog[aria-expanded=true]{background:var(--g);color:var(--on-g)}
.cog[aria-expanded=true] svg{transform:rotate(90deg)}
.panel{position:fixed;display:none;width:248px;box-sizing:border-box;padding:14px 14px 10px;border-radius:18px;
  background:var(--sf);color:var(--fg);pointer-events:auto;
  font:500 12px/1.3 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  box-shadow:var(--sh1),0 0 0 1px var(--edge);
  opacity:0;transform:translateY(6px) scale(.97);transition:opacity .16s ease,transform .2s var(--ease),left .22s var(--ease),top .22s var(--ease)}
.panel.open{opacity:1;transform:none}
.panel button{font:inherit;color:inherit;margin:0}
.panel :focus-visible,.cog:focus-visible{outline:2px solid var(--g);outline-offset:2px}
.head{display:flex;align-items:center;justify-content:space-between}
.title{font-weight:650;font-size:13px}
.field{margin-top:14px}
.label{display:block;margin-bottom:7px;color:var(--mut);font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase}
.label-row{display:flex;align-items:baseline;justify-content:space-between}
.value{color:var(--fg);font-size:12px;font-weight:650;font-variant-numeric:tabular-nums}
.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:3px;border-radius:12px;background:rgba(var(--t),.06)}
.seg button{height:28px;border:0;border-radius:9px;background:transparent;color:var(--fg3);font-weight:650;cursor:pointer;transition:background .15s,color .15s}
.seg button:hover{background:rgba(var(--t),.08)}
.seg button[aria-pressed=true]{background:var(--g);color:var(--on-g)}
.shapes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.shape{height:46px;padding:0;border:0;border-radius:12px;display:grid;place-items:center;cursor:pointer;
  background:rgba(var(--t),.06);transition:background .15s,box-shadow .15s}
.shape:hover{background:rgba(var(--t),.11)}
.swatch{width:22px;height:22px;background:var(--swatch);transition:background .2s}
.shape[aria-pressed=true]{background:color-mix(in oklch,var(--g) 14%,transparent);box-shadow:inset 0 0 0 1.5px var(--g)}
.shape[aria-pressed=true] .swatch{background:var(--g)}
.zoom{display:flex;align-items:center;gap:8px}
.icon-btn{width:28px;height:28px;flex:none;padding:0;border:0;border-radius:9px;display:grid;place-items:center;
  background:rgba(var(--t),.06);color:var(--fg2);cursor:pointer;transition:background .15s,opacity .15s}
.icon-btn:hover:not(:disabled){background:rgba(var(--t),.13)}
.icon-btn:disabled{opacity:.3;cursor:default}
.icon-btn svg{width:14px;height:14px}
.slider{-webkit-appearance:none;appearance:none;flex:1;min-width:0;height:4px;margin:0;border-radius:999px;cursor:pointer;outline-offset:6px;
  background:linear-gradient(to right,var(--g) var(--p,0%),rgba(var(--t),.16) var(--p,0%))}
.slider::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;
  box-shadow:0 2px 6px rgba(0,0,0,.45);transition:transform .12s,box-shadow .12s}
.slider:hover::-webkit-slider-thumb{transform:scale(1.12)}
.slider:active::-webkit-slider-thumb{box-shadow:0 0 0 6px color-mix(in oklch,var(--g) 28%,transparent),0 2px 6px rgba(0,0,0,.45)}
.row{display:flex;align-items:center;justify-content:space-between;margin-top:14px}
.row .label{margin:0}
.switch{position:relative;width:36px;height:20px;padding:0;border:0;border-radius:999px;cursor:pointer;background:rgba(var(--t),.2);transition:background .18s}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s var(--ease)}
.switch[aria-checked=true]{background:var(--g)}
.switch[aria-checked=true]::after{transform:translateX(16px)}
.foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px;padding-top:9px;border-top:1px solid var(--edge)}
.hint{color:var(--mut2);font-size:10.5px}
.reset{flex:none;padding:4px 8px;border:0;border-radius:8px;background:none;color:var(--fg3);font-weight:600;cursor:pointer}
.reset:hover{background:rgba(var(--t),.08)}
.area{position:fixed;inset:0;display:none;pointer-events:auto;cursor:crosshair;background:rgba(9,9,11,.5);touch-action:none}
.area.has-sel{background:transparent}
.area-hint{position:fixed;top:18px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:6px;padding:8px 14px;
  border-radius:999px;background:var(--sf);color:var(--fg2);white-space:nowrap;pointer-events:none;
  font:500 12.5px/1.2 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  box-shadow:var(--sh2),0 0 0 1px var(--edge)}
.area-hint.show{display:flex}
.area-hint b{color:var(--fg);font-weight:600}
.area-hint kbd{margin-left:6px;padding:2px 6px;border-radius:6px;background:rgba(var(--t),.12);color:var(--fg);font:600 11px ui-sans-serif,system-ui}
.sel{position:fixed;display:none;box-sizing:border-box;border:1.5px solid var(--sel);border-radius:3px;cursor:move;
  box-shadow:0 0 0 9999px rgba(9,9,11,.55)}
.sel.drawing{cursor:crosshair}
.sel.drawing .handle{display:none}
.handle{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;box-sizing:border-box;border-radius:50%;
  background:#fff;border:2px solid var(--sel);box-shadow:0 1px 4px rgba(0,0,0,.45)}
.handle::after{content:"";position:absolute;inset:-9px}
.h-nw{left:0;top:0;cursor:nwse-resize}.h-n{left:50%;top:0;cursor:ns-resize}.h-ne{left:100%;top:0;cursor:nesw-resize}
.h-e{left:100%;top:50%;cursor:ew-resize}.h-se{left:100%;top:100%;cursor:nwse-resize}.h-s{left:50%;top:100%;cursor:ns-resize}
.h-sw{left:0;top:100%;cursor:nesw-resize}.h-w{left:0;top:50%;cursor:ew-resize}
.sel-size{position:absolute;left:-1.5px;top:-30px;padding:3px 8px;border-radius:7px;background:var(--sf);color:var(--fg);
  font:600 11.5px ui-sans-serif,system-ui;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}
.sel-size.inside{top:8px;left:8px}
.sel-size.small{color:var(--warn)}
.area-bar{position:fixed;display:none;align-items:center;gap:6px;padding:6px;border-radius:16px;pointer-events:auto;
  background:var(--sf);color:var(--fg);font:500 12.5px ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  box-shadow:var(--sh1),0 0 0 1px var(--edge)}
.area-bar.show{display:flex}
.area-bar button{font:inherit;margin:0}
.area-bar :focus-visible{outline:2px solid var(--g);outline-offset:2px}
.ratios{display:flex;gap:2px;padding:3px;border-radius:11px;background:rgba(var(--t),.06)}
.ratios button{height:28px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--mut);font-weight:600;cursor:pointer;transition:background .15s,color .15s}
.ratios button:hover{background:rgba(var(--t),.08);color:var(--fg)}
.ratios button[aria-pressed=true]{background:rgba(var(--t),.12);color:var(--fg)}
.divider{width:1px;height:22px;margin:0 2px;background:rgba(var(--t),.12)}
.ghost{height:34px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:var(--fg2);font-weight:600;cursor:pointer}
.ghost:hover{background:rgba(var(--t),.08)}
.rec{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px 0 12px;border:0;border-radius:10px;
  background:var(--g);color:var(--on-g);font-weight:700;cursor:pointer;transition:filter .15s,opacity .15s}
.rec:hover:not(:disabled){filter:brightness(1.07)}
.rec:disabled{opacity:.45;cursor:default}
.rec.busy{opacity:1}
.rec .dot{width:9px;height:9px;border-radius:50%;background:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.22)}
.rec.busy .dot{animation:upwin-pulse 1s ease-in-out infinite}
@keyframes upwin-pulse{50%{opacity:.3}}
`;

const GLOBAL = "__upwinRecorderHost";
const EASE = "cubic-bezier(.2,.8,.2,1)";
// Hand-written guards: this script is injected on every toolbar click, so it stays free of zod.
const SIZES: readonly BubbleSize[] = ["sm", "md", "lg"];
const isSize = (value: unknown): value is BubbleSize =>
  SIZES.includes(value as BubbleSize);
function parseView(raw: unknown): HostView | "close" | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (m.type === "close") return "close";
  if (
    m.type !== "view" ||
    typeof m.bar !== "boolean" ||
    typeof m.bubble !== "boolean" ||
    typeof m.selectArea !== "boolean" ||
    typeof m.setup !== "boolean" ||
    typeof m.countdown !== "number" ||
    !Number.isInteger(m.countdown) ||
    m.countdown < 0 ||
    m.countdown > 3
  )
    return null;
  return {
    type: "view",
    bar: m.bar,
    bubble: m.bubble,
    countdown: m.countdown,
    selectArea: m.selectArea,
    setup: m.setup,
    marker: m.marker === true,
  };
}
interface HostHandle {
  reconnect(): void;
}

export default defineUnlistedScript(() => {
  const scope = globalThis as unknown as Record<string, HostHandle | undefined>;
  const existing = scope[GLOBAL];
  if (existing) {
    existing.reconnect();
    return;
  }
  scope[GLOBAL] = mount();
});

function css(element: HTMLElement, style: Partial<CSSStyleDeclaration>) {
  Object.assign(element.style, style);
  return element;
}
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration> = {},
): HTMLElementTagNameMap[K] {
  return css(document.createElement(tag), style) as HTMLElementTagNameMap[K];
}
const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

function mount(): HostHandle {
  let copy: Copy = strings.en;
  void browser.storage.sync
    .get("locale-preference")
    .then((value) => {
      const preferred = value["locale-preference"];
      const language =
        typeof preferred === "string" ? preferred : navigator.language;
      copy = language.toLowerCase().startsWith("fr") ? strings.fr : strings.en;
      renderCopy();
    })
    .catch(() => undefined);

  const hostElement = document.createElement("upwin-recorder");
  hostElement.setAttribute("style", "all: initial !important;");
  const root = hostElement.attachShadow({ mode: "closed" });
  const layer = el("div", {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2147483647",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  });
  root.append(layer);
  // The side panel's theme setting, followed live: switching it repaints this UI and the bar.
  layer.className = "layer";
  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
  let themePreference: ThemePreference = "system";
  const applyTheme = () => {
    layer.dataset.theme = resolveTheme(themePreference, darkScheme.matches);
  };
  const readTheme = (value: unknown) => {
    themePreference = value === "light" || value === "dark" ? value : "system";
    applyTheme();
  };
  applyTheme();
  void browser.storage.sync
    .get(THEME_STORAGE_KEY)
    .then((value) => readTheme(value[THEME_STORAGE_KEY]))
    .catch(() => undefined);
  darkScheme.addEventListener("change", applyTheme);

  // ---- Bar: the setup bar, the recording pill and the result, all in one extension frame.
  const bar = el("div", {
    position: "fixed",
    display: "flex",
    alignItems: "stretch",
    pointerEvents: "auto",
    borderRadius: "18px",
    boxShadow: "var(--sh1), 0 0 0 1px var(--edge)",
    background: "var(--bar)",
    overflow: "hidden",
    opacity: "0",
    transform: "translateY(8px)",
    transition: `left .22s ${EASE}, top .22s ${EASE}, opacity .2s ease, transform .2s ${EASE}`,
  });
  const barGrip = el("div", {
    width: "14px",
    cursor: "grab",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(var(--t),.35)",
    fontSize: "10px",
    userSelect: "none",
    letterSpacing: "-1px",
  });
  barGrip.textContent = "⋮⋮";
  barGrip.setAttribute("role", "button");
  const barFrame = el("iframe", {
    border: "0",
    width: "640px",
    height: "72px",
    display: "block",
    colorScheme: "normal",
    background: "transparent",
    transition: `width .22s ${EASE}, height .22s ${EASE}`,
  });
  barFrame.setAttribute("allow", "clipboard-write");
  barFrame.setAttribute("title", "UpWin recorder");
  barFrame.src = browser.runtime.getURL("/recorder-bar.html");
  bar.append(barGrip, barFrame);

  // ---- Camera bubble: video only. The frame never receives pointer events; the host drags it.
  const bubble = el("div", {
    position: "fixed",
    pointerEvents: "auto",
    display: "none",
    opacity: "0",
    transform: "scale(.85)",
    transformOrigin: "center",
    transition: `opacity .2s ease, transform .22s ${EASE}, left .22s ${EASE}, top .22s ${EASE}, width .22s ${EASE}, height .22s ${EASE}`,
  });
  const bubbleClip = el("div", {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    overflow: "hidden",
    // No border: with the page layer this exact shape is what the video records.
    boxShadow: "0 10px 30px rgba(0,0,0,.35)",
    background: "#111",
    cursor: "grab",
    transition: "border-radius .12s ease",
  });
  const bubbleFrame = el("iframe", {
    border: "0",
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "none",
  });
  bubbleFrame.setAttribute("title", "Camera preview");
  bubbleFrame.setAttribute("tabindex", "-1");
  bubbleFrame.style.transformOrigin = "center";
  bubbleFrame.style.transition = "transform .12s ease";
  bubbleClip.append(bubbleFrame);

  // ---- Camera settings: a cog on the bubble's edge opens a panel with size, shape, zoom and,
  // before recording, the background blur.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(PANEL_CSS);
  root.adoptedStyleSheets = [sheet];
  const node = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
  ) => {
    const element = document.createElement(tag);
    element.className = className;
    if (element instanceof HTMLButtonElement) element.type = "button";
    return element;
  };
  const cog = node("button", "cog");
  cog.append(icon("gear"));
  cog.setAttribute("aria-haspopup", "dialog");
  cog.setAttribute("aria-expanded", "false");
  bubble.append(bubbleClip, cog);

  const panel = node("div", "panel");
  panel.setAttribute("role", "dialog");
  const head = node("div", "head");
  const title = node("span", "title");
  const close = node("button", "icon-btn");
  close.append(icon("x"));
  head.append(title, close);

  const sizeField = node("div", "field");
  const sizeLabel = node("span", "label");
  const seg = node("div", "seg");
  const sizeButtons = SIZES.map((size) => {
    const button = node("button", "");
    button.textContent = size === "sm" ? "S" : size === "md" ? "M" : "L";
    button.addEventListener("click", () => setBubbleSize(size));
    seg.append(button);
    return { size, button };
  });
  sizeField.append(sizeLabel, seg);

  const shapeField = node("div", "field");
  const shapeLabel = node("span", "label");
  const shapes = node("div", "shapes");
  const shapeButtons = SHAPES.map(({ id, roundness }) => {
    const button = node("button", "shape");
    const swatch = node("span", "swatch");
    swatch.style.borderRadius = `${Math.round(roundness * 50)}%`;
    button.append(swatch);
    button.addEventListener("click", () => {
      bubbleRoundness = roundness;
      applyShape();
      reportBubble();
    });
    shapes.append(button);
    return { id, button };
  });
  shapeField.append(shapeLabel, shapes);

  const zoomField = node("div", "field");
  const zoomHead = node("div", "label-row");
  const zoomLabel = node("span", "label");
  const zoomValue = node("span", "value");
  zoomHead.append(zoomLabel, zoomValue);
  const zoomRow = node("div", "zoom");
  const zoomOut = node("button", "icon-btn");
  zoomOut.append(icon("minus"));
  const zoomIn = node("button", "icon-btn");
  zoomIn.append(icon("plus"));
  const zoomInput = node("input", "slider");
  zoomInput.type = "range";
  zoomInput.min = String(ZOOM_RANGE.min * 100);
  zoomInput.max = String(ZOOM_RANGE.max * 100);
  zoomInput.step = "5";
  zoomRow.append(zoomOut, zoomInput, zoomIn);
  zoomField.append(zoomHead, zoomRow);

  const blurRow = node("div", "row");
  const blurLabel = node("span", "label");
  const blurSwitch = node("button", "switch");
  blurSwitch.setAttribute("role", "switch");
  blurRow.append(blurLabel, blurSwitch);

  const foot = node("div", "foot");
  const hint = node("span", "hint");
  const reset = node("button", "reset");
  foot.append(hint, reset);
  panel.append(head, sizeField, shapeField, zoomField, blurRow, foot);

  let bubbleRoundness = 1;
  let bubbleZoom = 1;
  let blurOn = false;
  let panelOpen = false;
  function applyShape() {
    bubbleClip.style.borderRadius = `${Math.round(bubbleRoundness * 50)}%`;
    const current: ShapeId = nearestShape(bubbleRoundness);
    for (const { id, button } of shapeButtons)
      button.setAttribute("aria-pressed", String(id === current));
    placeCog();
  }
  function applyZoom() {
    bubbleFrame.style.transform = `scale(${bubbleZoom})`;
    zoomInput.value = String(Math.round(bubbleZoom * 100));
    zoomInput.style.setProperty(
      "--p",
      `${((bubbleZoom - ZOOM_RANGE.min) / (ZOOM_RANGE.max - ZOOM_RANGE.min)) * 100}%`,
    );
    zoomValue.textContent = formatZoom(bubbleZoom);
    zoomOut.disabled = bubbleZoom <= ZOOM_RANGE.min;
    zoomIn.disabled = bubbleZoom >= ZOOM_RANGE.max;
  }
  let zoomReport: ReturnType<typeof setTimeout> | undefined;
  function setZoom(zoom: number) {
    const next = clampZoom(zoom);
    if (next === bubbleZoom) return;
    bubbleZoom = next;
    applyZoom();
    // Reported once the gesture settles: the worker and storage do not need every step.
    clearTimeout(zoomReport);
    zoomReport = setTimeout(reportBubble, 250);
  }
  zoomInput.addEventListener("input", () =>
    setZoom(Number(zoomInput.value) / 100),
  );
  zoomOut.addEventListener("click", () =>
    setZoom(bubbleZoom - ZOOM_RANGE.step),
  );
  zoomIn.addEventListener("click", () => setZoom(bubbleZoom + ZOOM_RANGE.step));
  // While the panel is open, scrolling on the camera zooms it.
  bubble.addEventListener(
    "wheel",
    (event) => {
      if (!panelOpen) return;
      event.preventDefault();
      setZoom(bubbleZoom - event.deltaY * 0.004);
    },
    { passive: false },
  );
  function renderBlur() {
    blurSwitch.setAttribute("aria-checked", String(blurOn));
  }
  // The blur belongs to the bar's preferences; the bar follows this key too.
  blurSwitch.addEventListener("click", () => {
    void browser.storage.local
      .get("recording.bar")
      .then((value) => {
        const stored: unknown = value["recording.bar"];
        const base =
          typeof stored === "object" && stored !== null ? stored : {};
        return browser.storage.local.set({
          "recording.bar": { ...base, blur: !blurOn },
        });
      })
      .catch(() => undefined);
  });
  const onStorage = (
    changes: Record<string, Browser.storage.StorageChange>,
    areaName: string,
  ) => {
    const theme = changes[THEME_STORAGE_KEY];
    if (areaName === "sync" && theme) readTheme(theme.newValue);
    const change = changes["recording.bar"];
    if (areaName !== "local" || !change) return;
    const next: unknown = change.newValue;
    blurOn =
      typeof next === "object" &&
      next !== null &&
      (next as { blur?: unknown }).blur === true;
    renderBlur();
  };
  browser.storage.onChanged.addListener(onStorage);
  reset.addEventListener("click", () => {
    bubbleSize = "md";
    bubbleRoundness = 1;
    bubbleZoom = 1;
    applyShape();
    applyZoom();
    reportBubble();
  });

  function showCog(show: boolean) {
    cog.classList.toggle("show", show || panelOpen);
  }
  function placeCog() {
    const c = cogCenter(BUBBLE_PX[bubbleSize], bubbleRoundness);
    css(cog, { left: `${c.x}px`, top: `${c.y}px` });
  }
  function placePanel() {
    if (!panelOpen) return;
    const point = panelBox(
      bubbleBox,
      { w: panel.offsetWidth, h: panel.offsetHeight },
      viewport(),
    );
    css(panel, { left: `${point.x}px`, top: `${point.y}px` });
  }
  let panelHide: ReturnType<typeof setTimeout> | undefined;
  function openPanel(open: boolean) {
    if (open === panelOpen) return;
    panelOpen = open;
    cog.setAttribute("aria-expanded", String(open));
    clearTimeout(panelHide);
    if (open) {
      panel.style.display = "block";
      placePanel();
      void panel.offsetWidth; // Start the transition from the closed style.
      panel.classList.add("open");
    } else {
      panel.classList.remove("open");
      panelHide = setTimeout(() => {
        if (!panelOpen) panel.style.display = "none";
      }, 200);
    }
    showCog(bubble.matches(":hover"));
  }
  cog.addEventListener("click", () => openPanel(!panelOpen));
  close.addEventListener("click", () => {
    openPanel(false);
    cog.focus();
  });
  // Keys typed in the panel never reach the page (the slider takes arrow keys). Esc closes it.
  panel.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      openPanel(false);
      cog.focus();
    }
  });
  bubble.addEventListener("mouseenter", () => showCog(true));
  bubble.addEventListener("mouseleave", () => showCog(false));
  bubble.addEventListener("focusin", () => showCog(true));
  // A click anywhere else closes the panel. Clicks inside the shadow root are checked here;
  // the page only ever sees the host element as their target.
  root.addEventListener("pointerdown", (event) => {
    const path = event.composedPath();
    if (panelOpen && !path.includes(panel) && !path.includes(cog))
      openPanel(false);
  });
  const onPagePointer = (event: PointerEvent) => {
    if (panelOpen && event.target !== hostElement) openPanel(false);
  };
  window.addEventListener("pointerdown", onPagePointer, true);

  // ---- Countdown: click anywhere on it to start now.
  const countdown = el("button", {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%,-50%)",
    width: "168px",
    height: "168px",
    borderRadius: "50%",
    border: "0",
    display: "none",
    pointerEvents: "auto",
    cursor: "pointer",
    background: "var(--cd)",
    color: "var(--fg)",
    font: "700 88px/1 system-ui",
    boxShadow: "0 20px 60px rgba(0,0,0,.4)",
    transition: `opacity .18s ease, transform .25s ${EASE}`,
  });
  countdown.type = "button";
  countdown.setAttribute("aria-live", "assertive");
  countdown.addEventListener("click", () => send({ type: "skip-countdown" }));

  // ---- Area editor: draw, move, resize, pick a ratio, record. The camera stays visible and
  // snaps inside the area, so what is on screen is what gets recorded.
  const area = node("div", "area");
  let areaOpen = false;
  let selBox: Box | null = null;
  let ratio: RatioId = "free";
  let drag: Drag | null = null;
  // The area sent to the worker. The editor stays on screen until the worker moves on, and the
  // message is sent again after a reconnect (a stopped worker must not lose the click).
  let areaMessage: { type: "area"; rect: NormalizedRect | null } | null = null;
  let resendArea = false;
  const areaHint = node("div", "area-hint");
  const sel = node("div", "sel");
  for (const handle of HANDLES) {
    const knob = node("span", `handle h-${handle}`);
    knob.dataset.handle = handle;
    sel.append(knob);
  }
  const sizeTag = node("span", "sel-size");
  sel.append(sizeTag);
  area.append(sel);
  const areaBar = node("div", "area-bar");
  const ratios = node("div", "ratios");
  ratios.setAttribute("role", "group");
  const ratioButtons = RATIOS.map(({ id, label }) => {
    const button = node("button", "");
    button.textContent = label;
    button.addEventListener("click", () => setRatio(id));
    ratios.append(button);
    return { id, button };
  });
  const cancelArea = node("button", "ghost");
  const recordArea = node("button", "rec");
  const recordLabel = node("span", "");
  recordArea.append(node("span", "dot"), recordLabel);
  areaBar.append(ratios, node("span", "divider"), cancelArea, recordArea);
  const marker = el("div", {
    position: "fixed",
    display: "none",
    pointerEvents: "none",
    // The bar's corners.
    borderRadius: "18px",
  });
  marker.setAttribute("aria-hidden", "true");
  layer.append(area, areaHint, bubble, panel, areaBar, bar, marker, countdown);

  function renderCopy() {
    cancelArea.textContent = copy.cancel;
    recordArea.setAttribute("aria-label", copy.recordArea);
    ratios.setAttribute("aria-label", copy.ratio);
    const free = ratioButtons.find(({ id }) => id === "free");
    if (free) free.button.textContent = copy.free;
    if (areaOpen) renderArea();
    barGrip.setAttribute("aria-label", copy.move);
    countdown.setAttribute("aria-label", copy.skip);
    for (const { size, button } of sizeButtons)
      button.setAttribute("aria-label", copy.size[size]);
    cog.setAttribute("aria-label", copy.settings);
    panel.setAttribute("aria-label", copy.settings);
    title.textContent = copy.camera;
    close.setAttribute("aria-label", copy.close);
    sizeLabel.textContent = copy.sizeLabel;
    shapeLabel.textContent = copy.shapeLabel;
    for (const { id, button } of shapeButtons) {
      button.setAttribute("aria-label", copy.shapes[id]);
      button.title = copy.shapes[id];
    }
    zoomLabel.textContent = copy.zoom;
    zoomInput.setAttribute("aria-label", copy.zoom);
    zoomOut.setAttribute("aria-label", copy.zoomOut);
    zoomIn.setAttribute("aria-label", copy.zoomIn);
    blurLabel.textContent = copy.blur;
    blurSwitch.setAttribute("aria-label", copy.blur);
    hint.textContent = copy.hint;
    reset.textContent = copy.reset;
  }
  renderCopy();

  // ---- Positions, remembered across pages.
  let barPoint: Point | null = null;
  // Target frame size: the frame animates toward it, so offsetWidth is not reliable mid-way.
  const frameSize: BarSize = { w: 640, h: 72, rest: 640, full: 640 };
  let bubblePoint: Point | null = null;
  let bubbleSize: BubbleSize = "md";
  let bubbleBox: Box = { x: 0, y: 0, w: BUBBLE_PX.md, h: BUBBLE_PX.md };
  function placeBar() {
    const point = barBox(barPoint, frameSize, viewport());
    css(bar, { left: `${point.x}px`, top: `${point.y}px` });
  }
  function placeBubble() {
    const d = BUBBLE_PX[bubbleSize];
    const point = bubblePoint ?? defaultBubble(bubbleSize, viewport());
    const clamped = clampBox({ ...point, w: d, h: d }, viewport());
    css(bubble, {
      left: `${clamped.x}px`,
      top: `${clamped.y}px`,
      width: `${d}px`,
      height: `${d}px`,
    });
    for (const { size, button } of sizeButtons)
      button.setAttribute("aria-pressed", String(size === bubbleSize));
    bubbleBox = { ...clamped, w: d, h: d };
    placeCog();
    placePanel();
    return bubbleBox;
  }
  function reportBubble() {
    const box = placeBubble();
    send({
      type: "bubble",
      corner: nearestCorner(box, viewport()),
      size: bubbleSize,
      roundness: bubbleRoundness,
      zoom: bubbleZoom,
    });
    void browser.storage.local
      .set({
        "recording.bubbleLayout": {
          x: box.x / viewport().w,
          y: box.y / viewport().h,
          size: bubbleSize,
          roundness: bubbleRoundness,
          zoom: bubbleZoom,
        },
      })
      .catch(() => undefined);
  }
  function setBubbleSize(size: BubbleSize) {
    bubbleSize = size;
    reportBubble();
  }
  void browser.storage.local
    .get(["recording.bubbleLayout", "recording.barLayout", "recording.bar"])
    .then((value) => {
      const saved = value["recording.bubbleLayout"] as
        | {
            x?: unknown;
            y?: unknown;
            size?: unknown;
            roundness?: unknown;
            zoom?: unknown;
          }
        | undefined;
      if (isSize(saved?.size)) bubbleSize = saved.size;
      if (
        typeof saved?.roundness === "number" &&
        Number.isFinite(saved.roundness)
      )
        bubbleRoundness = Math.min(1, Math.max(0, saved.roundness));
      if (typeof saved?.zoom === "number") bubbleZoom = clampZoom(saved.zoom);
      applyShape();
      applyZoom();
      const bar = value["recording.bar"] as { blur?: unknown } | undefined;
      blurOn = bar?.blur === true;
      renderBlur();
      if (typeof saved?.x === "number" && typeof saved.y === "number")
        bubblePoint = { x: saved.x * viewport().w, y: saved.y * viewport().h };
      const savedBar = value["recording.barLayout"] as
        { x?: unknown; y?: unknown } | undefined;
      if (typeof savedBar?.x === "number" && typeof savedBar.y === "number")
        barPoint = {
          x: savedBar.x * viewport().w,
          y: savedBar.y * viewport().h,
        };
      placeBar();
      reportBubble();
    })
    .catch(() => undefined);

  function draggable(
    handle: HTMLElement,
    target: HTMLElement,
    onMove: (point: Point) => void,
    onDrop: () => void,
  ) {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const rect = target.getBoundingClientRect();
      const offset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      handle.setPointerCapture(event.pointerId);
      handle.style.cursor = "grabbing";
      const transition = target.style.transition;
      target.style.transition = "none";
      const move = (e: PointerEvent) =>
        onMove({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        handle.style.cursor = "grab";
        target.style.transition = transition;
        onDrop();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }
  draggable(
    barGrip,
    bar,
    (point) => {
      barPoint = point;
      placeBar();
    },
    () => {
      if (barPoint)
        void browser.storage.local
          .set({
            "recording.barLayout": {
              x: barPoint.x / viewport().w,
              y: barPoint.y / viewport().h,
            },
          })
          .catch(() => undefined);
    },
  );
  draggable(
    bubbleClip,
    bubble,
    (point) => {
      bubblePoint = point;
      placeBubble();
    },
    reportBubble,
  );
  const reportViewport = () =>
    send({
      type: "viewport",
      viewport: {
        w: Math.round(window.innerWidth),
        h: Math.round(window.innerHeight),
        dpr: window.devicePixelRatio || 1,
        outerW: Math.round(window.outerWidth),
        screenW: Math.round(window.screen.width),
      },
    });
  const reportVisibility = () =>
    send({
      type: "visibility",
      visible: document.visibilityState === "visible",
    });
  document.addEventListener("visibilitychange", reportVisibility);
  const onResize = () => {
    placeBar();
    placeBubble();
    if (areaOpen && selBox) {
      selBox = moveBox(selBox, 0, 0, viewport());
      renderArea();
    }
    reportViewport();
  };
  window.addEventListener("resize", onResize);

  // The bar frame reports its own size. Only messages whose source is that exact frame count.
  const onFrameMessage = (event: MessageEvent) => {
    if (event.source !== barFrame.contentWindow) return;
    const data = event.data as {
      type?: unknown;
      w?: unknown;
      h?: unknown;
      rest?: unknown;
      full?: unknown;
    };
    if (
      data?.type !== "upwin-recorder:size" ||
      typeof data.w !== "number" ||
      typeof data.h !== "number"
    )
      return;
    const v = viewport();
    const width = (value: number) =>
      Math.min(v.w - 40, Math.max(120, Math.ceil(value)));
    frameSize.w = width(data.w);
    frameSize.h = Math.min(v.h - 24, Math.max(40, Math.ceil(data.h)));
    // Without and with the bar's hover controls: the bar is placed so that they open in place.
    frameSize.rest =
      typeof data.rest === "number"
        ? Math.min(frameSize.w, width(data.rest))
        : frameSize.w;
    frameSize.full =
      typeof data.full === "number"
        ? Math.max(frameSize.w, width(data.full))
        : frameSize.w;
    css(barFrame, { width: `${frameSize.w}px`, height: `${frameSize.h}px` });
    placeBar();
    // First size known: fade the bar in where it belongs.
    css(bar, { opacity: "1", transform: "translateY(0)" });
  };
  window.addEventListener("message", onFrameMessage);

  // ---- Area selection.
  type Drag =
    | { kind: "draw"; anchor: Point; previous: Box | null }
    | { kind: "move"; start: Box; from: Point }
    | { kind: "resize"; handle: Handle; start: Box };
  const hasSelection = () => !!selBox && selBox.w > 0 && selBox.h > 0;
  function areaHintText(text: string, keys: [string, string][]) {
    const label = document.createElement("b");
    label.textContent = text;
    areaHint.replaceChildren(label);
    for (const [key, action] of keys) {
      const kbd = document.createElement("kbd");
      kbd.textContent = key;
      areaHint.append(kbd, document.createTextNode(action));
    }
  }
  function renderArea() {
    const has = hasSelection();
    const box = selBox;
    const starting = areaMessage?.rect != null;
    area.classList.toggle("has-sel", has);
    sel.style.display = has ? "block" : "none";
    sel.classList.toggle("drawing", drag?.kind === "draw");
    areaHint.classList.toggle("show", areaOpen && drag === null);
    if (has && box) {
      css(sel, {
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.w}px`,
        height: `${box.h}px`,
      });
      const small = !isUsableArea(box);
      sizeTag.textContent = small
        ? `${box.w} × ${box.h} · ${copy.tooSmall}`
        : `${box.w} × ${box.h}`;
      sizeTag.classList.toggle("small", small);
      sizeTag.classList.toggle("inside", box.y < 34);
    }
    if (has)
      areaHintText(copy.areaAdjust, [
        ["Enter", ` ${copy.areaKeys.record}`],
        ["Esc", ` ${copy.areaKeys.cancel}`],
      ]);
    else areaHintText(copy.areaDraw, [["Esc", ` ${copy.areaKeys.cancel}`]]);
    const showBar = areaOpen && has && drag?.kind !== "draw";
    areaBar.classList.toggle("show", showBar);
    if (showBar && box) {
      const point = areaToolbarBox(
        box,
        { w: areaBar.offsetWidth, h: areaBar.offsetHeight },
        viewport(),
      );
      css(areaBar, { left: `${point.x}px`, top: `${point.y}px` });
    }
    for (const { id, button } of ratioButtons)
      button.setAttribute("aria-pressed", String(id === ratio));
    recordArea.disabled = !has || !box || !isUsableArea(box) || starting;
    recordArea.classList.toggle("busy", starting);
    recordLabel.textContent = starting ? copy.starting : copy.record;
  }
  function setRatio(id: RatioId) {
    ratio = id;
    const value = ratioValue(id);
    if (selBox && value) selBox = fitRatio(selBox, value, viewport());
    renderArea();
  }
  area.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || areaMessage) return;
    const target = event.target as HTMLElement;
    const point = { x: event.clientX, y: event.clientY };
    const handle = target.dataset.handle as Handle | undefined;
    if (handle && selBox) drag = { kind: "resize", handle, start: selBox };
    else if (selBox && target === sel)
      drag = { kind: "move", start: selBox, from: point };
    else {
      drag = { kind: "draw", anchor: point, previous: selBox };
      selBox = drawBox(point, point, viewport(), ratioValue(ratio));
    }
    area.setPointerCapture(event.pointerId);
    event.preventDefault();
    renderArea();
  });
  area.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const point = { x: event.clientX, y: event.clientY };
    if (drag.kind === "draw")
      selBox = drawBox(drag.anchor, point, viewport(), ratioValue(ratio));
    else if (drag.kind === "move")
      selBox = moveBox(
        drag.start,
        point.x - drag.from.x,
        point.y - drag.from.y,
        viewport(),
      );
    else
      selBox = resizeBox(
        drag.start,
        drag.handle,
        point,
        viewport(),
        ratioValue(ratio),
      );
    renderArea();
  });
  const endDrag = () => {
    if (!drag) return;
    // A click without a drag keeps the previous selection instead of wiping it.
    if (drag.kind === "draw" && selBox && (selBox.w < 8 || selBox.h < 8))
      selBox = drag.previous;
    drag = null;
    renderArea();
  };
  area.addEventListener("pointerup", endDrag);
  area.addEventListener("pointercancel", endDrag);
  function sendArea(rect: NormalizedRect | null) {
    areaMessage = { type: "area", rect };
    renderArea();
    send(areaMessage);
  }
  function submitArea() {
    if (!selBox || !isUsableArea(selBox) || areaMessage) return;
    const rect = normalizeSelection(selBox, viewport());
    void browser.storage.local
      .set({ "recording.areaLayout": { rect, ratio } })
      .catch(() => undefined);
    // The camera records with the page: it must be inside the area. It stays where the user
    // put it, pulled in only as far as needed.
    if (view.bubble) {
      const fit = keepBubbleInArea(
        { x: bubbleBox.x, y: bubbleBox.y },
        bubbleSize,
        selBox,
      );
      bubbleSize = fit.size;
      bubblePoint = fit.point;
      reportBubble();
    }
    sendArea(rect);
  }
  recordArea.addEventListener("click", submitArea);
  cancelArea.addEventListener("click", () => sendArea(null));
  // Opening: start from the last area, so recording the same region again is one click.
  function openAreaEditor() {
    areaOpen = true;
    area.style.display = "block";
    areaMessage = null;
    drag = null;
    selBox = null;
    renderArea();
    void browser.storage.local
      .get("recording.areaLayout")
      .then((value) => {
        const saved = value["recording.areaLayout"] as
          { rect?: Partial<NormalizedRect>; ratio?: unknown } | undefined;
        const r = saved?.rect;
        if (RATIOS.some(({ id }) => id === saved?.ratio))
          ratio = saved?.ratio as RatioId;
        if (
          !selBox &&
          r &&
          [r.x, r.y, r.w, r.h].every(
            (n) => typeof n === "number" && n >= 0 && n <= 1,
          )
        ) {
          const box = moveBox(
            denormalize(r as NormalizedRect, viewport()),
            0,
            0,
            viewport(),
          );
          if (isUsableArea(box)) selBox = box;
        }
        renderArea();
      })
      .catch(() => undefined);
  }
  function closeAreaEditor() {
    areaOpen = false;
    area.style.display = "none";
    areaMessage = null;
    drag = null;
    selBox = null;
    renderArea();
  }
  const onKey = (event: KeyboardEvent) => {
    if (!areaOpen) return;
    const step = event.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (event.key === "Escape") sendArea(null);
    else if (event.key === "Enter") submitArea();
    else if (nudge[event.key] && selBox && !areaMessage) {
      const [dx, dy] = nudge[event.key]!;
      selBox = moveBox(selBox, dx, dy, viewport());
      renderArea();
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("keydown", onKey, true);

  // ---- The view the worker asks for.
  let view: HostView = {
    type: "view",
    bar: true,
    bubble: false,
    countdown: 0,
    selectArea: false,
    setup: true,
    marker: false,
  };
  let bubbleHide: ReturnType<typeof setTimeout> | undefined;
  function showBubble(show: boolean) {
    clearTimeout(bubbleHide);
    if (show) {
      if (!bubbleFrame.src)
        bubbleFrame.src = browser.runtime.getURL("/camera-bubble.html");
      const wasHidden = bubble.style.display === "none";
      bubble.style.display = "block";
      placeBubble();
      if (wasHidden) void bubble.offsetWidth; // Start the fade from the hidden style.
      css(bubble, { opacity: "1", transform: "scale(1)" });
      return;
    }
    if (bubble.style.display === "none") return;
    openPanel(false);
    css(bubble, { opacity: "0", transform: "scale(.85)" });
    // Release the camera frame once the fade is over.
    bubbleHide = setTimeout(() => {
      bubble.style.display = "none";
      bubbleFrame.removeAttribute("src");
    }, 240);
  }
  // ---- The marker check (engine/marker-probe.ts). It tells whether this page is inside the
  // capture: the engine looks for the marker in the captured frames. The marker is a tint too
  // faint to notice, laid over the bar, stepping through three colors. The engine finds the
  // steps, not the colors (engine/marker-colors.ts). Shown for a moment after the pick, never
  // while recording.
  let markerTimer: ReturnType<typeof setInterval> | undefined;
  function placeMarker() {
    const v = viewport(),
      dpr = window.devicePixelRatio || 1;
    const barSize = { w: frameSize.w + BAR_GRIP, h: frameSize.h };
    const corner = barBox(barPoint, frameSize, v);
    // The bar's own box and corners, so the tint has no outline of its own. Only when the bar
    // is very small in device pixels (a strong zoom-out) does the patch grow past it, to stay
    // large enough in the capture.
    const w = Math.min(v.w, Math.max(barSize.w, MARKER_DEVICE_SIZE.w / dpr)),
      h = Math.min(v.h, Math.max(barSize.h, MARKER_DEVICE_SIZE.h / dpr));
    const clamp = (value: number, max: number) =>
      Math.min(Math.max(0, max), Math.max(0, value));
    css(marker, {
      width: `${w}px`,
      height: `${h}px`,
      left: `${clamp(corner.x + barSize.w / 2 - w / 2, v.w - w)}px`,
      top: `${clamp(corner.y + barSize.h / 2 - h / 2, v.h - h)}px`,
    });
  }
  function showMarker(show: boolean) {
    if (!show) {
      clearInterval(markerTimer);
      markerTimer = undefined;
      marker.style.display = "none";
      return;
    }
    marker.style.display = "block";
    placeMarker();
    if (markerTimer !== undefined) return;
    // The set that suits the bar: a dark bar takes a little light, a light one gives a little.
    const tints =
      MARKER_TINTS[layer.dataset.theme === "light" ? "light" : "dark"];
    let step = 0;
    const paint = () => {
      const [r, g, b] = tints[step++ % tints.length]!;
      marker.style.background = `rgba(${r},${g},${b},${MARKER_ALPHA})`;
      placeMarker();
    };
    paint();
    markerTimer = setInterval(paint, MARKER_STEP_MS);
    // Painted, on a page that is showing: only then does "not found" mean "not captured".
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (markerTimer !== undefined && document.visibilityState === "visible")
          send({ type: "marker-shown" });
      }),
    );
  }
  function render() {
    bar.style.display = view.bar ? "flex" : "none";
    // The blur is chosen before recording starts; size, shape and zoom work live.
    blurRow.style.display = view.setup ? "flex" : "none";
    placePanel();
    showBubble(view.bubble);
    showMarker(view.marker);
    if (view.countdown > 0) {
      const wasHidden = countdown.style.display === "none";
      countdown.style.display = "block";
      if (wasHidden) {
        css(countdown, {
          opacity: "0",
          transform: "translate(-50%,-50%) scale(.8)",
        });
        void countdown.offsetWidth;
      }
      css(countdown, {
        opacity: "1",
        transform: "translate(-50%,-50%) scale(1)",
      });
      countdown.textContent = String(view.countdown);
    } else {
      countdown.style.display = "none";
      countdown.textContent = "";
    }
    if (view.selectArea && !areaOpen) openAreaEditor();
    else if (!view.selectArea && areaOpen) closeAreaEditor();
    else if (areaOpen) renderArea();
    if (view.bar) placeBar();
  }

  // ---- Connection to the worker. It survives a worker restart by reconnecting.
  let port: Browser.runtime.Port | undefined;
  let closed = false;
  let retries = 0;
  function send(message: unknown) {
    try {
      port?.postMessage(message);
    } catch {
      // Reconnecting.
    }
  }
  function connect() {
    if (closed) return;
    try {
      port = browser.runtime.connect({ name: "recorder-ui" });
      resendArea = true;
    } catch {
      teardown();
      return;
    }
    port.onMessage.addListener((raw: unknown) => {
      const parsed = parseView(raw);
      if (!parsed) return;
      retries = 0;
      if (parsed === "close") {
        teardown();
        return;
      }
      view = parsed;
      render();
      // After a reconnect, an area click the old worker may never have seen is sent again.
      if (resendArea && view.selectArea && areaMessage) send(areaMessage);
      resendArea = false;
    });
    reportViewport();
    reportVisibility();
    port.onDisconnect.addListener(() => {
      port = undefined;
      // The extension was reloaded or the worker restarted.
      if (closed || ++retries > 3) teardown();
      else setTimeout(connect, 200 * retries);
    });
  }
  function teardown() {
    if (closed) return;
    closed = true;
    try {
      port?.disconnect();
    } catch {
      // Already gone.
    }
    window.removeEventListener("resize", onResize);
    darkScheme.removeEventListener("change", applyTheme);
    window.removeEventListener("message", onFrameMessage);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("pointerdown", onPagePointer, true);
    browser.storage.onChanged.removeListener(onStorage);
    clearTimeout(zoomReport);
    clearTimeout(panelHide);
    document.removeEventListener("visibilitychange", reportVisibility);
    clearTimeout(bubbleHide);
    clearInterval(markerTimer);
    hostElement.remove();
    delete (globalThis as unknown as Record<string, HostHandle | undefined>)[
      GLOBAL
    ];
  }

  (document.body ?? document.documentElement).append(hostElement);
  // The bar fades in on its first size report; never leave it invisible if that is lost.
  setTimeout(
    () => css(bar, { opacity: "1", transform: "translateY(0)" }),
    1500,
  );
  render();
  connect();
  return {
    reconnect() {
      if (!port) {
        retries = 0;
        connect();
      }
    },
  };
}
