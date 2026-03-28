import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vitejs.dev/config/
export default defineConfig({
  // Permite publicar assets en un CDN si se define VITE_ASSET_BASE.
  // Ejemplo: VITE_ASSET_BASE=https://cdn.tudominio.com/
  base: process.env.VITE_ASSET_BASE || '/',
  plugins: [
    react(),
    ViteImageOptimizer({
      png: { quality: 75 },
      jpeg: { quality: 72 },
      jpg: { quality: 72 },
      webp: { quality: 68 },
    })
  ],
  build: {
    target: 'es2018',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react-helmet-async')) return 'vendor-helmet';
          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
