import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import {
  developmentDefaults,
  resolveCapabilityModels,
  type CapabilityModelIds,
  type ModelSelectableCapability,
} from './capabilities';
import { ModelCatalogService, isPastSunset } from './model-catalog/model-catalog.service';
import type { CatalogModelRecord } from './model-catalog/model-catalog.types';
import { ModelSelectionsRepository } from './model-selections.repository';

export interface ResolvedCapabilityModels extends CapabilityModelIds {
  source: 'selection' | 'environment' | 'default';
  warnings: string[];
}

export interface BaselineCapabilityModels extends CapabilityModelIds {
  source: 'environment' | 'default';
}

@Injectable()
export class ModelSelectionsService {
  private readonly logger = new Logger(ModelSelectionsService.name);
  private readonly configuredModels;

  constructor(
    private readonly repository: ModelSelectionsRepository,
    private readonly catalog: ModelCatalogService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.configuredModels = resolveCapabilityModels({
      AI_MODEL: config.get('AI_MODEL', { infer: true }),
      AI_MODEL_PROFILE_ANALYZER_PRIMARY: config.get(
        'AI_MODEL_PROFILE_ANALYZER_PRIMARY',
        { infer: true },
      ),
      AI_MODEL_PROFILE_ANALYZER_FALLBACK: config.get(
        'AI_MODEL_PROFILE_ANALYZER_FALLBACK',
        { infer: true },
      ),
      AI_MODEL_PROFILE_IMPROVER_PRIMARY: config.get(
        'AI_MODEL_PROFILE_IMPROVER_PRIMARY',
        { infer: true },
      ),
      AI_MODEL_PROFILE_IMPROVER_FALLBACK: config.get(
        'AI_MODEL_PROFILE_IMPROVER_FALLBACK',
        { infer: true },
      ),
      AI_MODEL_CV_EXTRACTOR_PRIMARY: config.get(
        'AI_MODEL_CV_EXTRACTOR_PRIMARY',
        { infer: true },
      ),
      AI_MODEL_CV_EXTRACTOR_FALLBACK: config.get(
        'AI_MODEL_CV_EXTRACTOR_FALLBACK',
        { infer: true },
      ),
      AI_MODEL_JOB_MATCH_EVALUATOR_PRIMARY: config.get(
        'AI_MODEL_JOB_MATCH_EVALUATOR_PRIMARY',
        { infer: true },
      ),
      AI_MODEL_JOB_MATCH_EVALUATOR_FALLBACK: config.get(
        'AI_MODEL_JOB_MATCH_EVALUATOR_FALLBACK',
        { infer: true },
      ),
      AI_MODEL_PROPOSAL_WRITER_PRIMARY: config.get(
        'AI_MODEL_PROPOSAL_WRITER_PRIMARY',
        { infer: true },
      ),
      AI_MODEL_PROPOSAL_WRITER_FALLBACK: config.get(
        'AI_MODEL_PROPOSAL_WRITER_FALLBACK',
        { infer: true },
      ),
    });
  }

  getBaseline(capability: ModelSelectableCapability): BaselineCapabilityModels {
    const models = this.configuredModels[capability];
    return {
      ...models,
      source: this.hasEnvironmentOverride(capability)
        ? 'environment'
        : 'default',
    };
  }

  async resolve(
    capability: ModelSelectableCapability,
  ): Promise<ResolvedCapabilityModels> {
    const baseline = this.getBaseline(capability);
    let selection;
    try {
      selection = await this.repository.findByCapability(capability);
    } catch {
      this.logger.warn(
        `Model selection lookup failed for ${capability}; using the configured baseline.`,
      );
      return {
        ...baseline,
        warnings: ['The saved model selection could not be read; the configured baseline is in use.'],
      };
    }
    if (!selection) return { ...baseline, warnings: [] };

    try {
      const [primary, fallback] = await Promise.all([
        this.catalog.findById(selection.primaryModelId),
        this.catalog.findById(selection.fallbackModelId),
      ]);
      const warnings = unusableSelectionWarnings(
        selection.primaryModelId,
        selection.fallbackModelId,
        primary,
        fallback,
        new Date(),
      );
      if (warnings.some((warning) => warning.startsWith('Saved selection unusable:'))) {
        this.logger.warn(
          `Saved model selection for ${capability} is unusable; using the configured baseline.`,
        );
        return { ...baseline, warnings };
      }

      return {
        primary: selection.primaryModelId,
        fallback: selection.fallbackModelId,
        source: 'selection',
        warnings,
      };
    } catch {
      this.logger.warn(
        `Model catalog validation failed for ${capability}; using the configured baseline.`,
      );
      return {
        ...baseline,
        warnings: ['The saved selection could not be checked against the catalog; the configured baseline is in use.'],
      };
    }
  }

  private hasEnvironmentOverride(
    capability: ModelSelectableCapability,
  ): boolean {
    switch (capability) {
      case 'profileAnalyzer':
        return (
          this.config.get('AI_MODEL_PROFILE_ANALYZER_PRIMARY', { infer: true }) !== undefined ||
          this.config.get('AI_MODEL_PROFILE_ANALYZER_FALLBACK', { infer: true }) !== undefined
        );
      case 'jobMatchEvaluator':
        return (
          this.config.get('AI_MODEL_JOB_MATCH_EVALUATOR_PRIMARY', { infer: true }) !== undefined ||
          this.config.get('AI_MODEL_JOB_MATCH_EVALUATOR_FALLBACK', { infer: true }) !== undefined
        );
      case 'proposalWriter':
        return (
          this.config.get('AI_MODEL_PROPOSAL_WRITER_PRIMARY', { infer: true }) !== undefined ||
          this.config.get('AI_MODEL_PROPOSAL_WRITER_FALLBACK', { infer: true }) !== undefined
        );
    }
  }
}

function unusableSelectionWarnings(
  primaryId: string,
  fallbackId: string,
  primary: CatalogModelRecord | null,
  fallback: CatalogModelRecord | null,
  now: Date,
): string[] {
  const warnings: string[] = [];
  validateModel('primary', primaryId, primary, now, warnings);
  validateModel('fallback', fallbackId, fallback, now, warnings);

  if (warnings.length === 0 && primary?.family === fallback?.family) {
    warnings.push(
      'Primary and fallback are from the same model family; a provider-family outage may affect both.',
    );
  }
  for (const [label, model] of [
    ['Primary', primary],
    ['Fallback', fallback],
  ] as const) {
    if (model?.sunsetsAt) {
      warnings.push(`${label} model is scheduled to sunset on ${model.sunsetsAt}.`);
    }
  }
  return warnings;
}

function validateModel(
  label: 'primary' | 'fallback',
  id: string,
  model: CatalogModelRecord | null,
  now: Date,
  warnings: string[],
): void {
  if (id.includes('/')) {
    warnings.push(`Saved selection unusable: ${label} model id is provider-pinned.`);
  } else if (!model) {
    warnings.push(`Saved selection unusable: ${label} model is absent from the catalog.`);
  } else if (!model.structuredOutputs) {
    warnings.push(`Saved selection unusable: ${label} model no longer supports structured output.`);
  } else if (isPastSunset(model.deactivatedAt, now)) {
    warnings.push(`Saved selection unusable: ${label} model has passed its sunset date.`);
  }
}

export function exactDevelopmentDefaults(
  capability: ModelSelectableCapability,
): CapabilityModelIds {
  return developmentDefaults[capability];
}
