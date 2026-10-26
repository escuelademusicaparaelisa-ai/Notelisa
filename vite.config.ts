/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, static hosting).
  base: './',
  plugins: [
    react(),
    VitePWA({
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
    include: ['src/**/*.test.ts'],
  },
})
