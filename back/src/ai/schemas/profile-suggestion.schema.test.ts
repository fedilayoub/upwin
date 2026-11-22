import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { stripModelNulls } from './cv-extraction.schema';
import { profileSuggestionSchema } from './profile-suggestion.schema';

describe('profileSuggestionSchema', () => {
  // Regression: `.optional()` omits a key from JSON Schema `required`, which
  // OpenAI strict structured outputs rejects. Nullable keeps the key required.
  it('marks every property required so OpenAI strict mode accepts it', () => {
    const walk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') return;
      const schema = node as Record<string, unknown>;
      const properties_ = schema.properties;

      if (
        schema.type === 'object' &&
        properties_ !== null &&
        typeof properties_ === 'object'
      ) {
        const properties = Object.keys(properties_);
        const required = Array.isArray(schema.required) ? schema.required : [];
        const missing = properties.filter((key) => !required.includes(key));

        expect(
          missing,
          `${path} omits from required: ${missing.join(', ')}`,
        ).toEqual([]);
      }

      for (const [key, child] of Object.entries(schema)) {
        walk(child, `${path}.${key}`);
      }
    };

    walk(z.toJSONSchema(profileSuggestionSchema), '(root)');
  });

  // Regression: gateway-routed Anthropic providers reject numeric bounds,
  // including the implicit bounds emitted by `.int()`.
  it('emits no numeric bounds', () => {
    const json = JSON.stringify(z.toJSONSchema(profileSuggestionSchema));

    expect(json).not.toContain('"minimum"');
    expect(json).not.toContain('"maximum"');
    expect(json).not.toContain('"integer"');
  });

  it('uses null for inactive conditional fields and strips them before domain validation', () => {
    const modelValue = profileSuggestionSchema.parse({
      suggestedValue:
        'I help teams turn complex requirements into clear outcomes.',
      guidance: null,
      items: null,
      explanation: 'Leads with the client benefit.',
      impact: 'high',
    });

    expect(stripModelNulls(modelValue)).toEqual({
      suggestedValue:
        'I help teams turn complex requirements into clear outcomes.',
      explanation: 'Leads with the client benefit.',
      impact: 'high',
    });
  });
});
