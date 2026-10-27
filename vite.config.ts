/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
// @ts-expect-error plain JS module shared with the import command line tool
import { notelisaReviewPlugin } from './tools/importer/vitePlugin.mjs'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, static hosting).
  base: './',
  plugins: [
    react(),
    notelisaReviewPlugin(),
    VitePWA({
      // NO_PWA=1 builds for hosts that do not allow service workers.
      disable: !!process.env.NO_PWA,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Notelisa',
        short_name: 'Notelisa',
        description: 'Practica tus piezas de la escuela de música Para Elisa',
        lang: 'es',
        theme_color: '#5b4bdb',
        background_color: '#fffaf3',
        display: 'standalone',
        orientation: 'any',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,musicxml,mxl}'],
        // Review images of imported scans are only needed by the teacher.
        globIgnores: ['**/review/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Piano samples are fetched on demand and kept for offline use.
            urlPattern: /\/samples\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: { cacheName: 'piano-samples' },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tools/**/*.test.mjs'],
  },
})
