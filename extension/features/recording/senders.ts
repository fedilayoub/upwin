import { browser } from "wxt/browser";

/**
 * The extension page a message came from, as a path (`/recorder-bar.html`), or null.
 *
 * Compares origin and id, not the full URL: frames embedded in web pages may load through the
 * `use_dynamic_url` id, so `runtime.getURL()` is not a reliable prefix. A content script's
 * sender URL is the web page's, so it never matches an `chrome-extension:` page.
 */
export function extensionPagePath(
  sender: Pick<Browser.runtime.MessageSender, "id" | "url">,
): string | null {
  if (sender.id !== browser.runtime.id || !sender.url) return null;
  try {
    const url = new URL(sender.url);
    return url.protocol === "chrome-extension:" ? url.pathname : null;
  } catch {
    return null;
  }
}
