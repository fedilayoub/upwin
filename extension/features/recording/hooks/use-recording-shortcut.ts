import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { reportError } from "@/features/diagnostics/error-log";

/** The manifest command that opens the recorder, and stops a live take. */
export const RECORDING_COMMAND = "toggle-recording";

/**
 * The browser's shortcuts page. Edge maps `chrome://` to `edge://`, so one URL serves both.
 */
const SHORTCUTS_URL = "chrome://extensions/shortcuts";

/**
 * The key the browser actually bound to the recorder command, formatted by the browser for the
 * platform (`⌥⇧R` on macOS, `Alt+Shift+R` elsewhere). `null` when nothing is bound.
 */
export function shortcutFrom(
  commands: readonly Browser.commands.Command[],
): string | null {
  const keys = commands.find(
    (command) => command.name === RECORDING_COMMAND,
  )?.shortcut;
  return keys ? keys : null;
}

/**
 * The manifest only suggests Alt+Shift+R. The browser leaves the command unbound when another
 * extension (a second upwin build included) already holds the key, and the user can clear or
 * change it, so the panel shows the live binding rather than the suggestion.
 *
 * `undefined` while it is being read, `null` when nothing is bound. Read again whenever the panel
 * regains focus, so a key set on the shortcuts page shows up on return.
 */
export function useRecordingShortcut(): string | null | undefined {
  const [shortcut, setShortcut] = useState<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    let alive = true;
    const read = () => {
      const commands = browser.commands as typeof browser.commands | undefined;
      if (!commands) {
        setShortcut(null);
        return;
      }
      void commands
        .getAll()
        .then((all) => {
          if (alive) setShortcut(shortcutFrom(all));
        })
        .catch(() => {
          if (alive) setShortcut(null);
        });
    };
    read();
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      alive = false;
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, []);
  return shortcut;
}

/** Opens the browser's keyboard-shortcuts page in a new tab. */
export function openShortcutSettings(): void {
  void browser.tabs.create({ url: SHORTCUTS_URL }).catch((cause: unknown) => {
    reportError({
      error: cause,
      code: "SHORTCUTS_PAGE_FAILED",
      operation: "recorder.openShortcuts",
    });
  });
}
