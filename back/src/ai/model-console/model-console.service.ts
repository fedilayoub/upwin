import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { z } from 'zod';
import type { ModelSelectionRow } from '../../database/schema';
import {
  MODEL_SELECTABLE_CAPABILITIES,
  type AiModelAttempt,
  type CapabilityModelIds,
  type ModelSelectableCapability,
} from '../capabilities';
import { ModelCatalogService, isPastSunset } from '../model-catalog/model-catalog.service';
import type {
  CatalogModel,
  CatalogModelRecord,
} from '../model-catalog/model-catalog.types';
import { ModelRegistryService } from '../model-registry.service';
import { ModelSelectionsRepository } from '../model-selections.repository';
import {
  ModelSelectionsService,
  type ResolvedCapabilityModels,
} from '../model-selections.service';
import { ModelUsageRepository } from './model-usage.repository';
import type { SetCapabilityModelsDto } from './model-console.schema';

const modelProbeSchema = z.object({
  ok: z.boolean(),
  note: z.string(),
});
const NO_RUN_INPUT_TOKENS = 7_700;
const NO_RUN_OUTPUT_TOKENS = 2_000;

export interface ModelCostEstimate {
  estimatedCostUsd: number;
  sampleRuns: number;
  label: 'recent-runs' | 'no-runs-yet';
  medianInputTokens: number;
  medianOutputTokens: number;
}

export interface CapabilityModelConsole {
  capability: ModelSelectableCapability;
  primaryModelId: string;
  fallbackModelId: string;
  primary: CatalogModel | null;
  fallback: CatalogModel | null;
  source: ResolvedCapabilityModels['source'];
  warnings: string[];
  notes: string | null;
  defaults: CapabilityModelIds & { source: 'environment' | 'default' };
  costEstimate: ModelCostEstimate;
}

@Injectable()
export class ModelConsoleService {
  constructor(
    private readonly selections: ModelSelectionsService,
    private readonly selectionRepository: ModelSelectionsRepository,
    private readonly catalog: ModelCatalogService,
    private readonly usage: ModelUsageRepository,
    private readonly models: ModelRegistryService,
  ) {}

  async getConsole(): Promise<{
    mode: ModelRegistryService['mode'];
    capabilities: CapabilityModelConsole[];
  }> {
    const [catalog, stored] = await Promise.all([
      this.catalog.listSelectable(),
      this.selectionRepository.listAll(),
    ]);
    const storedByCapability = new Map(
      stored.map((selection) => [selection.capability, selection]),
    );
    const capabilities = await Promise.all(
      MODEL_SELECTABLE_CAPABILITIES.map(async (capability) => {
        const resolved = await this.selections.resolve(capability);
        return this.toConsoleCapability(
          capability,
          resolved,
          storedByCapability.get(capability) ?? null,
          catalog,
        );
      }),
    );
    return { mode: this.models.mode, capabilities };
  }

  listCatalog(): Promise<CatalogModel[]> {
    return this.catalog.listSelectable();
  }

  async set(
    capability: ModelSelectableCapability,
    userId: string,
    input: SetCapabilityModelsDto,
  ): Promise<CapabilityModelConsole> {
    const [primary, fallback] = await Promise.all([
      this.requireSelectable(input.primaryModelId),
      this.requireSelectable(input.fallbackModelId),
    ]);
    const stored = await this.selectionRepository.upsert({
      capability,
      primaryModelId: primary.id,
      fallbackModelId: fallback.id,
      notes: input.notes ?? null,
      updatedByUserId: userId,
    });
    return this.getCapability(capability, stored);
  }

  async clear(
    capability: ModelSelectableCapability,
  ): Promise<CapabilityModelConsole> {
    await this.selectionRepository.clear(capability);
    return this.getCapability(capability, null);
  }

  async probe(capability: ModelSelectableCapability) {
    if (this.models.mode !== 'live') {
      throw new ConflictException({
        code: 'MODEL_PROBE_REQUIRES_LIVE_MODE',
        message: 'Model probes call the AI provider, which tests never do.',
      });
    }
    const resolved = await this.selections.resolve(capability);
    const overrides = {
      primary: resolved.primary,
      fallback: resolved.fallback,
    };
    const [primary, fallback] = await Promise.all([
      this.probeAttempt(capability, 'primary', overrides),
      this.probeAttempt(capability, 'fallback', overrides),
    ]);
    return { primary, fallback };
  }

  private async getCapability(
    capability: ModelSelectableCapability,
    stored: ModelSelectionRow | null,
  ): Promise<CapabilityModelConsole> {
    const [catalog, resolved] = await Promise.all([
      this.catalog.listSelectable(),
      this.selections.resolve(capability),
    ]);
    return this.toConsoleCapability(capability, resolved, stored, catalog);
  }

