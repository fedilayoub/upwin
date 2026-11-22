import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const getModelConsole = vi.fn();
vi.mock('@/lib/api/server', () => ({
  getApiUrl: () => process.env.API_URL ?? '',
  getBackendApiClient: async () => ({ getModelConsole }),
}));

const { getConnectionStatus } = await import('@/lib/connection-status');

describe('getConnectionStatus', () => {
  beforeEach(() => {
    vi.stubEnv('API_URL', 'http://localhost:3002/');
    vi.stubEnv('API_TOKEN', '');
    vi.stubEnv('APP_PASSWORD', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    getModelConsole.mockReset();
  });

  it('reports a reachable API, the model each task uses, and no token', async () => {
    getModelConsole.mockResolvedValue({
      mode: 'live',
      capabilities: [
        { capability: 'profileAnalyzer', primaryModelId: 'gpt-4.1-mini' },
        { capability: 'proposalWriter', primaryModelId: 'gpt-4.1-mini' },
      ],
    });
    const fetcher = vi.fn(async () => new Response('{"status":"ok"}'));

    await expect(getConnectionStatus(fetcher)).resolves.toEqual({
      apiUrl: 'http://localhost:3002',
      reachable: true,
      tokenConfigured: false,
      passwordConfigured: false,
      models: [
        { capability: 'profileAnalyzer', modelId: 'gpt-4.1-mini' },
        { capability: 'proposalWriter', modelId: 'gpt-4.1-mini' },
      ],
    });
    expect(fetcher).toHaveBeenCalledWith('http://localhost:3002/health', expect.anything());
  });

  it('degrades to unreachable without asking for the models', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(getConnectionStatus(fetcher)).resolves.toMatchObject({
      reachable: false,
      models: null,
    });
    expect(getModelConsole).not.toHaveBeenCalled();
  });

  it('shows a configured token', async () => {
    vi.stubEnv('API_TOKEN', 'secret-token-value');
    getModelConsole.mockRejectedValue(new Error('down'));
    const fetcher = vi.fn(async () => new Response('{}'));

    await expect(getConnectionStatus(fetcher)).resolves.toMatchObject({
      tokenConfigured: true,
      models: null,
    });
  });
});
