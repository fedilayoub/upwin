/**
 * The optional single-password gate for an online install. There are no
 * accounts: one APP_PASSWORD unlocks the app, and the cookie proves it.
 *
 * The cookie value is HMAC-SHA256(APP_PASSWORD, label): it never contains the
 * password, it survives restarts and serverless cold starts with no store, and
 * changing APP_PASSWORD signs every browser out. Web Crypto only, so it runs in
 * the proxy and in server actions alike.
 */
export const APP_SESSION_COOKIE = 'upwin_session';
export const APP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_LABEL = 'upwin-app-session-v1';

export function configuredAppPassword(): string | null {
  return process.env.APP_PASSWORD?.trim() || null;
}

export async function sessionTokenFor(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(SESSION_LABEL),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time for equal lengths; the length of a hex HMAC is not a secret. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function isUnlocked(
  cookieValue: string | undefined,
  password: string | null = configuredAppPassword(),
): Promise<boolean> {
  if (password === null) return true;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await sessionTokenFor(password));
}

/**
 * Pages anyone may open on an online install: a client's video link and its
 * playback routes, the unlock page itself, and static files.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    // The API shares `${APP_URL}/v/<slug>`; the locale redirect comes after this check.
    /^(?:\/(?:en|fr))?\/v\/[^/]+\/?$/.test(pathname) ||
    pathname.startsWith('/api/videos/') ||
    /^\/(?:en|fr)\/unlock\/?$/.test(pathname) ||
    pathname === '/manifest.webmanifest'
  );
}

/** Only same-site paths survive the unlock redirect. */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