  private async toConsoleCapability(
    capability: ModelSelectableCapability,
    resolved: ResolvedCapabilityModels,
    stored: ModelSelectionRow | null,
    catalog: CatalogModel[],
  ): Promise<CapabilityModelConsole> {
    const primary = catalog.find((model) => model.id === resolved.primary) ?? null;
    const fallback = catalog.find((model) => model.id === resolved.fallback) ?? null;
    const warnings = [...resolved.warnings];
    if (primary?.sunsetsAt) {
      warnings.push(`Primary model is scheduled to sunset on ${primary.sunsetsAt}.`);
    }
    if (fallback?.sunsetsAt) {
      warnings.push(`Fallback model is scheduled to sunset on ${fallback.sunsetsAt}.`);
    }
    return {
      capability,
      primaryModelId: resolved.primary,
      fallbackModelId: resolved.fallback,
      primary,
      fallback,
      source: resolved.source,
      warnings: [...new Set(warnings)],
      notes: stored?.notes ?? null,
      defaults: this.selections.getBaseline(capability),
      costEstimate: await this.estimateCost(capability, primary),
    };
  }

  private async estimateCost(
    capability: ModelSelectableCapability,
    model: CatalogModel | null,
  ): Promise<ModelCostEstimate> {
    const rows = await this.usage.listRecent(capability);
    const samples = rows
      .map(({ usage }) => ({
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }))
      .filter(
        (sample): sample is { inputTokens: number; outputTokens: number } =>
          sample.inputTokens !== null && sample.outputTokens !== null,
      );
    const medianInputTokens =
      samples.length === 0
        ? NO_RUN_INPUT_TOKENS
        : median(samples.map((sample) => sample.inputTokens));
    const medianOutputTokens =
      samples.length === 0
        ? NO_RUN_OUTPUT_TOKENS
        : median(samples.map((sample) => sample.outputTokens));
    const estimatedCostUsd =
      model === null
        ? 0
        : (medianInputTokens * model.inputPricePerMillion +
            medianOutputTokens * model.outputPricePerMillion) /
          1_000_000;
    return {
      estimatedCostUsd,
      sampleRuns: samples.length,
      label: samples.length === 0 ? 'no-runs-yet' : 'recent-runs',
      medianInputTokens,
      medianOutputTokens,
    };
  }

  private async requireSelectable(id: string): Promise<CatalogModelRecord> {
    let model;
    try {
      model = await this.catalog.findById(id);
    } catch {
      throw new ServiceUnavailableException({
        code: 'MODEL_CATALOG_UNAVAILABLE',
        message: 'The model catalog is temporarily unavailable.',
      });
    }
    if (!model) throw invalidModelSelection('The selected model is not in the catalog.');
    if (!model.structuredOutputs) {
      throw invalidModelSelection('The selected model does not support structured output.');
    }
    if (isPastSunset(model.deactivatedAt, new Date())) {
      throw invalidModelSelection('The selected model has passed its sunset date.');
    }
    return model;
  }

  private async probeAttempt(
    capability: ModelSelectableCapability,
    attempt: AiModelAttempt,
    overrides: CapabilityModelIds,
  ): Promise<{
    ok: boolean;
    servedModelId?: string;
    latencyMs: number;
    error?: string;
  }> {
    const startedAt = performance.now();
    try {
      const result = await this.models.evaluateAttempt(attempt, {
        capability,
        schema: modelProbeSchema,
        schemaName: 'modelConsoleProbe',
        system: 'Return the requested two-field structured object only.',
        prompt: 'Set ok to true and note to a short confirmation.',
        temperature: 0,
        models: overrides,
      });
      return {
        ok: true,
        servedModelId: result.model,
        latencyMs: Math.round(performance.now() - startedAt),
      };
    } catch (error: unknown) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - startedAt),
        error: describeProbeFailure(attempt, error),
      };
    }
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const right = sorted[middle];
  if (right === undefined) throw new Error('Median requires at least one value.');
  if (sorted.length % 2 === 1) return right;
  const left = sorted[middle - 1];
  if (left === undefined) throw new Error('Median pair is incomplete.');
  return (left + right) / 2;
}

const PROBE_ERROR_MAX_LENGTH = 400;

/**
 * The probe exists to catch the failure the catalog cannot predict: `structured_outputs` is a
 * union across a model's providers, and routing picks one per call, so a model the catalog
 * reports as capable can still answer "does not support JSON schema output mode". That sentence
 * is the whole diagnosis, and `AiEvaluationError` keeps it in its `cause`. This surface is
 * admin-only, so the upstream text is safe to show — a generic message here would make the
 * probe able to say only that something failed, never what.
 */
export function describeProbeFailure(
  attempt: AiModelAttempt,
  error: unknown,
): string {
  const detail = collectErrorMessages(error).join(' <- ');
  const prefix = `The ${attempt} model did not complete the structured probe.`;
  if (detail.length === 0) return prefix;
  const truncated =
    detail.length > PROBE_ERROR_MAX_LENGTH
      ? `${detail.slice(0, PROBE_ERROR_MAX_LENGTH)}…`
      : detail;
  return `${prefix} ${truncated}`;
}

function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;

  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    const message =
      current instanceof Error
        ? current.message
        : typeof current === 'string'
          ? current
          : '';
    const trimmed = message.trim();
    if (trimmed.length > 0 && !messages.includes(trimmed)) messages.push(trimmed);
    current = current instanceof Error ? current.cause : undefined;
  }

  return messages;
}

function invalidModelSelection(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'MODEL_SELECTION_INVALID',
    message,
  });
}
