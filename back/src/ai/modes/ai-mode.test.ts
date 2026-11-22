import { describe, expect, it } from 'vitest';
import { resolveAiMode } from './ai-mode';

describe('resolveAiMode', () => {
  it('always calls the real provider outside tests, whatever AI_MODE says', () => {
    expect(resolveAiMode({ NODE_ENV: 'development' })).toBe('live');
    expect(resolveAiMode({ NODE_ENV: 'production' })).toBe('live');
    expect(resolveAiMode({ NODE_ENV: 'development', AI_MODE: 'fake' })).toBe('live');
    expect(resolveAiMode({ NODE_ENV: 'production', AI_MODE: 'replay' })).toBe('live');
  });

  it('uses fixtures in tests, or recorded cassettes when a test asks for them', () => {
    expect(resolveAiMode({ NODE_ENV: 'test' })).toBe('fake');
    expect(resolveAiMode({ NODE_ENV: 'test', AI_MODE: 'replay' })).toBe('replay');
  });

  it('never lets a test reach a real provider', () => {
    expect(() => resolveAiMode({ NODE_ENV: 'test', AI_MODE: 'live' })).toThrowError(
      'A live AI provider is forbidden when NODE_ENV=test.',
    );
  });
});
