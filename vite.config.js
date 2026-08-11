import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages publishes this project at /TidyScore/, not at the domain root.
  base: '/TidyScore/',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        importScripts: ['pwa-cache-cleanup.js'],
        globPatterns: ['**/*.{html,js,css,webmanifest,svg,png}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tidyscore-pages',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
              precacheFallback: { fallbackURL: 'index.html' }
            }
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.includes('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tidyscore-immutable-assets',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365,
                purgeOnQuotaError: true
              }
            }
          }
        ]
      }
    })
  ]
});
