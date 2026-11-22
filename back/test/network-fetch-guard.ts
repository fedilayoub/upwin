import { afterEach, afterAll, expect, vi } from 'vitest';

const originalFetch = globalThis.fetch.bind(globalThis);
const networkFetch = vi.fn(originalFetch);

function guardedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const rawUrl = input instanceof Request ? input.url : input.toString();
  const url = new URL(rawUrl, 'http://localhost');

  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '::1') {
    throw new Error(`Tests must not fetch non-localhost URL: ${url.origin}`);
  }

  return networkFetch(input, init);
}

globalThis.fetch = vi.fn(guardedFetch);

afterEach(() => {
  expect(networkFetch, 'No test may reach the real fetch implementation.').not.toHaveBeenCalled();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
