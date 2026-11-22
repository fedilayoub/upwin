import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import {
  initialState,
  recorderSchema,
  sidepanelSchema,
  stateSchema,
} from "../protocol";
/** The worker broadcasts state to both the side panel and the in-page recorder. */
export function useRecordingState(target: "sidepanel" | "recorder" = "sidepanel") {
  const [state, setState] = useState(initialState);
  useEffect(() => {
    let alive = true,
      broadcastSeen = false;
    const listener = (raw: unknown, sender: Browser.runtime.MessageSender) => {
      if (sender.id !== browser.runtime.id) return;
      const m = (target === "recorder" ? recorderSchema : sidepanelSchema).safeParse(raw);
      if (m.success && m.data.type === "recording/state") {
        broadcastSeen = true;
        setState(m.data.state);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    void browser.runtime
      .sendMessage({ target: "background", type: "recording/get-state" })
      .then((raw: unknown) => {
        const p = stateSchema.safeParse(raw);
        if (alive && !broadcastSeen && p.success) setState(p.data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [target]);
  return state;
}
