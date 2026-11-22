import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { initialState, type SessionState } from "../protocol";
import { limits } from "../test-fixtures";
const mocks = vi.hoisted(() => ({
  state: {} as SessionState,
  snapshot: null as unknown,
  limits: null as unknown,
  capture: "ready" as string,
  mode: null as string | null,
}));
vi.mock("../hooks/use-bar-preferences", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../hooks/use-bar-preferences")>();
  return {
    ...actual,
    useBarPreferences: () => ({
      preferences: {
        ...actual.defaultBarPreferences,
        ...(mocks.mode ? { mode: mocks.mode } : {}),
      },
      update: vi.fn(),
      loaded: true,
    }),
  };
});
vi.mock("../hooks/use-recording-state", () => ({
  useRecordingState: () => mocks.state,
}));
vi.mock("../hooks/use-video-limits", () => ({
  useVideoLimits: () => ({ data: mocks.limits ?? limits, execute: vi.fn() }),
}));
vi.mock("../hooks/use-preview", () => ({
  usePreview: () => ({ snapshot: mocks.snapshot, level: 0.5, blur: "off" }),
}));
vi.mock("../hooks/use-tab-capture", () => ({
  useTabCapture: () => ({
    status: mocks.capture,
    request: vi.fn(),
    shortcut: "⌥⇧R",
  }),
}));
import { RecorderBar, pickDevice, stageFor } from "./recorder-bar";

