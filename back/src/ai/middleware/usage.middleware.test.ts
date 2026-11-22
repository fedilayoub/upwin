import { generateObject, wrapLanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { createUsageMiddleware } from './usage.middleware';

describe('usage middleware', () => {
  it('captures undefined token fields without coercing them to zero', async () => {
    const capture = vi.fn();
    const model = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doGenerate: {
          content: [{ type: 'text', text: '{"ok":true}' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: undefined, text: undefined, reasoning: undefined },
          },
          warnings: [],
        },
      }),
      middleware: createUsageMiddleware(capture),
    });

    await generateObject({ model, schema: z.object({ ok: z.boolean() }), prompt: 'probe' });

    expect(capture).toHaveBeenCalledWith({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    });
  });
});
