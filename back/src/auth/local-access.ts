import { createHash, timingSafeEqual } from 'node:crypto';

/** Host names that always reach this API when it runs on the user's machine. */
export const LOOPBACK_HOSTS: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '[::1]',
];

/**
 * The host name of a raw `Host` header, lower-cased, without the port. IPv6
 * literals keep their brackets. Null when the header is absent or malformed.
 *
 * Read the raw header, never Fastify's `request.hostname`: with `trustProxy`
 * that one honours `X-Forwarded-Host`, which a DNS-rebinding page can set on
 * a same-origin request.
 */
export function hostnameOf(hostHeader: string | undefined): string | null {
  const value = hostHeader?.trim().toLowerCase();
  if (!value) return null;

  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end > 1 ? value.slice(0, end + 1) : null;
  }

  const colon = value.indexOf(':');
  const host = colon === -1 ? value : value.slice(0, colon);
  return host.length > 0 ? host : null;
}

export function isLoopbackBindHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

export function digestToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Constant-time comparison of a presented token against the configured digest. */
export function tokenMatches(presented: string, expected: Buffer): boolean {
  return timingSafeEqual(digestToken(presented), expected);
}

export function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  return match?.[1] ?? null;
}
