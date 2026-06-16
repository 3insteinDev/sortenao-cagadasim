// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // we handle registration manually via src/lib/pwa.ts
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false, // we use our own public/manifest.webmanifest
        workbox: {
          // NetworkFirst for HTML navigations
          navigateFallback: undefined,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "pages",
                expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
              },
            },
            {
              // CacheFirst for same-origin hashed assets
              urlPattern: ({ url }) =>
                url.origin === self.location.origin && /\.[a-f0-9]{8,}\./.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.origin === "https://fonts.googleapis.com" ||
                url.origin === "https://fonts.gstatic.com",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
          ],
        },
      }),
    ],
  },
});
