import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { DatabaseModule } from '../database/database.module';
import { createGatewayCatalogFetcher } from './model-catalog/gateway-catalog-fetcher';
import {
  ModelCatalogService,
  type CatalogFetcher,
} from './model-catalog/model-catalog.service';
import { ModelSelectionsRepository } from './model-selections.repository';
import { ModelSelectionsService } from './model-selections.service';
import { AI_MODEL_REGISTRY, buildModelRegistry } from './model-registry';
import { ModelRegistryService } from './model-registry.service';

const MODEL_CATALOG_FETCHER = Symbol('MODEL_CATALOG_FETCHER');

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AI_MODEL_REGISTRY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildModelRegistry({
          NODE_ENV: config.getOrThrow('NODE_ENV', { infer: true }),
          AI_RECORD_CASSETTES: config.get('AI_RECORD_CASSETTES', { infer: true }) ?? 'off',
          AI_API_KEY: config.get('AI_API_KEY', { infer: true }),
          AI_BASE_URL: config.get('AI_BASE_URL', { infer: true }),
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
          AI_MODEL_CV_EXTRACTOR_PRIMARY: config.get('AI_MODEL_CV_EXTRACTOR_PRIMARY', {
            infer: true,
          }),
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
        }),
    },
    {
      provide: MODEL_CATALOG_FETCHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): CatalogFetcher =>
        createGatewayCatalogFetcher(
          config.get('AI_API_KEY', { infer: true }),
        ),
    },
    {
      provide: ModelCatalogService,
      inject: [MODEL_CATALOG_FETCHER, AI_MODEL_REGISTRY, ConfigService],
      useFactory: (
        fetcher: CatalogFetcher,
        registry: ReturnType<typeof buildModelRegistry>,
        config: ConfigService<Env, true>,
      ) =>
        new ModelCatalogService(
          fetcher,
          registry.mode,
          // Only fetched in live mode, where the env schema requires AI_BASE_URL.
          `${(config.get('AI_BASE_URL', { infer: true }) ?? 'http://ai-base-url.invalid').replace(/\/+$/u, '')}/models`,
        ),
    },
    ModelRegistryService,
    ModelSelectionsRepository,
    ModelSelectionsService,
  ],
  exports: [
    ModelCatalogService,
    ModelRegistryService,
    ModelSelectionsRepository,
    ModelSelectionsService,
  ],
})
export class AiModule {}
