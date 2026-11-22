import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { initialState } from "../protocol";
import { limits } from "../test-fixtures";
const mocks = vi.hoisted(() => ({
  state: {} as typeof initialState,
  limits: {} as typeof limits,
}));
vi.mock("../hooks/use-recording-state", () => ({
  useRecordingState: () => mocks.state,
}));
vi.mock("../hooks/use-video-limits", () => ({
  useVideoLimits: () => ({ data: mocks.limits, execute: vi.fn() }),
}));
vi.mock("./new-recording", () => ({
  NewRecording: () => <div>setup controls</div>,
}));
vi.mock("./video-library", () => ({
  VideoLibrary: () => <div>recent videos</div>,
}));
import { SupportedVideoScreen } from "./video-screen";
it("maps engine phases to setup, countdown, controls, progress and recovery", () => {
  mocks.limits = limits;
  for (const [phase, text] of [
    ["idle", "setup controls"],
    ["countdown", ">3<"],
    ["recording", "Pause"],
    ["paused", "Resume"],
    ["uploading", 'role="progressbar"'],
    ["picking", "Choose what to share"],
    ["creating", "Starting"],
  ] as const) {
    mocks.state = { ...initialState, phase, countdown: 3 };
    expect(renderToStaticMarkup(<SupportedVideoScreen />)).toContain(text);
  }
  mocks.state = {
    ...initialState,
    phase: "failed",
    recoveries: [{ sessionId: "s", createdAt: 1 }],
    error: { code: "UPLOAD_CORS", messageKey: "video.error.UPLOAD_CORS" },
  };
  const markup = renderToStaticMarkup(<SupportedVideoScreen />);
  expect(markup).toContain("Upload what was recorded");
  expect(markup).toContain("not exposing the ETag header");
  expect(markup).not.toContain("setup controls");
});
it("shows coming soon from server availability", () => {
  mocks.state = initialState;
  mocks.limits = { ...limits, available: false } as never;
  expect(renderToStaticMarkup(<SupportedVideoScreen />)).toContain(
    "coming soon",
  );
});
