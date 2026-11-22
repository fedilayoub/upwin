import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { recorderSchema, type PreviewSnapshot } from "../protocol";

/**
 * Devices, permission states and the mic level, as reported by the offscreen preview.
 *
 * The bar never enumerates devices itself: inside a web page an extension frame's media
 * permission belongs to the site. The offscreen document answers under the
 * extension's own grant, and re-reports after every grant, so labels appear without a reload.
 */
export function usePreview() {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [level, setLevel] = useState(0);
  const [blur, setBlur] = useState<"off" | "loading" | "on" | "unavailable">("off");
  const [blurReason, setBlurReason] = useState<string | undefined>();
  useEffect(() => {
    const listener = (raw: unknown, sender: Browser.runtime.MessageSender) => {
      if (sender.id !== browser.runtime.id) return;
      const parsed = recorderSchema.safeParse(raw);
      if (!parsed.success) return;
      if (parsed.data.type === "preview/devices") setSnapshot(parsed.data.snapshot);
      if (parsed.data.type === "preview/level") setLevel(parsed.data.level);
      if (parsed.data.type === "preview/blur") {
        setBlur(parsed.data.status);
        setBlurReason(parsed.data.reason);
      }
    };
    const refresh = () =>
      void browser.runtime
        .sendMessage({ target: "background", type: "recorder/refresh-devices" })
        .catch(() => undefined);
    browser.runtime.onMessage.addListener(listener);
    refresh();
    // The user comes back from the permission tab: ask again.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return { snapshot, level, blur, blurReason };
}
