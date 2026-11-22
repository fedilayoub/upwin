import { describe, expect, it } from 'vitest';
import {
  digestToken,
  extractBearerToken,
  hostnameOf,
  isLoopbackBindHost,
  tokenMatches,
} from './local-access';

describe('hostnameOf', () => {
  it.each([
    ['localhost:3002', 'localhost'],
    ['LOCALHOST', 'localhost'],
    ['127.0.0.1:3002', '127.0.0.1'],
    ['[::1]:3002', '[::1]'],
    ['[::1]', '[::1]'],
    ['api:3002', 'api'],
    [' upwin.local ', 'upwin.local'],
  ])('reads %s as %s', (header, expected) => {
    expect(hostnameOf(header)).toBe(expected);
  });

  it.each([undefined, '', '   ', '[', '[]:80', ':3002'])(
    'rejects %j',
    (header) => {
      expect(hostnameOf(header)).toBeNull();
    },
  );
});

describe('isLoopbackBindHost', () => {
  it.each(['127.0.0.1', '127.1.2.3', 'localhost', '::1', '[::1]'])(
    'treats %s as loopback',
    (host) => {
      expect(isLoopbackBindHost(host)).toBe(true);
    },
  );

  it.each(['0.0.0.0', '::', '192.168.1.10', 'example.com'])(
    'treats %s as reachable from the network',
    (host) => {
      expect(isLoopbackBindHost(host)).toBe(false);
    },
  );
});

describe('API token helpers', () => {
  it('matches only the exact configured token', () => {
    const expected = digestToken('correct-horse-battery-staple');

    expect(tokenMatches('correct-horse-battery-staple', expected)).toBe(true);
    expect(tokenMatches('correct-horse-battery-stapl', expected)).toBe(false);
    expect(tokenMatches('', expected)).toBe(false);
  });

  it('extracts a single bearer token only', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken('Bearer a b')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });
});
