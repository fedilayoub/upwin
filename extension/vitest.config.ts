import { WxtVitest } from 'wxt/testing/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // WxtVitest resolves WXT's virtual `#imports` module, which feature code uses
  // for `storage`. Without it every suite importing that chain fails to load.
  plugins: [WxtVitest()],
  resolve: {
    alias: {
      '@': new URL('.', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
  },
});
