import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// Modo de prueba (`npm run dev:demo`): Firebase se reemplaza por mocks en memoria (src/dev/mocks)
// y el panel admin no pide login. Nunca se permite en un build.
const firebaseMocks = ['app', 'auth', 'firestore', 'storage', 'functions', 'app-check'].map((name) => ({
  find: new RegExp(`^firebase/${name}$`),
  replacement: path.resolve(__dirname, `src/dev/mocks/${name}.js`),
}))

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'demo') {
    throw new Error('El modo demo desactiva la autenticación del admin: no se puede compilar para producción.')
  }
  return {
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
      alias: [
        ...(mode === 'demo' ? firebaseMocks : []),
        { find: '@', replacement: path.resolve(__dirname, 'src') },
      ],
    },
  }
})
