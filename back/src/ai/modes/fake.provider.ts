import { MockLanguageModelV4 } from 'ai/test';
import type { AiCapability } from '../capabilities';
import { capabilityFixtures } from './fixtures/capability-fixtures';

export function createFakeLanguageModel(
  capability: AiCapability,
  variantIndex = 0,
): MockLanguageModelV4 {
  const selected = capabilityFixtures[capability];
  const variants = 'variants' in selected ? selected.variants : undefined;
  const fixture =
    variants === undefined
      ? selected.object
      : variants[variantIndex % variants.length];

  return new MockLanguageModelV4({
    provider: 'fake',
    modelId: capability,
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify(fixture) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: {
          total: undefined,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: undefined,
          text: undefined,
          reasoning: undefined,
        },
      },
      warnings: [],
      response: {
        id: `fake-${capability}`,
        timestamp: new Date(0),
        modelId: `fake/${capability}`,
      },
    },
  });
}
