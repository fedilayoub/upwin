import type { LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type {
  AiCapability,
  AiModelAttempt,
  CapabilityModelIds,
} from './capabilities';
import type { AiModelRegistry } from './model-registry';
import { ModelRegistryService } from './model-registry.service';

describe('ModelRegistryService selection overrides', () => {
  it('requests the selected fallback id after the selected primary fails', async () => {
    const resolve = vi.fn(
      (
        _capability: AiCapability,
        attempt: AiModelAttempt,
        _variant: number,
        overrides?: CapabilityModelIds,
      ) => {
        if (!overrides) throw new Error('Expected model selection overrides.');
        return {
          model:
            attempt === 'primary'
              ? throwingModel()
              : returningModel('anthropic/admin-fallback'),
          requestedModelId: overrides[attempt],
        };
      },
    );
    const registry = { mode: 'live', resolve } as unknown as AiModelRegistry;
    const service = new ModelRegistryService(registry);
    const selected = { primary: 'admin-primary', fallback: 'admin-fallback' };

    const result = await service.evaluate({
      capability: 'profileAnalyzer',
      schema: z.object({ answer: z.string() }),
      schemaName: 'overrideProbe',
      system: 'system',
      prompt: 'prompt',
      models: selected,
    });

    expect(result.requestedModelId).toBe('admin-fallback');
    expect(resolve).toHaveBeenNthCalledWith(
      1,
      'profileAnalyzer',
      'primary',
      0,
      selected,
    );
    expect(resolve).toHaveBeenNthCalledWith(
      2,
      'profileAnalyzer',
      'fallback',
      0,
      selected,
    );
  });
});

function throwingModel(): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: () => {
      throw new Error('primary unavailable');
    },
  });
}

function returningModel(servedModelId: string): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify({ answer: 'ok' }) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
      response: { modelId: servedModelId },
    },
  });
}
