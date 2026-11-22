import type { CatalogFetcher } from './model-catalog.service';

/**
 * The catalog refresh runs inline on the analysis path — `ModelSelectionsService.resolve`
 * validates the saved selection against it — so a stalled gateway must fail fast rather than
 * hold a user's analysis open before its first token. Errors degrade to the stale cache and
 * then to the configured baseline; a hang degrades to nothing.
 */
export const CATALOG_FETCH_TIMEOUT_MS = 3_000;

export function createGatewayCatalogFetcher(
  apiKey: string | undefined,
  timeoutMs: number = CATALOG_FETCH_TIMEOUT_MS,
): CatalogFetcher {
  return (url) =>
    fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: apiKey === undefined ? undefined : { Authorization: `Bearer ${apiKey}` },
    });
}
