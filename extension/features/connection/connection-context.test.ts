import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ApiClientError } from '@/services/api';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return { ...actual, apiClient: { request } };
});

const { checkConnection } = await import('./connection-context');

beforeEach(() => {
  fakeBrowser.reset();
  request.mockReset();
});

describe('checkConnection', () => {
  it('is connected when GET /me returns the local user', async () => {
    request.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: '2026-11-20T10:00:00.000Z',
    });

    await expect(checkConnection()).resolves.toBe('connected');
    expect(request).toHaveBeenCalledWith(
      '/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it.each([
    [new ApiClientError('down', 'GET /me', undefined, 'NETWORK_ERROR'), 'unreachable'],
    [new ApiClientError('bad token', 'GET /me', 401, 'UNAUTHENTICATED'), 'unauthorized'],
    [new ApiClientError('origin', 'GET /me', 403, 'FORBIDDEN'), 'forbidden'],
    [new ApiClientError('teapot', 'GET /me', 418), 'invalid'],
  ] as const)('maps %s to %s', async (error, status) => {
    request.mockRejectedValue(error);

    await expect(checkConnection()).resolves.toBe(status);
  });

  it('is invalid when something else answers at that address', async () => {
    request.mockResolvedValue({ hello: 'world' });

    await expect(checkConnection()).resolves.toBe('invalid');
  });
});
