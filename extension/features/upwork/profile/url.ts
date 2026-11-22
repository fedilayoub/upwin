/**
 * The own profile in both spellings Upwork uses (verified live 2026-11-10):
 *
 * - `/freelancers/~01<hex>` — what Upwork's own navigation links to. About two
 *   seconds after load the page rewrites itself (`history.replaceState`) to the
 *   username form below, so a click can land on either spelling.
 * - `/freelancers/<username>` — the username form; also what a reload or a
 *   shared link opens.
 *
 * Whose profile it is never comes from the URL: the read requires the
 * own-profile edit markers. `/freelancers/settings/profile` is the Profile
 * Settings page, which has no markers, so it is not offered.
 */
const OWN_PROFILE_PATH =
  /^\/freelancers\/(~[a-z0-9]+|(?!settings\/?$)[a-z0-9][a-z0-9_.-]*)\/?$/i;

export function isSupportedOwnProfileUrl(url: string | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const isUpwork =
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'www.upwork.com' ||
        parsed.hostname === 'upwork.com');
    return isUpwork && OWN_PROFILE_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
}
