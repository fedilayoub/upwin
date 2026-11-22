import { Inject, Injectable } from '@nestjs/common';
import {
  generateObject,
  NoObjectGeneratedError,
  type FinishReason,
  type LanguageModelUsage,
} from 'ai';
import type { z } from 'zod';
import type {
  AiCapability,
  AiModelAttempt,
  CapabilityModelIds,
} from './capabilities';
import { CassetteNotFoundError } from './middleware/cassette.middleware';
import {
  AI_GATEWAY_ID,
  AI_MODEL_REGISTRY,
  type AiModelRegistry,
} from './model-registry';

export interface AiEvaluationRequest<OUTPUT> {
  capability: AiCapability;
  schema: z.ZodType<OUTPUT>;
  schemaName: string;
  system: string;
  prompt: string;
  temperature?: number;
  variantIndex?: number;
  models?: CapabilityModelIds;
}

export interface AiEvaluationResult<OUTPUT> {
  object: OUTPUT;
  requestedModelId: string;
  provider: string;
  model: string;
  gateway: typeof AI_GATEWAY_ID | undefined;
  usage: LanguageModelUsage;
  finishReason: FinishReason;
}

export class AiEvaluationError extends Error {
  readonly code = 'AI_EVALUATION_FAILED' as const;

  constructor(cause: unknown) {
    super('The AI evaluation could not be completed.', { cause });
    this.name = 'AiEvaluationError';
  }
}

@Injectable()
export class ModelRegistryService {
  constructor(
    @Inject(AI_MODEL_REGISTRY)
    private readonly registry: AiModelRegistry,
  ) {}

  get mode(): AiModelRegistry['mode'] {
    return this.registry.mode;
  }

  async evaluate<OUTPUT>(request: AiEvaluationRequest<OUTPUT>): Promise<AiEvaluationResult<OUTPUT>> {
    try {
      return await this.evaluateWith('primary', request);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) throw new AiEvaluationError(error);
      if (error instanceof CassetteNotFoundError) throw error;

      try {
        return await this.evaluateWith('fallback', request);
      } catch (fallbackError) {
        if (fallbackError instanceof CassetteNotFoundError) throw fallbackError;
        throw new AiEvaluationError(fallbackError);
      }
    }
  }

  evaluateAttempt<OUTPUT>(
    attempt: AiModelAttempt,
    request: AiEvaluationRequest<OUTPUT>,
  ): Promise<AiEvaluationResult<OUTPUT>> {
    return this.evaluateWith(attempt, request);
  }

  private async evaluateWith<OUTPUT>(
    attempt: AiModelAttempt,
    request: AiEvaluationRequest<OUTPUT>,
  ): Promise<AiEvaluationResult<OUTPUT>> {
    const resolved = this.registry.resolve(
      request.capability,
      attempt,
      request.variantIndex ?? 0,
      request.models,
    );
    const result = await generateObject({
      model: resolved.model,
      schema: request.schema,
      schemaName: request.schemaName,
      system: request.system,
      prompt: request.prompt,
      temperature: request.temperature ?? 0.2,
      maxRetries: 2,
    });
    const servedModelId = result.response.modelId;

    return {
      object: result.object,
      requestedModelId: resolved.requestedModelId,
      provider: deriveProvider(servedModelId),
      model: servedModelId,
      gateway: this.registry.mode === 'fake' ? undefined : AI_GATEWAY_ID,
      usage: result.usage,
      finishReason: result.finishReason,
    };
  }
}

export function deriveProvider(servedModelId: string): string {
  const separator = servedModelId.indexOf('/');
  return separator === -1 ? servedModelId : servedModelId.slice(0, separator);
}
