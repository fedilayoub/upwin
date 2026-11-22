import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isPublicPath,
  isUnlocked,
  safeEqual,
  safeNextPath,
  sessionTokenFor,
} from '@/lib/app-session';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('app session', () => {
  it('is always unlocked when no APP_PASSWORD is set', async () => {
    vi.stubEnv('APP_PASSWORD', '');
    await expect(isUnlocked(undefined)).resolves.toBe(true);
  });

  it('accepts only the cookie derived from the current password', async () => {
    const cookie = await sessionTokenFor('correct horse');
    expect(cookie).toMatch(/^[0-9a-f]{64}$/);
    expect(cookie).not.toContain('correct');
    await expect(isUnlocked(cookie, 'correct horse')).resolves.toBe(true);
    await expect(isUnlocked(cookie, 'a new password')).resolves.toBe(false);
    await expect(isUnlocked(undefined, 'correct horse')).resolves.toBe(false);
    await expect(isUnlocked('forged', 'correct horse')).resolves.toBe(false);
  });

  it('compares in constant time and rejects different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it.each([
    ['/en/v/0123ABCDefgh', true],
    ['/v/0123ABCDefgh', true],
    ['/fr/v/0123ABCDefgh/', true],
    ['/api/videos/0123ABCDefgh/views', true],
    ['/en/unlock', true],
    ['/en', false],
    ['/en/settings/prompts', false],
    ['/en/v/0123ABCDefgh/extra', false],
    ['/api/anything-else', false],
  ])('treats %s as public: %s', (path, expected) => {
    expect(isPublicPath(path)).toBe(expected);
  });

  it.each([
    ['/en/goals?x=1', '/en/goals?x=1'],
    ['https://evil.example', '/en'],
    ['//evil.example', '/en'],
    ['/\\evil.example', '/en'],
    [undefined, '/en'],
  ])('only follows same-site next paths: %s', (value, expected) => {
    expect(safeNextPath(value, '/en')).toBe(expected);
  });
});