it("maps engine phases to bar stages", () => {
  for (const [phase, stage] of [
    ["idle", "setup"],
    ["failed", "setup"],
    ["picking", "starting"],
    ["countdown", "starting"],
    ["recording", "recording"],
    ["paused", "recording"],
    ["uploading", "uploading"],
    ["done", "done"],
  ] as const)
    expect(stageFor({ ...initialState, phase })).toBe(stage);
});
it("renders the result as real actions, with New recording resetting the engine", () => {
  mocks.state = {
    ...initialState,
    phase: "done",
    videoId: "018f6a77-4e90-7ab5-a3bf-15c8f850fa13",
    shareUrl: "https://upwin.example.com/v/abcdefghijkl",
  };
  const markup = renderToStaticMarkup(<RecorderBar embedded={false} />);
  for (const label of [
    "Your video link is ready",
    "Copy link",
    "Open",
    "New recording",
  ])
    expect(markup).toContain(label);
  expect(markup.match(/<button/g)?.length).toBeGreaterThanOrEqual(4);
  expect(markup).toContain("whitespace-nowrap");
});
it("keeps a chosen device while present, else falls back to the default", () => {
  const devices = [
    { kind: "videoinput" as const, deviceId: "default", label: "Default" },
    { kind: "videoinput" as const, deviceId: "usb", label: "USB" },
  ];
  expect(pickDevice("usb", devices)).toBe("usb");
  expect(pickDevice("gone", devices)).toBe("default");
  expect(pickDevice(null, [])).toBeNull();
});
it("renders the setup bar with sources, inputs and a permission prompt", () => {
  mocks.state = initialState;
  mocks.snapshot = {
    devices: [],
    permissions: { camera: "prompt", microphone: "prompt" },
  };
  const markup = renderToStaticMarkup(<RecorderBar embedded={false} />);
  for (const text of [
    "What to record?",
    "This tab",
    "Window",
    "Display",
    "Area",
    "Camera",
    "Mic",
    ">Record<",
    "Blur",
    "Allow camera &amp; microphone",
  ])
    expect(markup).toContain(text);
  expect(markup).not.toContain("<video");
});
it("offers only Window and Display in the fallback tab", () => {
  mocks.state = initialState;
  const markup = renderToStaticMarkup(
    <RecorderBar embedded={false} fallback />,
  );
  expect(markup).not.toContain("This tab");
  expect(markup).not.toContain(">Area<");
  expect(markup).toContain("Display");
});
it("renders the recording pill with its controls", () => {
  mocks.state = {
    ...initialState,
    phase: "recording",
    maxDurationMs: 300000,
    updatedAt: Date.now(),
    live: { ...initialState.live, cameraVisible: true },
  };
  const markup = renderToStaticMarkup(<RecorderBar embedded={false} />);
  for (const label of [
    "Pause",
    "Restart",
    "Discard",
    "Mute mic",
    "Hide camera",
    "Finish",
  ])
    expect(markup).toContain(label);
  expect(markup).toContain('role="timer"');
});
function buttonTag(markup: string, label: string) {
  return markup.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
}
const COLLAPSED = "hidden group-hover/pill:grid";
it("keeps only the timer, Restart and Finish in the compact recording pill", () => {
  mocks.state = {
    ...initialState,
    phase: "recording",
    maxDurationMs: 300000,
    updatedAt: Date.now(),
    live: { ...initialState.live, cameraVisible: true },
  };
  const markup = renderToStaticMarkup(<RecorderBar embedded />);
  expect(buttonTag(markup, "Restart")).not.toContain(COLLAPSED);
  for (const label of ["Pause", "Discard", "Mute mic", "Hide camera"]) {
    expect(buttonTag(markup, label)).toContain(COLLAPSED);
    expect(buttonTag(markup, label)).toContain("data-reveal");
  }
  // Finish is a text button, outside the collapsed set.
  expect(markup).toMatch(/<button[^>]*class="mx-0\.5 flex[^"]*"[^>]*>.*Finish/);
});
it("styles Finish exactly like Record", () => {
  const classOf = (markup: string, label: string) =>
    markup
      .match(new RegExp(`<button[^>]*class="([^"]*)"[^>]*>(?:(?!</button>).)*${label}<`))?.[1]
      ?.split(" ")
      .filter((name) => !/^(m[lx]-|self-)/.test(name))
      .join(" ");
  mocks.state = initialState;
  mocks.snapshot = {
    devices: [],
    permissions: { camera: "granted", microphone: "granted" },
  };
  const record = classOf(renderToStaticMarkup(<RecorderBar embedded />), "Record");
  mocks.state = {
    ...initialState,
    phase: "recording",
    maxDurationMs: 300000,
    updatedAt: Date.now(),
  };
  const finish = classOf(renderToStaticMarkup(<RecorderBar embedded />), "Finish");
  expect(record).toBeTruthy();
  expect(finish).toBe(record);
});
it("puts Restart and Finish before every hover control, so opening them moves neither", () => {
  mocks.state = {
    ...initialState,
    phase: "recording",
    maxDurationMs: 300000,
    updatedAt: Date.now(),
    live: { ...initialState.live, cameraVisible: true },
  };
  const markup = renderToStaticMarkup(<RecorderBar embedded />);
  const firstReveal = markup.indexOf("data-reveal");
  expect(firstReveal).toBeGreaterThan(-1);
  expect(markup.indexOf('aria-label="Restart"')).toBeLessThan(firstReveal);
  expect(markup.indexOf(">Finish<")).toBeGreaterThan(-1);
  expect(markup.indexOf(">Finish<")).toBeLessThan(firstReveal);
  // Discard is the last one, the farthest from Finish.
  expect(markup.lastIndexOf("data-reveal")).toBe(
    markup.indexOf("data-reveal", markup.indexOf('aria-label="Discard"')),
  );
});
it("shows every control in the fallback tab, where nothing opens on hover", () => {
  mocks.state = {
    ...initialState,
    phase: "recording",
    maxDurationMs: 300000,
    updatedAt: Date.now(),
    live: { ...initialState.live, cameraVisible: true },
  };
  const markup = renderToStaticMarkup(
    <RecorderBar embedded={false} fallback />,
  );
  expect(markup).not.toContain(COLLAPSED);
  expect(markup).not.toContain("data-reveal");
});
it("never hides a control that is in its non-default state", () => {
  mocks.state = {
    ...initialState,
    phase: "paused",
    maxDurationMs: 300000,
    updatedAt: Date.now(),
    live: { ...initialState.live, micMuted: true, cameraVisible: false },
  };
  const markup = renderToStaticMarkup(<RecorderBar embedded />);
  for (const label of ["Resume", "Unmute mic", "Show camera"])
    expect(buttonTag(markup, label)).not.toContain(COLLAPSED);
  expect(buttonTag(markup, "Discard")).toContain(COLLAPSED);
});
it("shows storage with no cap as no limit", () => {
  mocks.state = initialState;
  mocks.snapshot = {
    devices: [],
    permissions: { camera: "granted", microphone: "granted" },
  };
  mocks.limits = {
    ...limits,
    storage: { usedBytes: 640 * 1024 ** 2 },
  };
  const markup = renderToStaticMarkup(<RecorderBar embedded={false} />);
  mocks.limits = null;
  expect(markup).toContain("640 MB stored · no limit · max 5 min");
  expect(markup).not.toContain(" of ");
});
it("offers the tab permission, then asks for the one toolbar click", () => {
  mocks.state = initialState;
  mocks.snapshot = {
    devices: [],
    permissions: { camera: "granted", microphone: "granted" },
  };
  // The default mode is Window: it goes through the picker and asks for nothing more.
  mocks.capture = "missing";
  const windowMode = renderToStaticMarkup(<RecorderBar embedded={false} />);
  expect(windowMode).not.toContain("Record tabs in one click.");
  expect(windowMode).not.toContain("click the upwin icon");
  // This tab offers the permission.
  mocks.mode = "tab";
  const missing = renderToStaticMarkup(<RecorderBar embedded={false} />);
  expect(missing).toContain("Record tabs in one click.");
  expect(missing).toContain(">Allow<");
  mocks.capture = "needs-click";
  const click = renderToStaticMarkup(<RecorderBar embedded={false} />);
  expect(click).toContain(
    "click the upwin icon at the top right of your browser",
  );
  expect(click).toContain("puzzle-piece Extensions menu");
  expect(click).toContain("⌥⇧R");
  mocks.capture = "ready";
  const ready = renderToStaticMarkup(<RecorderBar embedded={false} />);
  expect(ready).not.toContain("Record tabs in one click.");
  expect(ready).not.toContain("click the upwin icon");
  mocks.mode = null;
});
it("keeps storage usage behind its button until the user opens it", () => {
  mocks.state = initialState;
  mocks.snapshot = {
    devices: [],
    permissions: { camera: "granted", microphone: "granted" },
  };
  const markup = renderToStaticMarkup(<RecorderBar embedded />);
  const toggle = buttonTag(markup, "Storage");
  expect(toggle).toContain('aria-expanded="false"');
  // The summary is the button's tooltip, never a line under the controls.
  expect(toggle).toContain("0 MB stored · no limit · max 5 min");
  expect(markup).not.toContain("<footer");
  expect(markup).not.toContain('role="region"');
});
