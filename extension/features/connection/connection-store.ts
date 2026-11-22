import { storage } from '#imports';
import { cleanUrl, extensionConfig } from '@/lib/config';
import type { TokenProvider } from '@/services/api';

/**
 * Where this extension sends captures, and the optional token the API was
 * started with. Stored per browser profile, readable from the side panel and
 * the background worker alike, so both always talk to the same API.
 *
 * The token is the user's own API token, kept in local extension storage. No
 * other site can read it, and it never leaves the extension except as the
 * Authorization header to the configured API.
 */
export interface Connection {
  /** The upwin API, e.g. http://localhost:3002. */
  apiUrl: string;
  /** The upwin web app, for "open in the web app" links. */
  appUrl: string;
  /** The API's API_TOKEN, when it was started with one. */
  token: string | null;
}

export const defaultConnection: Connection = {
  apiUrl: extensionConfig.defaultApiUrl,
  appUrl: extensionConfig.defaultAppUrl,
  token: null,
};

/** Null until the user has saved a connection once: the first-run signal. */
export const connectionItem = storage.defineItem<Connection | null>(
  'local:connection',
  { fallback: null },
);

export async function readConnection(): Promise<Connection> {
  const saved = await connectionItem.getValue().catch(() => null);
  return normalizeConnection(saved ?? defaultConnection);
}

export async function saveConnection(input: Connection): Promise<Connection> {
  const connection = normalizeConnection(input);
  await connectionItem.setValue(connection);
  return connection;
}

export function normalizeConnection(input: Partial<Connection>): Connection {
  return {
    apiUrl: cleanUrl(input.apiUrl) || defaultConnection.apiUrl,
    appUrl: cleanUrl(input.appUrl) || defaultConnection.appUrl,
    token: input.token?.trim() || null,
  };
}

/** The token provider every service call uses. Null means "send no header". */
export const connectionTokenProvider: TokenProvider = async () =>
  (await readConnection()).token;

export async function resolveApiBaseUrl(): Promise<string> {
  return (await readConnection()).apiUrl;
}
