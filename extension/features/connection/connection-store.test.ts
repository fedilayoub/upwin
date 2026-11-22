import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  connectionItem,
  connectionTokenProvider,
  defaultConnection,
  normalizeConnection,
  readConnection,
  resolveApiBaseUrl,
  saveConnection,
} from './connection-store';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('connection store', () => {
  it('uses the localhost defaults before anything is saved', async () => {
    await expect(connectionItem.getValue()).resolves.toBeNull();
    await expect(readConnection()).resolves.toEqual({
      apiUrl: 'http://localhost:3002',
      appUrl: 'http://localhost:3000',
      token: null,
    });
    await expect(connectionTokenProvider()).resolves.toBeNull();
  });

  it('saves a normalized connection that every context reads back', async () => {
    await saveConnection({
      apiUrl: ' http://upwin.lan:4000/ ',
      appUrl: 'http://upwin.lan:3000',
      token: '  secret-token  ',
    });

    await expect(resolveApiBaseUrl()).resolves.toBe('http://upwin.lan:4000');
    await expect(connectionTokenProvider()).resolves.toBe('secret-token');
  });

  it.each(['', 'not a url', 'javascript:alert(1)', 'file:///etc/passwd'])(
    'falls back to the default API address for %j',
    (apiUrl) => {
      expect(normalizeConnection({ apiUrl }).apiUrl).toBe(defaultConnection.apiUrl);
    },
  );

  it('treats a blank token as no token', () => {
    expect(normalizeConnection({ token: '   ' }).token).toBeNull();
  });
});
