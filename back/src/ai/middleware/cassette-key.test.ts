import { describe, expect, it } from 'vitest';
import { createCassetteKey, createSchemaHash } from './cassette-key';

describe('cassette keys', () => {
  const base = {
    capability: 'profileAnalyzer',
    requestedModelId: 'gpt-4.1-nano',
    temperature: 0.2,
    system: 'System prompt',
    prompt: 'User prompt',
    schemaName: 'probe',
    variantIndex: 0,
  } as const;

  it('is stable across object key order', () => {
    expect(createSchemaHash({ type: 'object', title: 'Probe' })).toBe(
      createSchemaHash({ title: 'Probe', type: 'object' }),
    );
  });

  it('changes when the schema hash changes', () => {
    const first = createCassetteKey({
      ...base,
      schemaHash: createSchemaHash({ type: 'object' }),
    });
    const second = createCassetteKey({
      ...base,
      schemaHash: createSchemaHash({ type: 'object', required: ['answer'] }),
    });

    expect(first).not.toBe(second);
  });

  it('changes between variants', () => {
    const schemaHash = createSchemaHash({ type: 'object' });

    expect(createCassetteKey({ ...base, schemaHash, variantIndex: 0 })).not.toBe(
      createCassetteKey({ ...base, schemaHash, variantIndex: 1 }),
    );
  });

  it('changes when the requested model selection changes', () => {
    const schemaHash = createSchemaHash({ type: 'object' });

    expect(
      createCassetteKey({ ...base, schemaHash, requestedModelId: 'model-a' }),
    ).not.toBe(
      createCassetteKey({ ...base, schemaHash, requestedModelId: 'model-b' }),
    );
  });
});
