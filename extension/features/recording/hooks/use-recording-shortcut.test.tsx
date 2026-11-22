import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShortcutHint } from "../ui/new-recording";
import { RECORDING_COMMAND, shortcutFrom } from "./use-recording-shortcut";

describe("shortcutFrom", () => {
  it("returns the key the browser bound to the recorder command", () => {
    expect(
      shortcutFrom([
        { name: "_execute_action", shortcut: "⌥⇧U" },
        { name: RECORDING_COMMAND, shortcut: "⌥⇧R" },
      ]),
    ).toBe("⌥⇧R");
  });

  it("is null when the browser left the command unbound", () => {
    // Chrome reports an empty shortcut when the suggested key clashed.
    expect(shortcutFrom([{ name: RECORDING_COMMAND, shortcut: "" }])).toBe(
      null,
    );
    expect(shortcutFrom([])).toBe(null);
  });
});

describe("ShortcutHint", () => {
  it("shows the bound key", () => {
    const markup = renderToStaticMarkup(<ShortcutHint shortcut="⌥⇧R" />);
    expect(markup).toContain("Shortcut:");
    expect(markup).toContain("<kbd");
    expect(markup).toContain("⌥⇧R");
  });

  it("offers to set a key instead of advertising one that is not bound", () => {
    const markup = renderToStaticMarkup(<ShortcutHint shortcut={null} />);
    expect(markup).toContain("No keyboard shortcut is set.");
    expect(markup).toContain("Set one");
    expect(markup).not.toContain("Alt+Shift+R");
  });

  it("renders nothing until the binding is known", () => {
    expect(renderToStaticMarkup(<ShortcutHint shortcut={undefined} />)).toBe(
      "",
    );
  });
});
