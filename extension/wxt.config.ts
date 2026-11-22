import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";
import { normalizeCrxPublicKey } from "./lib/crx-public-key";
import { inlineRegisteredProperties } from "./lib/shadow-root-css";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  dev: {
    server: {
      port: 3001,
      strictPort: true,
    },
  },
  webExt: {
    binaries: {
      edge: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    },
  },
  manifest: ({ browser }) => {
    const publicKey = normalizeCrxPublicKey(import.meta.env.WXT_CRX_PUBLIC_KEY);

    return {
      default_locale: "en",
      name: "__MSG_extensionName__",
      description: "__MSG_extensionDescription__",
      // Optional. A pinned key keeps the extension id (and so its origin) the
      // same on every machine and every reinstall; `pnpm crx:keygen` makes one.
      ...(publicKey ? { key: publicKey } : {}),
      // No host_permissions and no `cookies`: the side panel, the worker and the
      // recorder only call your own API (CORS) and your bucket (presigned URLs).
      // The launcher's content script is declared for Upwork pages in its own
      // entrypoint, and capture reads a page only after a click, via activeTab.
      permissions: [
        "activeTab",
        "scripting",
        "storage",
        "sidePanel",
        ...(browser === "firefox" ? [] : ["offscreen"]),
      ],
      ...(browser === "firefox"
        ? {}
        : {
            // The toolbar icon opens the side panel; its click also grants `activeTab`,
            // which a waiting recorder spends.
            action: {},
            commands: {
              "toggle-recording": {
                suggested_key: { default: "Alt+Shift+R", mac: "Alt+Shift+R" },
                description: "__MSG_commandToggleRecording__",
              },
            },
            // Optional: required, it changes the install warning to "all your data on all
            // websites". Requested on the first one-click tab recording.
            optional_permissions: ["tabCapture"],
            // The recorder's own frames, embedded by the injected host on the page the user
            // invoked it on. Grants no host access and adds no install warning.
            web_accessible_resources: [
              {
                resources: ["recorder-bar.html", "camera-bubble.html"],
                matches: ["<all_urls>"],
                use_dynamic_url: true,
              },
            ],
            // The bundled MediaPipe runtime is WebAssembly: the camera background blur.
            // No 'unsafe-eval' and no remote sources; it adds no install warning.
            content_security_policy: {
              extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
            },
          }),
    };
  },
  hooks: {
    // Firefox has no recorder: keep the 31 MB blur runtime and model out of its package.
    "build:publicAssets": (wxt, files) => {
      if (wxt.config.browser !== "firefox") return;
      const kept = files.filter((file) => !file.relativeDest.startsWith("mediapipe/"));
      files.splice(0, files.length, ...kept);
    },
  },
  vite: ({ browser }) => ({
    resolve: {
      alias:
        browser === "firefox"
          ? [
              {
                find: "../features/recording/background-controller",
                replacement: fileURLToPath(
                  new URL(
                    "./features/recording/background-controller.firefox.ts",
                    import.meta.url,
                  ),
                ),
              },
            ]
          : [],
    },
    plugins: [
      tailwindcss(),
      {
        // Content-script CSS lands in a shadow root on Upwork, and WXT hoists
        // any `@property` from it into Upwork's own <head>. See
        // lib/shadow-root-css.ts for why that must not happen.
        name: "upwin:content-script-css",
        enforce: "post",
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (
              output.type !== "asset" ||
              !/^content-scripts\/.+\.css$/.test(output.fileName)
            ) {
              continue;
            }
            const css =
              typeof output.source === "string"
                ? output.source
                : new TextDecoder().decode(output.source);
            output.source = inlineRegisteredProperties(css);
          }
        },
      },
    ],
  }),
});
