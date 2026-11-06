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
    // Quita console.log/debug en build de producción; console.warn y console.error se conservan.
    esbuild: { pure: command === 'build' ? ['console.log', 'console.debug'] : [] },
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
            // Motor de certificados (solo panel admin): fuera del chunk 'vendor' que carga el sitio público.
            if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
            if (/[\\/]node_modules[\\/](pdf-lib|@pdf-lib|qrcode|pako|dijkstrajs)[\\/]/.test(id)) return 'vendor-pdf';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('react-helmet-async')) return 'vendor-helmet';
            return 'vendor';
          },
          // Los .mjs se sirven como text/plain en Hostinger y quedan cacheados 1 año (immutable).
          // Se emiten como .js con "-v2" para que la URL sea nueva y ninguna caché la tenga.
          assetFileNames: (assetInfo) => {
            const name = assetInfo.names?.[0] ?? assetInfo.name ?? '';
            return name.endsWith('.mjs')
              ? 'assets/[name]-v2-[hash].js'
              : 'assets/[name]-[hash][extname]';
          },
        },
      },
    },
    resolve: {
      // functions/certificate.js importa pdf-lib/qrcode: usar siempre la copia de la raíz (CI no instala functions/).
      dedupe: ['pdf-lib', '@pdf-lib/fontkit', 'qrcode'],
      alias: [
        ...(mode === 'demo' ? firebaseMocks : []),
        { find: '@', replacement: path.resolve(__dirname, 'src') },
      ],
    },
  }
})
