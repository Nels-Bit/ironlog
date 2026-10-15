import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { importScripts: ['push-worker.js'], navigateFallbackDenylist: [/^\/api\//] },
      // JavaScript is already covered by Workbox's generated precache glob.
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'IronLog Workout Tracker',
        short_name: 'IronLog',
        description: 'High-performance workout tracking',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
});
