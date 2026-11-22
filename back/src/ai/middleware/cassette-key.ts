import { createHash } from 'node:crypto';

export interface CassetteKeyInput {
  capability: string;
  requestedModelId: string;
  temperature: number | null;
  system: string;
  prompt: string;
  schemaName: string;
  schemaHash: string;
  variantIndex: number;
}

export function createCassetteKey(input: CassetteKeyInput): string {
  return sha256(stableSerialize(input));
}

export function createSchemaHash(schema: unknown): string {
  return sha256(stableSerialize(schema));
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(stabilize(value));
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stabilize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stabilize);

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, stabilize(nestedValue)]),
  );
}
