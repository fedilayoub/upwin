import { describe, expect, it } from 'vitest';
import { sanitizeCassette } from './cassette-sanitizer';

describe('sanitizeCassette', () => {
  it('redacts a supplied prose term case-insensitively without word boundaries', () => {
    expect(
      sanitizeCassette('Owner: prefixjAnE   dEvElOpErsuffix.', [
        'Jane Developer',
      ]),
    ).toBe('Owner: prefix[REDACTED]suffix.');
  });

  it('ignores a supplied term shorter than three characters', () => {
    expect(sanitizeCassette('Jo joined JoJo.', ['Jo'])).toBe('Jo joined JoJo.');
  });

  it.each([undefined, []] as const)(
    'keeps prose unchanged with a %s term list while preserving built-in redaction',
    (sensitiveTerms) => {
      const source =
        'Jane Developer; {"name":"Jane Developer"}; jane@example.test';
      const sanitized = sanitizeCassette(source, sensitiveTerms);

      expect(sanitized).toContain('Jane Developer;');
      expect(sanitized).toContain('"name":"[REDACTED_NAME]"');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
      expect(sanitized).not.toContain('jane@example.test');
    },
  );
});
