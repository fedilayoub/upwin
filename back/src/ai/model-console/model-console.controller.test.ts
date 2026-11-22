import { describe, expect, it } from 'vitest';
import {
  modelSelectableCapabilitySchema,
  setCapabilityModelsSchema,
} from './model-console.schema';

describe('ModelConsoleController boundaries', () => {
  it('rejects unsupported capabilities and malformed input at the 422 validation boundary', () => {
    expect(modelSelectableCapabilitySchema.safeParse('cvExtractor').success).toBe(
      false,
    );
    expect(
      setCapabilityModelsSchema.safeParse({
        primaryModelId: '',
        fallbackModelId: 'fallback',
      }).success,
    ).toBe(false);
  });
});
