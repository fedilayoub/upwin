import { describe, expect, it, vi } from 'vitest';
import fixture from './model-catalog.fixture.json';
import { gatewayModelCatalogEntrySchema } from './model-catalog.schema';
import {
  ModelCatalogService,
  parseModelCatalog,
} from './model-catalog.service';

const NOW = new Date('2026-09-04T12:00:00.000Z');

describe('ModelCatalogService', () => {
  it('keeps the committed fixture synchronized with the gateway entry schema', () => {
    for (const entry of fixture.data) {
      expect(gatewayModelCatalogEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('skips a malformed entry without rejecting the valid page', () => {
    const parsed = parseModelCatalog(
      { data: [validEntry(), { id: 'missing-required-fields' }] },
      NOW,
    );

    expect(parsed.all).toHaveLength(1);
    expect(parsed.skippedCount).toBe(1);
  });

  it('filters structured output correctly and handles future versus past sunsets', () => {
    const parsed = parseModelCatalog(
      {
        data: [
          validEntry({ id: 'structured' }),
          validEntry({ id: 'plain-json', structured_outputs: false }),
          validEntry({
            id: 'future-sunset',
            deactivated_at: '2026-10-16T00:00:00.000Z',
          }),
          validEntry({
            id: 'past-sunset',
            deactivated_at: '2026-01-01T00:00:00.000Z',
          }),
        ],
      },
      NOW,
    );

    expect(parsed.selectable.map((model) => model.id)).toEqual([
      'future-sunset',
      'structured',
    ]);
    expect(parsed.selectable[0]?.sunsetsAt).toBe(
      '2026-10-16T00:00:00.000Z',
    );
  });

  it('converts scientific-notation per-token prices to per-million prices', () => {
    const parsed = parseModelCatalog(
      { data: [validEntry({ pricing: { prompt: '0.4e-6', completion: '1.6e-6' } })] },
      NOW,
    );

    expect(parsed.selectable[0]).toMatchObject({
      inputPricePerMillion: 0.4,
      outputPricePerMillion: 1.6,
    });
  });

  it('refreshes after the TTL and serves stale data when that refresh fails', async () => {
    let now = NOW.getTime();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [validEntry({ id: 'cached' })] }))
      .mockResolvedValueOnce(jsonResponse({ data: [validEntry({ id: 'refreshed' })] }))
      .mockRejectedValueOnce(new Error('gateway unavailable'));
    const service = new ModelCatalogService(
      fetcher,
      'replay',
      'https://ai.example.test/v1/models',
      { now: () => now, ttlMs: 100 },
    );

    await expect(service.listSelectable()).resolves.toMatchObject([{ id: 'cached' }]);
    await service.listSelectable();
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 101;
    await expect(service.listSelectable()).resolves.toMatchObject([{ id: 'refreshed' }]);
    now += 101;
    await expect(service.listSelectable()).resolves.toMatchObject([{ id: 'refreshed' }]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('serves an empty catalog when the first fetch fails, and retries on the next request', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ data: [validEntry({ id: 'later' })] }));
    const service = new ModelCatalogService(
      fetcher,
      'live',
      'http://localhost:11434/v1/models',
      { now: () => NOW.getTime() },
    );

    await expect(service.listSelectable()).resolves.toEqual([]);
    await expect(service.findById('anything')).resolves.toBeNull();
    await expect(service.listSelectable()).resolves.toMatchObject([{ id: 'later' }]);
  });

  it('uses the fixture and never calls the fetcher in fake mode', async () => {
    const fetcher = vi.fn();
    const service = new ModelCatalogService(
      fetcher,
      'fake',
      'https://ai.example.test/v1/models',
      { now: () => NOW.getTime() },
    );

    const models = await service.listSelectable();

    expect(models.length).toBeGreaterThan(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

function validEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-a',
    name: 'Model A',
    display_name: 'Model A',
    family: 'openai',
    pricing: { prompt: '0.1e-6', completion: '0.4e-6' },
    context_length: 128_000,
    json_output: true,
    structured_outputs: true,
    providers: [{ providerId: 'provider-a' }],
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
