import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'ZenLink 网址导航',
        short_name: 'ZenLink',
        description: '现代化自建网址导航、在线云笔记与 AI 智能工作台',
        lang: 'zh-CN',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          {
            name: '在线云笔记',
            short_name: '笔记',
            description: '快速记录与查阅 Markdown 笔记',
            url: '/notes',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'AI 智能助手',
            short_name: 'AI 助手',
            description: '多模型智能对话与写作协同',
            url: '/ai',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
        categories: ['productivity', 'utilities', 'navigation'],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/favicon/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'zenlink-favicons',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unsplash-images',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('element-plus') || id.includes('@element-plus')) {
              return 'vendor-element-plus';
            }
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('@vue')) {
              return 'vendor-vue';
            }
            if (id.includes('marked')) {
              return 'vendor-markdown';
            }
            if (id.includes('sortablejs') || id.includes('vuedraggable') || id.includes('axios')) {
              return 'vendor-tools';
            }
            if (id.includes('@simplewebauthn')) {
              return 'vendor-webauthn';
            }
            return 'vendor-misc';
          }
        },
      },
    },
  },
});
