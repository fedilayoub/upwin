import { describe, expect, it } from 'vitest';
import { isActivePath } from '@/components/top-nav';

describe('isActivePath', () => {
  it('keeps the Overview active only on its own path', () => {
    expect(isActivePath('/en', '/en', true)).toBe(true);
    expect(isActivePath('/en/goals', '/en', true)).toBe(false);
  });

  it('keeps a section active on its nested pages', () => {
    expect(isActivePath('/en/context/review', '/en/context')).toBe(true);
    expect(isActivePath('/en/contextual', '/en/context')).toBe(false);
  });
});
