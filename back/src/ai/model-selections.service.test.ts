import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.schema';
import type { ModelSelectionRow } from '../database/schema';
import { developmentDefaults } from './capabilities';
import type { ModelCatalogService } from './model-catalog/model-catalog.service';
import type { CatalogModelRecord } from './model-catalog/model-catalog.types';
import type { ModelSelectionsRepository } from './model-selections.repository';
import { ModelSelectionsService } from './model-selections.service';

describe('ModelSelectionsService', () => {
  it('resolves a valid saved row from the selection layer', async () => {
    const service = createService({ row: selectionRow() });

    await expect(service.resolve('profileAnalyzer')).resolves.toMatchObject({
      primary: 'admin-primary',
      fallback: 'admin-fallback',
      source: 'selection',
      warnings: [expect.stringContaining('same model family')],
    });
  });

  it('uses environment overrides when no row exists', async () => {
    const service = createService({
      env: {
        AI_MODEL_PROFILE_ANALYZER_PRIMARY: 'env-primary',
        AI_MODEL_PROFILE_ANALYZER_FALLBACK: 'env-fallback',
      },
    });

    await expect(service.resolve('profileAnalyzer')).resolves.toEqual({
      primary: 'env-primary',
      fallback: 'env-fallback',
      source: 'environment',
      warnings: [],
    });
  });

  it('uses the exact code defaults when neither row nor environment exists', async () => {
    const service = createService({});

    await expect(service.resolve('profileAnalyzer')).resolves.toEqual({
      ...developmentDefaults.profileAnalyzer,
      source: 'default',
      warnings: [],
    });
  });

  it.each([
    ['absent from the catalog', null],
    ['no longer supports structured output', model({ structuredOutputs: false })],
    [
      'has passed its sunset date',
      model({ deactivatedAt: '2000-01-01T00:00:00.000Z' }),
    ],
  ])('degrades without throwing when a saved model %s', async (_name, primary) => {
    const service = createService({
      row: selectionRow(),
      modelById: (id) => (id === 'admin-primary' ? primary : model({ id })),
    });

    const resolved = await service.resolve('profileAnalyzer');

    expect(resolved).toMatchObject({
      ...developmentDefaults.profileAnalyzer,
      source: 'default',
    });
    expect(resolved.warnings.join(' ')).toContain('Saved selection unusable:');
  });
});

function createService(options: {
  row?: ModelSelectionRow | null;
  env?: Partial<Env>;
  modelById?: (id: string) => CatalogModelRecord | null;
}) {
  const repository = {
    findByCapability: vi.fn().mockResolvedValue(options.row ?? null),
  } as unknown as ModelSelectionsRepository;
  const catalog = {
    findById: vi.fn((id: string) =>
      Promise.resolve(
        options.modelById === undefined
          ? model({ id })
          : options.modelById(id),
      ),
    ),
  } as unknown as ModelCatalogService;
  const config = {
    get: vi.fn((key: keyof Env) => options.env?.[key]),
  } as unknown as ConfigService<Env, true>;
  return new ModelSelectionsService(repository, catalog, config);
}

function selectionRow(): ModelSelectionRow {
  return {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa20',
    capability: 'profileAnalyzer',
    primaryModelId: 'admin-primary',
    fallbackModelId: 'admin-fallback',
    notes: null,
    updatedByUserId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
    createdAt: new Date('2026-09-04T00:00:00.000Z'),
    updatedAt: new Date('2026-09-04T00:00:00.000Z'),
  };
}

function model(overrides: Partial<CatalogModelRecord> = {}): CatalogModelRecord {
  return {
    id: 'admin-primary',
    displayName: 'Admin model',
    family: 'openai',
    inputPricePerMillion: 0.4,
    outputPricePerMillion: 1.6,
    contextLength: 128_000,
    maxOutput: null,
    sunsetsAt: null,
    providerIds: ['openai'],
    aliases: [],
    stability: null,
    jsonOutput: true,
    structuredOutputs: true,
    deactivatedAt: null,
    ...overrides,
  };
}
