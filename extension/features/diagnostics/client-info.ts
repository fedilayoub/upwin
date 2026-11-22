import { browser } from "wxt/browser";
import type { DiagnosticSurface } from "./errors";

export type ClientBrowser = "chrome" | "edge" | "firefox" | "other";

export interface ClientInfo {
  version: string;
  browser: ClientBrowser;
  /** Only a Chromium id; Firefox ids are not part of the report contract. */
  extensionId?: string;
}

export function detectBrowser(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
): ClientBrowser {
  if (import.meta.env.BROWSER === "firefox" || /Firefox\//.test(userAgent))
    return "firefox";
  if (/Edg\//.test(userAgent)) return "edge";
  if (/Chrome\//.test(userAgent)) return "chrome";
  return "other";
}

export function getClientInfo(): ClientInfo {
  let version = "0.0.0";
  let extensionId: string | undefined;
  try {
    version = browser.runtime.getManifest().version;
    extensionId = /^[a-p]{32}$/.test(browser.runtime.id)
      ? browser.runtime.id
      : undefined;
  } catch {
    // No runtime (unit tests, a torn-down context): keep the defaults.
  }
  return { version, browser: detectBrowser(), extensionId };
}

/** Where this code runs, from the page it runs in. */
export function currentSurface(): DiagnosticSurface {
  if (typeof document === "undefined") return "worker";
  const { pathname, protocol } = globalThis.location;
  if (protocol !== "chrome-extension:" && protocol !== "moz-extension:")
    return "launcher";
  if (pathname.endsWith("/offscreen-recorder.html")) return "offscreen";
  if (
    /\/(recorder-bar|camera-bubble|recorder|media-permission)\.html$/.test(
      pathname,
    )
  )
    return "recorder";
  return "sidepanel";
}
