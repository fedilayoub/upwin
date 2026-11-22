import { Logger } from '@nestjs/common';
import fixture from './model-catalog.fixture.json';
import {
  gatewayModelCatalogEntrySchema,
  gatewayModelCatalogSchema,
  type GatewayModelCatalogEntry,
} from './model-catalog.schema';
import type {
  CatalogModel,
  CatalogModelRecord,
  ParsedModelCatalog,
} from './model-catalog.types';
import type { AiMode } from '../modes/ai-mode';

export type CatalogFetcher = (url: string) => Promise<Response>;

const EMPTY_CATALOG: ParsedModelCatalog = { all: [], selectable: [], skippedCount: 0 };

export interface ModelCatalogOptions {
  now?: () => number;
  ttlMs?: number;
}

interface CatalogCacheEntry {
  loadedAt: number;
  catalog: ParsedModelCatalog;
}

const DEFAULT_TTL_MS = 15 * 60 * 1_000;

export class ModelCatalogService {
  private readonly logger = new Logger(ModelCatalogService.name);
  private readonly now: () => number;
  private readonly ttlMs: number;
  private cache: CatalogCacheEntry | null = null;

  constructor(
    private readonly fetcher: CatalogFetcher,
    private readonly mode: AiMode,
    private readonly catalogUrl: string,
    options: ModelCatalogOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  async listSelectable(): Promise<CatalogModel[]> {
    return (await this.load()).selectable;
  }

  async listAll(): Promise<CatalogModelRecord[]> {
    return (await this.load()).all;
  }

  async findById(id: string): Promise<CatalogModelRecord | null> {
    return (await this.load()).all.find((model) => model.id === id) ?? null;
  }

  private async load(): Promise<ParsedModelCatalog> {
    const now = this.now();
    if (this.cache && now - this.cache.loadedAt < this.ttlMs) {
      return this.cache.catalog;
    }

    try {
      const document =
        this.mode === 'fake' ? fixture : await this.fetchCatalogDocument();
      const catalog = parseModelCatalog(document, new Date(now));
      if (catalog.skippedCount > 0) {
        this.logger.warn(
          `Skipped ${catalog.skippedCount} malformed model catalog entries.`,
        );
      }
      this.cache = { loadedAt: now, catalog };
      return catalog;
    } catch (error: unknown) {
      if (this.cache) {
        this.logger.warn(
          'The model catalog refresh failed; serving the stale cached catalog.',
        );
        return this.cache.catalog;
      }
      // No catalog yet: the provider is down, or it is not llmgateway.io and
      // has no catalog in this shape. Serve none, uncached, so the next request
      // retries. Analyses still run on the models configured in .env.
      this.logger.warn(
        `The model catalog is unavailable (${error instanceof Error ? error.message : String(error)}); serving an empty one.`,
      );
      return EMPTY_CATALOG;
    }
  }

  private async fetchCatalogDocument(): Promise<unknown> {
    const response = await this.fetcher(this.catalogUrl);
    if (!response.ok) {
      throw new Error(`Model catalog request failed with HTTP ${response.status}.`);
    }
    return response.json();
  }
}

export function parseModelCatalog(
  document: unknown,
  now: Date,
): ParsedModelCatalog {
  const root = gatewayModelCatalogSchema.parse(document);
  const parsed: GatewayModelCatalogEntry[] = [];
  let skippedCount = 0;

  for (const candidate of root.data) {
    const result = gatewayModelCatalogEntrySchema.safeParse(candidate);
    if (!result.success || !hasFinitePrices(result.data)) {
      skippedCount += 1;
      continue;
    }
    parsed.push(result.data);
  }

  const all = parsed.map((entry) => toCatalogRecord(entry, now));
  const selectable = all
    .filter(
      (model) =>
        model.structuredOutputs &&
        !model.id.includes('/') &&
        !isPastSunset(model.deactivatedAt, now),
    )
    .sort(
      (left, right) =>
        left.family.localeCompare(right.family) ||
        left.inputPricePerMillion - right.inputPricePerMillion ||
        left.id.localeCompare(right.id),
    )
    .map(toPublicModel);

  return { all, selectable, skippedCount };
}

export function isPastSunset(value: string | null, now: Date): boolean {
  return value !== null && new Date(value).getTime() <= now.getTime();
}

function hasFinitePrices(entry: GatewayModelCatalogEntry): boolean {
  return [entry.pricing.prompt, entry.pricing.completion].every((price) => {
    const parsed = Number(price);
    return Number.isFinite(parsed) && parsed >= 0;
  });
}

function toCatalogRecord(
  entry: GatewayModelCatalogEntry,
  now: Date,
): CatalogModelRecord {
  const deactivatedAt = entry.deactivated_at ?? null;
  return {
    id: entry.id,
    displayName: entry.display_name ?? entry.name,
    family: entry.family,
    inputPricePerMillion: perMillion(entry.pricing.prompt),
    outputPricePerMillion: perMillion(entry.pricing.completion),
    contextLength: entry.context_length,
    maxOutput: entry.max_output ?? null,
    sunsetsAt:
      deactivatedAt !== null && !isPastSunset(deactivatedAt, now)
        ? deactivatedAt
        : null,
    providerIds: [...new Set(entry.providers.map((provider) => provider.providerId))],
    aliases: entry.aliases ?? [],
    stability: entry.stability ?? null,
    jsonOutput: entry.json_output,
    structuredOutputs: entry.structured_outputs,
    deactivatedAt,
  };
}

function perMillion(perToken: string): number {
  return Number((Number(perToken) * 1_000_000).toPrecision(12));
}

function toPublicModel(model: CatalogModelRecord): CatalogModel {
  return {
    id: model.id,
    displayName: model.displayName,
    family: model.family,
    inputPricePerMillion: model.inputPricePerMillion,
    outputPricePerMillion: model.outputPricePerMillion,
    contextLength: model.contextLength,
    maxOutput: model.maxOutput,
    sunsetsAt: model.sunsetsAt,
    providerIds: model.providerIds,
    aliases: model.aliases,
    stability: model.stability,
  };
}
