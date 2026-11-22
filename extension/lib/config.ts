/**
 * Build-time defaults for the connection a freelancer sets on first run. Both
 * are overridable from the side panel and stored per browser profile, so one
 * build works against any self-hosted API.
 */
const DEFAULT_API_URL = 'http://localhost:3002';
const DEFAULT_APP_URL = 'http://localhost:3000';

export function cleanUrl(value: string | undefined, fallback = ''): string {
  const candidate = value?.trim() || fallback;

  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export const extensionConfig = {
  defaultApiUrl: cleanUrl(import.meta.env.WXT_PUBLIC_API_URL, DEFAULT_API_URL),
  defaultAppUrl: cleanUrl(import.meta.env.WXT_PUBLIC_APP_URL, DEFAULT_APP_URL),
} as const;
