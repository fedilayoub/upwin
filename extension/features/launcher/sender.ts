/**
 * Whether a message came from a page the launcher is injected into.
 *
 * The launcher runs on every http and https page, so this is a scheme check
 * rather than a host check — it exists to keep the toggle from acting on
 * anything that is not an ordinary web page. Which extension may talk to the
 * worker at all is settled separately, by the sender-id check.
 *
 * Checks the sender document's own URL rather than the tab's, because
 * `tab.url` is only populated when the extension holds a host permission for
 * the page and the launcher deliberately runs without one.
 */
export function isLauncherSenderUrl(url: string | undefined): boolean {
  if (!url) return false;

  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
