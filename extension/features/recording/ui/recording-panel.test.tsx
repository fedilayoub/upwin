import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { RecordingPanel } from "./recording-panel";
import { initialState } from "../protocol";

// The browser formats the bound key per platform; the footer shows it as given.
vi.mock("../hooks/use-recording-shortcut", () => ({
  useRecordingShortcut: () => "⌥⇧R",
}));
it("recording-panel renders its accessible controls", () => {
  const markup = renderToStaticMarkup(
    <RecordingPanel
      state={{
        ...initialState,
        phase: "recording",
        maxDurationMs: 300000,
        updatedAt: Date.now(),
        live: { ...initialState.live, cameraVisible: true },
      }}
    />,
  );
  // Finish matches the in-page bar; Pause, Restart and Discard are labelled icon buttons.
  for (const text of [
    "Finish",
    'aria-label="Pause"',
    'aria-label="Restart"',
    'aria-label="Discard"',
    'aria-pressed="true"',
    "Upload connected",
    "⌥⇧R to stop",
  ])
    expect(markup).toContain(text);
  expect(markup).not.toContain("<video");
});
