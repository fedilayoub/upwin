import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { recorderSchema } from "../protocol";
import { useRecordingShortcut } from "./use-recording-shortcut";

/**
 * Where the optional `tabCapture` permission stands for the recorder that is open now:
 * - `missing`: not granted; This tab falls back to the picker, Area cannot start;
 * - `needs-click`: granted after the toolbar click that opened this recorder. Chrome only adds
 *   the tab-capture right to clicks made while the permission is held, so one more click on
 *   the toolbar icon is needed (the worker re-arms instead of closing on that click);
 * - `ready`: tab recording works on this tab.
 */
export type TabCaptureStatus = "checking" | "missing" | "needs-click" | "ready";

export function useTabCapture() {
  const [status, setStatus] = useState<TabCaptureStatus>("checking");
  // The shortcut also counts as the click Chrome needs. Only shown when one is assigned.
  const shortcut = useRecordingShortcut() ?? null;
  useEffect(() => {
    let alive = true;
    const set = (next: TabCaptureStatus) => alive && setStatus(next);
    void browser.permissions
      .contains({ permissions: ["tabCapture"] })
      .then((granted) =>
        setStatus((current) =>
          current === "checking" ? (granted ? "ready" : "missing") : current,
        ),
      )
      .catch(() => set("missing"));
    const onAdded = (permissions: Browser.permissions.Permissions) => {
      if (permissions.permissions?.includes("tabCapture")) arm();
    };
    const onRemoved = (permissions: Browser.permissions.Permissions) => {
      if (permissions.permissions?.includes("tabCapture")) set("missing");
    };
    const onMessage = (raw: unknown, sender: Browser.runtime.MessageSender) => {
      if (sender.id !== browser.runtime.id) return;
      const parsed = recorderSchema.safeParse(raw);
      if (parsed.success && parsed.data.type === "recorder/tab-capture")
        set("ready");
    };
    browser.permissions.onAdded.addListener(onAdded);
    browser.permissions.onRemoved.addListener(onRemoved);
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      alive = false;
      browser.permissions.onAdded.removeListener(onAdded);
      browser.permissions.onRemoved.removeListener(onRemoved);
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);
  function arm() {
    setStatus("needs-click");
    void browser.runtime
      .sendMessage({ target: "background", type: "recorder/arm-tab-capture" })
      .catch(() => undefined);
  }
  /**
   * Must be the first await of a click handler: Chrome only prompts inside a user gesture.
   * A new grant arms through `permissions.onAdded`, which never fires for one held already.
   */
  function request(): Promise<boolean> {
    return browser.permissions
      .request({ permissions: ["tabCapture"] })
      .catch(() => false);
  }
  return { status, request, shortcut };
}
