import { resolve } from 'node:path';
import { createOpenAI } from '@ai-sdk/openai';
import {
  customProvider,
  extractJsonMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { Env } from '../config/env.schema';
import {
  resolveCapabilityModels,
  type AiCapability,
  type AiModelAttempt,
  type CapabilityModelIds,
} from './capabilities';
import {
  readGitAuthorSensitiveTerms,
  type GitConfigReader,
} from './git-author-identity';
import { createCassetteMiddleware } from './middleware/cassette.middleware';
import { createUsageMiddleware } from './middleware/usage.middleware';
import { resolveAiMode, type AiMode } from './modes/ai-mode';
import { createFakeLanguageModel } from './modes/fake.provider';

export const AI_MODEL_REGISTRY = Symbol('AI_MODEL_REGISTRY');
/** Recorded on every analysis row as the transport that served it. */
export const AI_GATEWAY_ID = 'openai-compatible' as const;

export type AiRegistryEnvironment = Pick<
  Env,
  | 'NODE_ENV'
  | 'AI_API_KEY'
  | 'AI_BASE_URL'
  | 'AI_MODEL'
  | 'AI_MODEL_PROFILE_ANALYZER_PRIMARY'
  | 'AI_MODEL_PROFILE_ANALYZER_FALLBACK'
  | 'AI_MODEL_PROFILE_IMPROVER_PRIMARY'
  | 'AI_MODEL_PROFILE_IMPROVER_FALLBACK'
  | 'AI_MODEL_CV_EXTRACTOR_PRIMARY'
  | 'AI_MODEL_CV_EXTRACTOR_FALLBACK'
  | 'AI_MODEL_JOB_MATCH_EVALUATOR_PRIMARY'
  | 'AI_MODEL_JOB_MATCH_EVALUATOR_FALLBACK'
  | 'AI_MODEL_PROPOSAL_WRITER_PRIMARY'
  | 'AI_MODEL_PROPOSAL_WRITER_FALLBACK'
> & {
  /** Tests only: `fake` or `replay`. Outside NODE_ENV=test the provider is always live. */
  AI_MODE?: AiMode;
  /** Contributors only: record live calls as cassettes. Off unless set. */
  AI_RECORD_CASSETTES?: 'on' | 'off';
};
export interface ResolvedAiModel {
  model: LanguageModel;
  requestedModelId: string;
}

export interface AiModelRegistry {
  readonly mode: AiMode;
  resolve(
    capability: AiCapability,
    attempt: AiModelAttempt,
    variantIndex: number,
    overrides?: CapabilityModelIds,
  ): ResolvedAiModel;
}

export interface ModelRegistryOptions {
  cassetteDirectory?: string;
  sensitiveTerms?: readonly string[];
  gitConfigReader?: GitConfigReader;
  now?: () => Date;
}

export function buildModelRegistry(
  environment: AiRegistryEnvironment,
  options: ModelRegistryOptions = {},
): AiModelRegistry {
  const mode = resolveAiMode(environment);
  const configuredModels = resolveCapabilityModels(environment);
  const cassetteDirectory =
    options.cassetteDirectory ?? resolve(process.cwd(), 'src/ai/__cassettes__');
  // Cassettes embed the full prompt, which for the analyzer, improver, and CV
  // extractor is a real user's profile or CV. Recording is a contributor tool
  // for capturing replay fixtures: opt-in, and never in production. The
  // production image also runs as a non-root user against a root-owned
  // cassette directory, so a write there would fail and take the request with it.
  const recordCassettes =
    mode === 'live' &&
    environment.NODE_ENV !== 'production' &&
    environment.AI_RECORD_CASSETTES === 'on';
  const sensitiveTerms =
    recordCassettes
      ? [
          ...readGitAuthorSensitiveTerms(options.gitConfigReader),
          ...(options.sensitiveTerms ?? []),
        ]
      : options.sensitiveTerms;
  const gateway =
    mode === 'live'
      ? createOpenAI({
          name: AI_GATEWAY_ID,
          // Local servers (Ollama, LM Studio) ignore the key, but the SDK
          // falls back to OPENAI_API_KEY and throws when none is passed.
          apiKey: environment.AI_API_KEY ?? 'not-required',
          baseURL: requireBaseUrl(environment.AI_BASE_URL),
        })
      : undefined;

  return {
    mode,
    resolve(capability, attempt, variantIndex, overrides) {
      const requestedModelId =
        overrides?.[attempt] ?? configuredModels[capability][attempt];
      const provider = customProvider({
        languageModels: {
          [capability]: createModeModel(
            capability,
            requestedModelId,
            variantIndex,
          ),
        },
      });

      return {
        model: provider.languageModel(capability),
        requestedModelId,
      };
    },
  };

  function createModeModel(
    capability: AiCapability,
    requestedModelId: string,
    variantIndex: number,
  ): LanguageModel {
    if (mode === 'fake') {
      return wrapLanguageModel({
        model: createFakeLanguageModel(capability, variantIndex),
        middleware: createUsageMiddleware(),
      });
    }

    if (mode === 'replay') {
      const throwingStub = new MockLanguageModelV4({
        provider: 'cassette-replay',
        modelId: requestedModelId,
        doGenerate: () => {
          throw new Error('Replay attempted to call its throwing base model.');
        },
      });

      return wrapLanguageModel({
        model: throwingStub,
        middleware: createCassetteMiddleware({
          mode: 'read',
          capability,
          requestedModelId,
          variantIndex,
          cassetteDirectory,
        }),
      });
    }

    if (!gateway)
      throw new Error('Live AI mode was resolved without a gateway provider.');

    const liveMiddleware = [createUsageMiddleware(), extractJsonMiddleware()];

    return wrapLanguageModel({
      model: gateway.chat(requestedModelId),
      middleware: recordCassettes
        ? [
            createCassetteMiddleware({
              mode: 'write',
              capability,
              requestedModelId,
              variantIndex,
              cassetteDirectory,
              sensitiveTerms,
              now: options.now,
            }),
            ...liveMiddleware,
          ]
        : liveMiddleware,
    });
  }
}

function requireBaseUrl(baseUrl: string | undefined): string {
  if (baseUrl !== undefined) return baseUrl;
  throw new Error('AI_BASE_URL is required in live AI mode.');
}

