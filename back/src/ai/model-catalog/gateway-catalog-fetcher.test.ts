import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CATALOG_FETCH_TIMEOUT_MS,
  createGatewayCatalogFetcher,
} from './gateway-catalog-fetcher';

const CATALOG_URL = 'http://localhost/v1/models';

function stubFetch() {
  // The params must be declared for `mock.calls[n][1]` to be typed as the init
  // object; a zero-arg factory makes every recorded call an empty tuple.
  const spy = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async () => new Response('{"data":[]}'),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('createGatewayCatalogFetcher', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aborts a stalled catalog refresh instead of holding the analysis path open', async () => {
    const spy = stubFetch();

    await createGatewayCatalogFetcher('gateway-key')(CATALOG_URL);

    const init = spy.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(CATALOG_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('rejects once the timeout elapses rather than pending forever', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          }),
      ),
    );

    await expect(
      createGatewayCatalogFetcher('gateway-key', 5)(CATALOG_URL),
    ).rejects.toThrow();
  });

  it('sends the gateway key when configured and omits the header when it is not', async () => {
    const withKey = stubFetch();
    await createGatewayCatalogFetcher('gateway-key')(CATALOG_URL);
    expect(withKey.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer gateway-key',
    });

    const withoutKey = stubFetch();
    await createGatewayCatalogFetcher(undefined)(CATALOG_URL);
    expect(withoutKey.mock.calls[0]?.[1]?.headers).toBeUndefined();
  });
});
