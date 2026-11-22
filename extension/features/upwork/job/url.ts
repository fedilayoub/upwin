/**
 * The job page in its two verified spellings:
 *
 * - `/jobs/~0<hex>` — the canonical path ("Open job in a new window").
 * - `/jobs/<Title-slug>_~0<hex>/` — what Upwork's job search links to. Verified
 *   live on 2026-11-10: same `submit-proposal-button` marker, same title
 *   selector, same `__NUXT_DATA__` payload as the canonical path.
 *
 * The slider routes (`/nx/.../details/~0…`) and the apply page are still
 * unverified and stay unsupported.
 */
const JOB_PATH_PATTERN = /^\/jobs\/(?:[^/]*_)?(~0[0-9a-f]+)\/?$/i;

export function isSupportedJobUrl(url: string | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'www.upwork.com' ||
        parsed.hostname === 'upwork.com') &&
      parsed.hash === '' &&
      JOB_PATH_PATTERN.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export function jobCiphertextFromUrl(
  url: string | undefined,
): string | undefined {
  if (!url || !isSupportedJobUrl(url)) return undefined;

  const pathname = new URL(url).pathname;
  return JOB_PATH_PATTERN.exec(pathname)?.[1];
}

/**
 * The one URL a snapshot carries, whichever spelling the tab was on. The
 * backend accepts only the canonical path, and the slug is display text.
 */
export function canonicalJobUrl(ciphertext: string): string {
  return `https://www.upwork.com/jobs/${ciphertext}`;
}
