import { describe, expect, it } from 'vitest';

describe('test network guard', () => {
  it('throws before a non-localhost request reaches the network', () => {
    expect(() => fetch('https://example.com/forbidden-in-tests')).toThrowError(
      'Tests must not fetch non-localhost URL: https://example.com',
    );
  });
});
