import { describe, expect, it } from 'vitest';
import { generateVideoSlug } from './slug';
describe('video slug', () => {
  it('uses 12 base62 characters with no duplicates in 10000 draws', () => {
    const slugs = Array.from({ length: 10000 }, () => generateVideoSlug());
    expect(slugs.every((slug) => /^[0-9A-Za-z]{12}$/.test(slug))).toBe(true);
    expect(new Set(slugs).size).toBe(10000);
  });
  it('discards bytes 248 through 255 before reducing modulo 62', () => {
    expect(
      generateVideoSlug(() =>
        Uint8Array.from([
          248, 249, 250, 251, 252, 253, 254, 255, 0, 61, 62, 247,
        ]),
      ),
    ).toBe('0z0z0z0z0z0z');
  });
});
