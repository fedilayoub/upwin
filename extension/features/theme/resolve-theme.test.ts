import { describe, expect, it } from 'vitest';
import { resolveTheme } from './resolve-theme';

describe('resolveTheme', () => {
  it('honours an explicit preference regardless of the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system setting only when the user asked it to', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
