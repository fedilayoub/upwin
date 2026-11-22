export interface CatalogModel {
  id: string;
  displayName: string;
  family: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  contextLength: number;
  maxOutput: number | null;
  sunsetsAt: string | null;
  providerIds: string[];
  aliases: string[];
  stability: string | null;
}

export interface CatalogModelRecord extends CatalogModel {
  jsonOutput: boolean;
  structuredOutputs: boolean;
  deactivatedAt: string | null;
}

export interface ParsedModelCatalog {
  all: CatalogModelRecord[];
  selectable: CatalogModel[];
  skippedCount: number;
}
