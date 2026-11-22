import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from './resolve-theme';
import { themePreferenceItem } from './theme-storage';

beforeEach(() => fakeBrowser.reset());

// The in-page recorder reads the raw `storage.sync` key, without WXT's wrapper.
it('stores the theme under the raw sync key the recorder host reads', async () => {
  await themePreferenceItem.setValue('light');
  const stored = await fakeBrowser.storage.sync.get(THEME_STORAGE_KEY);
  expect(stored[THEME_STORAGE_KEY]).toBe('light');
});
