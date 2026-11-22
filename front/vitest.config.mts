import { defineConfig } from 'vitest/config';

export default defineConfig({
  // A component may import a stylesheet (components/ui/hardware does). Vite
  // would run it through postcss.config.mjs, which names its plugin as a
  // string for Next and so is not a config Vite can load. Tests assert on
  // markup, so the stylesheet goes through no PostCSS plugins at all.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      '@': new URL('.', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
  },
});
