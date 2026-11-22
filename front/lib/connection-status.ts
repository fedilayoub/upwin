import 'server-only';

import { getApiUrl, getBackendApiClient } from '@/lib/api/server';

import type { ModelSelectableCapability } from '@/lib/api';

export interface ModelInUse {
  capability: ModelSelectableCapability;
  modelId: string;
}

export interface ConnectionStatus {
  /** The API address this server calls, which is also what the extension needs. */
  apiUrl: string;
  reachable: boolean;
  tokenConfigured: boolean;
  passwordConfigured: boolean;
  /** The primary model per task, from the API. Null while it is unreachable. */
  models: ModelInUse[] | null;
}

const HEALTH_TIMEOUT_MS = 2_000;

/**
 * What the Connection page shows. Every check degrades to "unknown" instead of
 * throwing, because this page is where a freelancer lands when the API is down.
 */
export async function getConnectionStatus(
  fetcher: typeof fetch = fetch,
): Promise<ConnectionStatus> {
  const apiUrl = getApiUrl().replace(/\/+$/, '');
  const tokenConfigured = Boolean(process.env.API_TOKEN?.trim());
  const passwordConfigured = Boolean(process.env.APP_PASSWORD?.trim());

  const reachable = await fetcher(`${apiUrl}/health`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  })
    .then((response) => response.ok)
    .catch(() => false);

  const models = reachable
    ? await getBackendApiClient()
        .then((api) => api.getModelConsole())
        .then((console) =>
          console.capabilities.map((entry) => ({
            capability: entry.capability,
            modelId: entry.primaryModelId,
          })),
        )
        .catch(() => null)
    : null;

  return { apiUrl, reachable, tokenConfigured, passwordConfigured, models };
}
