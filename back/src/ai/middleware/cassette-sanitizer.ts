export function sanitizeCassette<T>(
  cassette: T,
  sensitiveTerms: readonly string[] = [],
): T {
  return sanitizeValue(cassette, sensitiveTerms) as T;
}

function sanitizeValue(
  value: unknown,
  sensitiveTerms: readonly string[],
): unknown {
  if (typeof value === 'string') return sanitizeText(value, sensitiveTerms);
  if (Array.isArray(value))
    return value.map((entry) => sanitizeValue(entry, sensitiveTerms));
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      sanitizeValue(nestedValue, sensitiveTerms),
    ]),
  );
}

function sanitizeText(
  value: string,
  sensitiveTerms: readonly string[],
): string {
  let sanitized = value
    .replace(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/("name"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED_NAME]$3')
    .replace(/(<name>)(.*?)(<\/name>)/gi, '$1[REDACTED_NAME]$3');

  for (const term of sensitiveTerms) {
    const trimmed = term.trim();
    // One- and two-character terms are too broad and would redact unrelated
    // text throughout the document.
    if (trimmed.length < 3) continue;
    sanitized = sanitized.replace(
      new RegExp(sensitiveTermPattern(trimmed), 'giu'),
      '[REDACTED]',
    );
  }

  return sanitized;
}

function sensitiveTermPattern(term: string): string {
  return term
    .split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
}
