import { z } from 'zod';

const modelText = z.string();

/**
 * Model-facing optional: `.nullable()`, never `.optional()`.
 *
 * OpenAI's strict structured outputs requires every key in `properties` to also
 * appear in `required`. Zod's `.optional()` omits the key from `required`, so the
 * gateway returns:
 *
 *   AI_APICallError: Invalid schema for response_format 'response':
 *   'required' is required to be supplied and to be an array including every key
 *   in properties. Missing 'title'.
 *
 * Gemini does not enforce this, so before this change every CV extraction failed
 * on the OpenAI primary and silently succeeded on the Gemini fallback. Nullable
 * keeps the key required while still letting the model say "not stated"; the
 * nulls are stripped by `stripModelNulls` below before domain validation.
 */
const nullableText = modelText.nullable();

const modelExperienceRoleSchema = z.object({
  title: nullableText,
  company: nullableText,
  period: nullableText,
  description: nullableText,
});

const modelPortfolioProjectSchema = z.object({
  title: nullableText,
  description: nullableText,
  skills: z.array(modelText),
  url: nullableText,
});

/**
 * This schema is sent to generateObject. Numeric fields must stay as bare
 * z.number() calls: gateway-routed Anthropic providers reject emitted numeric
 * bounds, including the implicit bounds emitted by .int().
 */
export const cvExtractionSchema = z.object({
  experience: z.object({
    years: z.number().nullable(),
    roles: z.array(modelExperienceRoleSchema),
  }),
  skills: z.array(modelText),
  portfolio: z.array(modelPortfolioProjectSchema),
  preferences: z.object({
    tone: nullableText,
    services: z.array(modelText).nullable(),
  }),
  positioning: z.object({
    targetRole: nullableText,
    targetClients: z.array(modelText).nullable(),
    targetIndustries: z.array(modelText).nullable(),
    targetRate: z.number().nullable(),
  }),
});

export type CvExtraction = z.output<typeof cvExtractionSchema>;

/**
 * The domain schema treats a missing field as `undefined`, and its text fields
 * require at least one character. Models signal "not stated" inconsistently —
 * sometimes `null`, sometimes `""` — so both are dropped here. Keeping the empty
 * string would fail domain validation with `too_small`, and storing it would
 * break the rule that a field which could not be read is `undefined`, never
 * `''`; the analyzer relies on that to tell missing information from poor
 * information.
 *
 * Empty arrays are preserved: `skills: []` means "none stated", which is a fact.
 */
export function stripModelNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripModelNulls);

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => !isAbsent(entry))
        .map(([key, entry]) => [key, stripModelNulls(entry)]),
    );
  }

  return value;
}

function isAbsent(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return typeof value === 'string' && value.trim().length === 0;
}

/**
 * CVs print links without a scheme — a PDF text layer yields
 * `github.com/user/repo`, which `z.url()` rejects because `new URL()` needs a
 * scheme. The model is instructed to copy the document verbatim, so repairing
 * the value belongs here rather than in the prompt. Anything that already has a
 * scheme, or that cannot be repaired into an http(s) URL, is left untouched for
 * the domain schema to judge.
 */
export function normalizeProjectUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (!/^[\w-]+(\.[\w-]+)+(\/|$)/.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}
