import { describe, expect, it } from 'vitest';
import {
  getAllowedExtensionOrigins,
  isAllowedExtensionOrigin,
  normalizeExtensionOrigin,
  resolveAllowedExtensionRequest,
} from './extension-origin';

const chromeOrigin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const edgeOrigin = 'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('extension origin helpers', () => {
  it('accepts only well-formed Chromium extension origins', () => {
    expect(normalizeExtensionOrigin(chromeOrigin)).toBe(chromeOrigin);
    expect(normalizeExtensionOrigin('https://app.example.com')).toBeNull();
    expect(normalizeExtensionOrigin('chrome-extension://too-short')).toBeNull();
    expect(normalizeExtensionOrigin(`${chromeOrigin}/unexpected`)).toBeNull();
  });

  it('parses a strict comma-separated allowlist', () => {
    expect(
      [...getAllowedExtensionOrigins(`${chromeOrigin}, ${edgeOrigin}, https://bad`)],
    ).toEqual([chromeOrigin, edgeOrigin]);
    expect(isAllowedExtensionOrigin(chromeOrigin, `${chromeOrigin},${edgeOrigin}`)).toBe(
      true,
    );
    expect(
      isAllowedExtensionOrigin(
        'chrome-extension://cccccccccccccccccccccccccccccccc',
        `${chromeOrigin},${edgeOrigin}`,
      ),
    ).toBe(false);
  });

  it.each([
    ['wildcard allowlist', chromeOrigin, '*'],
    ['wrong id length', 'chrome-extension://aaaaaaaa', chromeOrigin],
    [
      'uppercase id',
      'chrome-extension://AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      chromeOrigin,
    ],
    [
      'embedded credentials',
      'chrome-extension://user:password@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chromeOrigin,
    ],
    ['trailing path', `${chromeOrigin}/unexpected`, chromeOrigin],
    ['query', `${chromeOrigin}?redirect=1`, chromeOrigin],
    ['fragment', `${chromeOrigin}#fragment`, chromeOrigin],
  ])('rejects a hostile %s', (_case, origin, configuredOrigins) => {
    expect(isAllowedExtensionOrigin(origin, configuredOrigins)).toBe(false);
  });

  it('allows Chromium privileged fetches to declare an exact configured origin', () => {
    expect(resolveAllowedExtensionRequest(null, chromeOrigin, chromeOrigin)).toEqual({
      allowedOrigin: chromeOrigin,
    });
  });

  it('rejects a declared origin that conflicts with the browser Origin header', () => {
    expect(
      resolveAllowedExtensionRequest(
        chromeOrigin,
        edgeOrigin,
        `${chromeOrigin},${edgeOrigin}`,
      ),
    ).toBeNull();
  });
});
