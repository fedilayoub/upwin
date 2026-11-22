import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  cvExtractionSchema,
  normalizeProjectUrl,
  stripModelNulls,
} from './cv-extraction.schema';

describe('cvExtractionSchema', () => {
  // Regression: `.optional()` omits a key from JSON Schema `required`, which
  // OpenAI's strict structured outputs rejects with "'required' is required to be
  // supplied and to be an array including every key in properties". Gemini does
  // not enforce it, so the failure showed up only as a silent fallback to the
  // secondary model. Every model-facing key must therefore be required.
  it('marks every property required so OpenAI strict mode accepts it', () => {
    const walk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') return;
      const schema = node as Record<string, unknown>;

      const properties_ = schema.properties;

      if (schema.type === 'object' && properties_ !== null && typeof properties_ === 'object') {
        const properties = Object.keys(properties_);
        const required = Array.isArray(schema.required) ? schema.required : [];
        const missing = properties.filter((key) => !required.includes(key));

        expect(missing, `${path} omits from required: ${missing.join(', ')}`).toEqual([]);
      }

      for (const [key, child] of Object.entries(schema)) {
        walk(child, `${path}.${key}`);
      }
    };

    walk(z.toJSONSchema(cvExtractionSchema), '(root)');
  });

  // Regression: gateway-routed Anthropic providers reject numeric bounds,
  // including the implicit safe-integer bounds that `.int()` emits.
  it('emits no numeric bounds', () => {
    const json = JSON.stringify(z.toJSONSchema(cvExtractionSchema));

    expect(json).not.toContain('"minimum"');
    expect(json).not.toContain('"maximum"');
    expect(json).not.toContain('"integer"');
  });
});

describe('stripModelNulls', () => {
  it('drops nulls and blank strings, since a field that was not read must be undefined', () => {
    const result = stripModelNulls({
      title: 'Frontend Lead / Senior Frontend Engineer',
      company: null,
      period: '',
      description: '   ',
      skills: [],
    });

    expect(result).toEqual({
      title: 'Frontend Lead / Senior Frontend Engineer',
      skills: [],
    });
  });

  it('preserves an empty array, which means "none stated" rather than "not read"', () => {
    expect(stripModelNulls({ skills: [], portfolio: [] })).toEqual({
      skills: [],
      portfolio: [],
    });
  });

  it('recurses into nested objects and arrays', () => {
    expect(
      stripModelNulls({
        experience: { years: null, roles: [{ title: 'Dev', company: '' }] },
      }),
    ).toEqual({ experience: { roles: [{ title: 'Dev' }] } });
  });

  it('keeps a zero, which is a stated value and not an absence', () => {
    expect(stripModelNulls({ targetRate: 0 })).toEqual({ targetRate: 0 });
  });
});

describe('normalizeProjectUrl', () => {
  // Regression: a PDF text layer yields `github.com/user/repo` with no scheme,
  // which z.url() rejects, and the whole extraction was discarded over it.
  it('adds https to a scheme-less host path', () => {
    expect(normalizeProjectUrl('github.com/example-dev/saas-starter')).toBe(
      'https://github.com/example-dev/saas-starter',
    );
    expect(normalizeProjectUrl('example-dev.com')).toBe('https://example-dev.com');
  });

  it('leaves an existing scheme untouched', () => {
    expect(normalizeProjectUrl('https://github.com/x/y')).toBe('https://github.com/x/y');
    expect(normalizeProjectUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('does not invent a URL out of prose', () => {
    expect(normalizeProjectUrl('not a url at all')).toBe('not a url at all');
    expect(normalizeProjectUrl('')).toBe('');
  });
});
