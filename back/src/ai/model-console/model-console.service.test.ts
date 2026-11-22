import { describe, expect, it, vi } from 'vitest';
import type { ModelSelectionRow } from '../../database/schema';
import type { ModelCatalogService } from '../model-catalog/model-catalog.service';
import type {
  CatalogModel,
  CatalogModelRecord,
} from '../model-catalog/model-catalog.types';
import type { ModelRegistryService } from '../model-registry.service';
import type { ModelSelectionsRepository } from '../model-selections.repository';
import type { UpsertModelSelectionInput } from '../model-selections.repository';
import type { ModelSelectionsService } from '../model-selections.service';
import {
  describeProbeFailure,
  ModelConsoleService,
} from './model-console.service';
import type { ModelUsageRepository } from './model-usage.repository';

describe('ModelConsoleService', () => {
  it.each([
    ['an unknown id', 'unknown', 'admin-fallback'],
    ['a non-structured model', 'plain-json', 'admin-fallback'],
    ['a provider-pinned id', 'openai/admin-primary', 'admin-fallback'],
    ['a past-sunset model', 'past-sunset', 'admin-fallback'],
  ])('rejects %s with 422', async (_name, primaryModelId, fallbackModelId) => {
    const { service } = harness();

    await expect(
      service.set('profileAnalyzer', USER_ID, {
        primaryModelId,
        fallbackModelId,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('accepts a same-family pair and returns its warning', async () => {
    const { service, upsert } = harness();

    const response = await service.set('profileAnalyzer', USER_ID, {
      primaryModelId: 'admin-primary',
      fallbackModelId: 'admin-fallback',
      notes: 'Measured quality against the production prompt.',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryModelId: 'admin-primary',
        fallbackModelId: 'admin-fallback',
        updatedByUserId: USER_ID,
      }),
    );
    expect(response.warnings.join(' ')).toContain('same model family');
  });

  it('clears the row and returns the baseline selection', async () => {
    const { service, clear } = harness({ source: 'default' });

    const response = await service.clear('profileAnalyzer');

    expect(clear).toHaveBeenCalledWith('profileAnalyzer');
    expect(response.source).toBe('default');
  });

  it('rejects paid probes outside live mode with 409', async () => {
    const { service } = harness({ mode: 'replay' });

    await expect(service.probe('profileAnalyzer')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('computes median-token cost from the most recent usable rows', async () => {
    const { service } = harness({
      usageRows: [
        usage(100, 10),
        usage(300, 30),
        usage(200, 20),
      ],
    });

    const response = await service.getConsole();
    const profile = response.capabilities.find(
      (item) => item.capability === 'profileAnalyzer',
    );

    expect(profile?.costEstimate).toEqual({
      estimatedCostUsd: 0.00024,
      sampleRuns: 3,
      label: 'recent-runs',
      medianInputTokens: 200,
      medianOutputTokens: 20,
    });
  });

  it('labels the measured analyzer fallback estimate when there are no rows', async () => {
    const { service } = harness({ usageRows: [] });

    const response = await service.getConsole();
    const profile = response.capabilities.find(
      (item) => item.capability === 'profileAnalyzer',
    );

    expect(profile?.costEstimate).toMatchObject({
      sampleRuns: 0,
      label: 'no-runs-yet',
      medianInputTokens: 7_700,
      medianOutputTokens: 2_000,
    });
  });
});

function harness(options: {
  mode?: 'fake' | 'replay' | 'live';
  source?: 'selection' | 'environment' | 'default';
  usageRows?: Array<{ usage: ReturnType<typeof usage>['usage'] }>;
} = {}) {
  const records = [
    model({ id: 'admin-primary', family: 'openai' }),
    model({ id: 'admin-fallback', family: 'openai' }),
    model({ id: 'plain-json', structuredOutputs: false }),
    model({
      id: 'past-sunset',
      deactivatedAt: '2000-01-01T00:00:00.000Z',
    }),
  ];
  const selectable = records
    .filter(
      (record) =>
        record.structuredOutputs && record.id !== 'past-sunset',
    )
    .map(publicModel);
  const catalog = {
    listSelectable: vi.fn().mockResolvedValue(selectable),
    findById: vi.fn((id: string) =>
      Promise.resolve(records.find((record) => record.id === id) ?? null),
    ),
  } as unknown as ModelCatalogService;
  const source = options.source ?? 'selection';
  const selections = {
    resolve: vi.fn().mockImplementation((capability: string) =>
      Promise.resolve({
        primary: 'admin-primary',
        fallback: 'admin-fallback',
        source,
        warnings:
          source === 'selection'
            ? ['Primary and fallback are from the same model family.']
            : [],
        capability,
      }),
    ),
    getBaseline: vi.fn().mockReturnValue({
      primary: 'admin-primary',
      fallback: 'admin-fallback',
      source: 'default',
    }),
  } as unknown as ModelSelectionsService;
  const upsert = vi.fn((input: UpsertModelSelectionInput) =>
    Promise.resolve(selectionRow(input.notes)),
  );
  const clear = vi.fn().mockResolvedValue(null);
  const selectionRepository = {
    listAll: vi.fn().mockResolvedValue([selectionRow(null)]),
    upsert,
    clear,
  } as unknown as ModelSelectionsRepository;
  const usageRepository = {
    listRecent: vi.fn().mockResolvedValue(options.usageRows ?? []),
  } as unknown as ModelUsageRepository;
  const modelRegistry = {
    mode: options.mode ?? 'fake',
    evaluateAttempt: vi.fn(),
  } as unknown as ModelRegistryService;
  return {
    service: new ModelConsoleService(
      selections,
      selectionRepository,
      catalog,
      usageRepository,
      modelRegistry,
    ),
    upsert,
    clear,
  };
}

function model(overrides: Partial<CatalogModelRecord>): CatalogModelRecord {
  return {
    id: 'model',
    displayName: 'Model',
    family: 'openai',
    inputPricePerMillion: 1,
    outputPricePerMillion: 2,
    contextLength: 128_000,
    maxOutput: null,
    sunsetsAt: null,
    providerIds: ['provider'],
    aliases: [],
    stability: null,
    jsonOutput: true,
    structuredOutputs: true,
    deactivatedAt: null,
    ...overrides,
  };
}

function publicModel(record: CatalogModelRecord): CatalogModel {
  return {
    id: record.id,
    displayName: record.displayName,
    family: record.family,
    inputPricePerMillion: record.inputPricePerMillion,
    outputPricePerMillion: record.outputPricePerMillion,
    contextLength: record.contextLength,
    maxOutput: record.maxOutput,
    sunsetsAt: record.sunsetsAt,
    providerIds: record.providerIds,
    aliases: record.aliases,
    stability: record.stability,
  };
}

function usage(inputTokens: number, outputTokens: number) {
  return {
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}

function selectionRow(notes: string | null): ModelSelectionRow {
  return {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa20',
    capability: 'profileAnalyzer',
    primaryModelId: 'admin-primary',
    fallbackModelId: 'admin-fallback',
    notes,
    updatedByUserId: USER_ID,
    createdAt: new Date('2026-09-04T00:00:00.000Z'),
    updatedAt: new Date('2026-09-04T00:00:00.000Z'),
  };
}

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';

describe('describeProbeFailure', () => {
  it('surfaces the gateway sentence the catalog cannot predict', () => {
    const cause = new Error(
      'Model deepseek-v4-flash does not support JSON schema output mode',
    );
    const error = new Error('The AI evaluation could not be completed.', { cause });

    const described = describeProbeFailure('primary', error);

    expect(described).toContain('The primary model did not complete the structured probe.');
    expect(described).toContain('does not support JSON schema output mode');
  });

  it('walks the whole cause chain, skips repeats, and stops on a cycle', () => {
    const inner = new Error('inner failure');
    const middle = new Error('inner failure', { cause: inner });
    const outer = new Error('outer failure', { cause: middle });
    inner.cause = outer;

    const described = describeProbeFailure('fallback', outer);

    expect(described).toBe(
      'The fallback model did not complete the structured probe. outer failure <- inner failure',
    );
  });

  it('truncates a runaway provider message', () => {
    const described = describeProbeFailure('primary', new Error('x'.repeat(900)));

    expect(described.length).toBeLessThan(500);
    expect(described.endsWith('…')).toBe(true);
  });

  it('falls back to the plain sentence when the failure carries no message', () => {
    expect(describeProbeFailure('primary', new Error(''))).toBe(
      'The primary model did not complete the structured probe.',
    );
  });
});
