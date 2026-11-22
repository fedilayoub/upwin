import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LanguageModelMiddleware } from 'ai';
import { z } from 'zod';
import type { AiCapability } from '../capabilities';
import { createCassetteKey, createSchemaHash, stableSerialize } from './cassette-key';
import { sanitizeCassette } from './cassette-sanitizer';

const finishReasonSchema = z.enum([
  'stop',
  'length',
  'content-filter',
  'tool-calls',
  'error',
  'other',
]);

const cassetteSchema = z.object({
  key: z.string().min(1),
  capability: z.enum([
    'profileAnalyzer',
    'profileImprover',
    'cvExtractor',
    'jobMatchEvaluator',
    'proposalWriter',
  ]),
  requestedModelId: z.string().min(1),
  servedModelId: z.string().min(1),
  recordedAt: z.iso.datetime(),
  request: z.object({
    system: z.string(),
    prompt: z.string(),
    temperature: z.number().nullable(),
  }),
  response: z.object({
    object: z.unknown(),
    usage: z.object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
      inputTokenDetails: z
        .object({
          noCacheTokens: z.number().optional(),
          cacheReadTokens: z.number().optional(),
          cacheWriteTokens: z.number().optional(),
        })
        .optional(),
      outputTokenDetails: z
        .object({
          textTokens: z.number().optional(),
          reasoningTokens: z.number().optional(),
        })
        .optional(),
    }),
    finishReason: finishReasonSchema,
  }),
});

export type AiCassette = z.infer<typeof cassetteSchema>;

export class CassetteNotFoundError extends Error {
  constructor(capability: AiCapability, filePath: string) {
    super(
      `Missing replay cassette for ${capability} at ${filePath}. ` +
        'Record it with: AI_RECORD_CASSETTES=on pnpm start:dev (then repeat the request).',
    );
    this.name = 'CassetteNotFoundError';
  }
}

export interface CassetteMiddlewareOptions {
  mode: 'read' | 'write';
  capability: AiCapability;
  requestedModelId: string;
  variantIndex: number;
  cassetteDirectory: string;
  sensitiveTerms?: readonly string[];
  now?: () => Date;
}

export function createCassetteMiddleware(
  options: CassetteMiddlewareOptions,
): LanguageModelMiddleware {
  return {
    specificationVersion: 'v4',
    wrapGenerate: async ({ doGenerate, params }) => {
      const request = extractCassetteRequest(params);
      const key = createCassetteKey({
        capability: options.capability,
        requestedModelId: options.requestedModelId,
        temperature: request.temperature,
        system: request.system,
        prompt: request.prompt,
        schemaName: request.schemaName,
        schemaHash: request.schemaHash,
        variantIndex: options.variantIndex,
      });
      const filePath = join(
        options.cassetteDirectory,
        cassetteFileName(options.capability, key, options.variantIndex),
      );

      if (options.mode === 'read') {
        const cassette = await readCassette(filePath, options.capability);

        if (cassette.key !== key) {
          throw new Error(`Replay cassette key mismatch for ${options.capability}.`);
        }

        return cassetteToProviderResult(cassette);
      }

      const result = await doGenerate();
      const servedModelId = result.response?.modelId;
      if (!servedModelId) {
        throw new Error('The gateway response did not include response.modelId.');
      }

      const object = parseGeneratedObject(result.content);
      const inputTokens = result.usage.inputTokens.total;
      const outputTokens = result.usage.outputTokens.total;
      const cassette: AiCassette = {
        key,
        capability: options.capability,
        requestedModelId: options.requestedModelId,
        servedModelId,
        recordedAt: (options.now ?? (() => new Date()))().toISOString(),
        request: {
          system: request.system,
          prompt: request.prompt,
          temperature: request.temperature,
        },
        response: {
          object,
          usage: {
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
          },
          finishReason: result.finishReason.unified,
        },
      };

      await mkdir(options.cassetteDirectory, { recursive: true });
      await writeFile(
        filePath,
        `${JSON.stringify(sanitizeCassette(cassette, options.sensitiveTerms), null, 2)}\n`,
        'utf8',
      );

      return result;
    },
  };
}

export function cassetteFileName(
  capability: AiCapability,
  key: string,
  variantIndex: number,
): string {
  return `${capability}-${key}-v${variantIndex}.json`;
}

async function readCassette(filePath: string, capability: AiCapability): Promise<AiCassette> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) throw new CassetteNotFoundError(capability, filePath);
    throw error;
  }

  return cassetteSchema.parse(JSON.parse(source) as unknown);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function extractCassetteRequest(params: {
  prompt: ReadonlyArray<{
    role: string;
    content: string | ReadonlyArray<{ type: string; text?: string }>;
  }>;
  temperature?: number;
  responseFormat?:
    | { type: 'text' }
    | { type: 'json'; schema?: unknown; name?: string; description?: string };
}): {
  system: string;
  prompt: string;
  temperature: number | null;
  schemaName: string;
  schemaHash: string;
} {
  const systemParts: string[] = [];
  const promptParts: string[] = [];

  for (const message of params.prompt) {
    if (message.role === 'system' && typeof message.content === 'string') {
      systemParts.push(message.content);
      continue;
    }

    if (typeof message.content === 'string') continue;
    for (const part of message.content) {
      if (part.type === 'text' && part.text !== undefined) promptParts.push(part.text);
    }
  }

  const jsonFormat = params.responseFormat?.type === 'json' ? params.responseFormat : undefined;

  return {
    system: systemParts.join('\n'),
    prompt: promptParts.join('\n'),
    temperature: params.temperature ?? null,
    schemaName: jsonFormat?.name ?? '',
    schemaHash: createSchemaHash(jsonFormat?.schema ?? null),
  };
}

function parseGeneratedObject(content: ReadonlyArray<{ type: string; text?: string }>): unknown {
  const text = content
    .filter((part): part is { type: string; text: string } =>
      part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('');

  if (text.length === 0) throw new Error('Cannot record a cassette without generated text.');
  return JSON.parse(text) as unknown;
}

function cassetteToProviderResult(cassette: AiCassette) {
  const usage = cassette.response.usage;

  return {
    content: [{ type: 'text' as const, text: stableSerialize(cassette.response.object) }],
    finishReason: {
      unified: cassette.response.finishReason,
      raw: cassette.response.finishReason,
    },
    usage: {
      inputTokens: {
        total: usage.inputTokens,
        noCache: usage.inputTokenDetails?.noCacheTokens,
        cacheRead: usage.inputTokenDetails?.cacheReadTokens,
        cacheWrite: usage.inputTokenDetails?.cacheWriteTokens,
      },
      outputTokens: {
        total: usage.outputTokens,
        text: usage.outputTokenDetails?.textTokens,
        reasoning: usage.outputTokenDetails?.reasoningTokens,
      },
    },
    warnings: [],
    response: {
      modelId: cassette.servedModelId,
    },
  };
}
