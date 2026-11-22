import { parseList } from '../config/env.schema';
import type { FastifyRequest } from 'fastify';

const CHROMIUM_EXTENSION_ID = /^[a-p]{32}$/;

export const extensionOriginHeader = 'X-Upilot-Extension-Origin';
export const extensionOriginHeaderKey = 'x-upilot-extension-origin';

export interface AllowedExtensionRequest {
  allowedOrigin: string;
  corsOrigin?: string;
}

export function isExtensionRequest(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  return (
    request.headers[extensionOriginHeaderKey] !== undefined ||
    (typeof origin === 'string' && origin.startsWith('chrome-extension://'))
  );
}

export function normalizeExtensionOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());

    if (
      url.protocol !== 'chrome-extension:' ||
      !CHROMIUM_EXTENSION_ID.test(url.hostname) ||
      url.username ||
      url.password ||
      (url.pathname !== '' && url.pathname !== '/') ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return `chrome-extension://${url.hostname}`;
  } catch {
    return null;
  }
}

export function getAllowedExtensionOrigins(
  configuredOrigins: string | undefined,
): ReadonlySet<string> {
  return new Set(
    parseList(configuredOrigins)
      .map((origin) => normalizeExtensionOrigin(origin))
      .filter((origin): origin is string => origin !== null),
  );
}

export function isAllowedExtensionOrigin(
  origin: string | null,
  configuredOrigins?: string,
): origin is string {
  if (!origin) return false;
  const normalizedOrigin = normalizeExtensionOrigin(origin);
  if (!normalizedOrigin || normalizedOrigin !== origin) return false;

  return getAllowedExtensionOrigins(configuredOrigins).has(normalizedOrigin);
}

export function resolveAllowedExtensionRequest(
  browserOrigin: string | null,
  declaredOrigin: string | null,
  configuredOrigins?: string,
): AllowedExtensionRequest | null {
  if (browserOrigin) {
    if (!isAllowedExtensionOrigin(browserOrigin, configuredOrigins))
      return null;
    if (declaredOrigin && declaredOrigin !== browserOrigin) return null;

    return {
      allowedOrigin: browserOrigin,
      corsOrigin: browserOrigin,
    };
  }

  if (!isAllowedExtensionOrigin(declaredOrigin, configuredOrigins)) return null;

  return { allowedOrigin: declaredOrigin };
}
