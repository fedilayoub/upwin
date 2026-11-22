import type { LanguageModelMiddleware } from 'ai';

export interface CapturedUsage {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
  inputTokenDetails: {
    noCacheTokens: number | undefined;
    cacheReadTokens: number | undefined;
    cacheWriteTokens: number | undefined;
  };
  outputTokenDetails: {
    textTokens: number | undefined;
    reasoningTokens: number | undefined;
  };
}

export function createUsageMiddleware(
  capture: (usage: CapturedUsage) => void = () => undefined,
): LanguageModelMiddleware {
  return {
    specificationVersion: 'v4',
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      const inputTokens = result.usage.inputTokens.total;
      const outputTokens = result.usage.outputTokens.total;

      capture({
        inputTokens,
        outputTokens,
        totalTokens:
          inputTokens === undefined && outputTokens === undefined
            ? undefined
            : (inputTokens ?? 0) + (outputTokens ?? 0),
        inputTokenDetails: {
          noCacheTokens: result.usage.inputTokens.noCache,
          cacheReadTokens: result.usage.inputTokens.cacheRead,
          cacheWriteTokens: result.usage.inputTokens.cacheWrite,
        },
        outputTokenDetails: {
          textTokens: result.usage.outputTokens.text,
          reasoningTokens: result.usage.outputTokens.reasoning,
        },
      });

      return result;
    },
  };
}
