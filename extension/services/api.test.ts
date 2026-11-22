import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './api';

describe('ApiClient', () => {
  it('calls the native fetch implementation with the browser global receiver', async () => {
    const guardedFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(Response.json({ ok: true }));
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', guardedFetch);

    try {
      const client = new ApiClient({ baseUrl: 'https://app.example.com' });

      await expect(
        client.request('/api/extension/session', {
          getToken: vi.fn().mockResolvedValue('session-token'),
          operation: 'verify session',
        }),
      ).resolves.toEqual({ ok: true });

      expect(guardedFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('adds the API token as a bearer without cookies', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ user: { id: 'user_123' } }),
    );
    const getToken = vi.fn().mockResolvedValue('session-token');
    const client = new ApiClient({
      baseUrl: 'https://app.example.com',
      extensionOrigin:
        'chrome-extension://bkbnbhccfngcfkepekmhjcdgniggajoh',
      fetchImplementation,
    });

    const result = await client.request<{ user: { id: string } }>(
      '/api/extension/session',
      { getToken, method: 'GET', operation: 'verify session' },
    );

    expect(result.user.id).toBe('user_123');
    expect(getToken).toHaveBeenCalledOnce();
    expect(fetchImplementation).toHaveBeenCalledOnce();

    const [url, init] = fetchImplementation.mock.calls[0]!;
    expect(url.toString()).toBe('https://app.example.com/api/extension/session');
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer session-token',
    );
    expect(new Headers(init?.headers).get('X-Upilot-Extension-Origin')).toBe(
      'chrome-extension://bkbnbhccfngcfkepekmhjcdgniggajoh',
    );
  });

  it('reads the base URL from the resolver on every request', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ ok: true }));
    const baseUrl = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('http://localhost:3002')
      .mockResolvedValueOnce('http://upwin.lan:4000');
    const client = new ApiClient({ baseUrl, fetchImplementation });
    const getToken = vi.fn().mockResolvedValue(null);

    await client.request('/me', { getToken, operation: 'GET /me' });
    await client.request('/me', { getToken, operation: 'GET /me' });

    expect(fetchImplementation.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:3002/me',
      'http://upwin.lan:4000/me',
    ]);
  });

  it('sends no Authorization header when no API token is set', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true }));
    const client = new ApiClient({
      baseUrl: 'http://localhost:3002',
      fetchImplementation,
    });

    await expect(
      client.request('/me', {
        getToken: vi.fn().mockResolvedValue(null),
        operation: 'GET /me',
      }),
    ).resolves.toEqual({ ok: true });
    expect(
      new Headers(fetchImplementation.mock.calls[0]![1]?.headers).has(
        'Authorization',
      ),
    ).toBe(false);
  });

  it('carries the API request id on an error', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'VIDEO_NOT_FOUND', message: 'Gone.' } }),
        {
          status: 404,
          headers: { 'x-request-id': '0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10' },
        },
      ),
    );
    const client = new ApiClient({
      baseUrl: 'https://app.example.com',
      fetchImplementation,
    });

    await expect(
      client.request('/videos/x', {
        getToken: vi.fn().mockResolvedValue('token'),
        operation: 'videos.get',
      }),
    ).rejects.toMatchObject({
      code: 'VIDEO_NOT_FOUND',
      status: 404,
      requestId: '0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10',
    });
  });

  it('ignores a request id that is not shaped like ours', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 500,
        headers: { 'x-request-id': 'not an id\n' },
      }),
    );
    const client = new ApiClient({
      baseUrl: 'https://app.example.com',
      fetchImplementation,
    });

    const failure = await client
      .request('/x', { getToken: async () => 'token', operation: 'x' })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ status: 500 });
    expect((failure as { requestId?: string }).requestId).toBeUndefined();
  });

  it('reports a request that never got an answer as NETWORK_ERROR', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    const client = new ApiClient({
      baseUrl: 'https://app.example.com',
      fetchImplementation,
    });

    await expect(
      client.request('/videos/limits', {
        getToken: async () => 'token',
        operation: 'videos.getLimits',
      }),
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'NETWORK_ERROR',
      operation: 'videos.getLimits',
      status: undefined,
    });
  });

  it('rejects absolute and protocol-relative URLs before requesting a token', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const getToken = vi.fn().mockResolvedValue('session-token');
    const client = new ApiClient({
      baseUrl: 'https://app.example.com',
      fetchImplementation,
    });

    for (const path of ['https://attacker.example/collect', '//attacker.example']) {
      await expect(
        client.request(path, { getToken, operation: 'unsafe request' }),
      ).rejects.toMatchObject({ code: 'INVALID_API_ENDPOINT' });
    }

    expect(getToken).not.toHaveBeenCalled();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('reports a rejected token once, without retrying', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({}, { status: 401 }));
    const getToken = vi.fn().mockResolvedValue('wrong-token');
    const client = new ApiClient({
      baseUrl: 'http://localhost:3002',
      fetchImplementation,
    });

    await expect(
      client.request('/me', { getToken, operation: 'GET /me' }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'The API rejected the token. Check the API token in Settings.',
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });
});
