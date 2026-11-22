import type { LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { capabilityFixtures } from './modes/fixtures/capability-fixtures';
import type { AiModelRegistry } from './model-registry';
import {
  AiEvaluationError,
  ModelRegistryService,
} from './model-registry.service';

describe('ModelRegistryService', () => {
  const request = {
    capability: 'profileAnalyzer' as const,
    schema: z.object({ answer: z.string() }),
    schemaName: 'probe',
    system: 'System prompt',
    prompt: 'User prompt',
  };

  it('runs the fake capability provider entirely offline', async () => {
    const { buildModelRegistry } = await import('./model-registry.js');
    const registry = buildModelRegistry({
      NODE_ENV: 'test',
      AI_BASE_URL: 'https://ai.example.test/v1',
    });
    const service = new ModelRegistryService(registry);
    const fixture = capabilityFixtures.profileAnalyzer;

    await expect(
      service.evaluate({
        ...request,
        schema: fixture.schema,
      }),
    ).resolves.toMatchObject({
      object: fixture.object,
      requestedModelId: 'gpt-4.1-mini',
      provider: 'fake',
      model: 'fake/profileAnalyzer',
      gateway: undefined,
    });
  });

  it('reports response.modelId and its provider prefix after primary failure', async () => {
    const primary = modelThatThrows(
      new Error('simulated primary provider failure'),
    );
    const fallback = modelThatReturns(
      'fallback answer',
      'aws-bedrock/claude-haiku-4-5:global',
    );
    const service = new ModelRegistryService(
      registryWith({ primary, fallback }, 'live'),
    );

    await expect(service.evaluate(request)).resolves.toMatchObject({
      object: { answer: 'fallback answer' },
      requestedModelId: 'claude-haiku-4-5',
      provider: 'aws-bedrock',
      model: 'aws-bedrock/claude-haiku-4-5:global',
      gateway: 'openai-compatible',
    });
  });

  it('maps off-schema output to AI_EVALUATION_FAILED without persisting', async () => {
    const primary = modelThatReturns(42, 'openai/gpt-4.1-nano');
    const fallback = modelThatReturns(
      'must not be used',
      'anthropic/claude-haiku-4-5',
    );
    const service = new ModelRegistryService(
      registryWith({ primary, fallback }, 'live'),
    );
    const persist = vi.fn();

    const evaluation = service.evaluate(request).then(persist);

    await expect(evaluation).rejects.toMatchObject({
      code: 'AI_EVALUATION_FAILED',
    });
    await expect(evaluation).rejects.toBeInstanceOf(AiEvaluationError);
    expect(persist).not.toHaveBeenCalled();
    expect(fallback.doGenerateCalls).toHaveLength(0);
  });
});

function registryWith(
  models: Record<'primary' | 'fallback', LanguageModel>,
  mode: AiModelRegistry['mode'],
): AiModelRegistry {
  return {
    mode,
    resolve(_capability, attempt) {
      return {
        model: models[attempt],
        requestedModelId:
          attempt === 'primary' ? 'gpt-4.1-nano' : 'claude-haiku-4-5',
      };
    },
  };
}

function modelThatThrows(error: Error): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: () => {
      throw error;
    },
  });
}

function modelThatReturns(
  answer: unknown,
  servedModelId: string,
): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify({ answer }) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 3, text: 3, reasoning: 0 },
      },
      warnings: [],
      response: { modelId: servedModelId },
    },
  });
}
