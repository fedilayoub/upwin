/**
 * Copies `text` synchronously, inside the click that asked for it.
 *
 * The bar is an extension iframe on someone else's page. `navigator.clipboard.writeText` there
 * is subject to the page's Permissions-Policy: a page that sends `clipboard-write=()` or
 * `(self)` blocks it with NotAllowedError, whatever the iframe's `allow` attribute says.
 * `execCommand("copy")` during the user's click is not subject to that policy. Measured in
 * Chromium on 2026-11-12: it copied under `()`, `(self)` and no policy, while `writeText`
 * failed under both strict ones. It must run before any `await`, while the click still
 * counts as a user gesture.
 */
export function copyInFrame(text: string, doc: Document = document): boolean {
  const area = doc.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  // Off-screen and out of flow: the bar measures its root to size the frame (trap 16).
  area.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none";
  const previous = doc.activeElement;
  doc.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = doc.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  if (previous && "focus" in previous && typeof previous.focus === "function")
    (previous as HTMLElement).focus();
  return ok;
}
