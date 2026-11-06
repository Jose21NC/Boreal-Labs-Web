# Boreal Labs Web

Sitio web de Boreal Labs construido con React + Vite, Tailwind CSS y Firebase. Incluye enrutamiento con React Router, componentes UI basados en Radix (estilo shadcn), animaciones, y SEO básico con react-helmet-async.

## 🚀 Características

- Vite + React 18 para desarrollo rápido.
- Tailwind CSS con diseño responsive y paleta de colores personalizada (boreal-*)
- Componentes UI con Radix (AlertDialog, Dialog, Toast, Tabs, etc.) y tailwindcss-animate.
- React Router v6 con rutas en español y redirecciones desde rutas antiguas.
- Firebase (Firestore, Auth, Storage) listo para usar; Auth anónima es opt-in (`VITE_ENABLE_ANON_AUTH=true`).
- ReCAPTCHA v2 (clave configurable por variable de entorno).
- Alias de importación `@` apuntando a `src`.

## 📦 Stack

- React 18, React Router 6
- Vite 4
- Tailwind CSS 3, tailwindcss-animate
- Radix UI, lucide-react
- Firebase 12
- framer-motion, swiper
- react-helmet-async

## 📁 Estructura principal

```
Boreal-Labs-Web/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.cjs
├─ src/
│  ├─ App.jsx
│  ├─ firebase.jsx
│  ├─ index.css
│  ├─ main.jsx
│  ├─ components/
│  │  ├─ Navbar.jsx, Footer.jsx, ErrorBoundary.jsx, ...
│  │  └─ ui/ (button, input, dialog, select, toast, ...)
│  ├─ pages/
│  │  ├─ HomePage.jsx, AboutPage.jsx, TeamPage.jsx,
│  │  ├─ EventsPage.jsx, PaginaValidacion.jsx, NotFoundPage.jsx
│  └─ images/
└─ ...
```

Alias de rutas (vite.config.js): `@ → src`.

## 🧭 Rutas principales (src/App.jsx)

- `/` → HomePage
- `/nosotros` → AboutPage (redirige desde `/about`)
- `/equipo` → TeamPage (redirige desde `/team`)
- `/eventos` → EventsPage (redirige desde `/events`)
- `/validar-certificado` y `/validacion` → PaginaValidacion
- `*` → NotFoundPage

## 🔑 Variables de entorno

El proyecto usa variables prefijadas con `VITE_` (requerimiento de Vite) para exponerlas al cliente.

- `VITE_RECAPTCHA_SITE_KEY` (recomendado): Clave de sitio de reCAPTCHA v2.

Nota sobre Firebase: actualmente la configuración de Firebase está embebida en `src/firebase.jsx`. Para producción se recomienda moverla a variables de entorno (`.env`) y no commitear secretos.

Crea un archivo `.env` en la raíz (o `.env.local`) basado en `.env.example`:

```
VITE_RECAPTCHA_SITE_KEY=tu_clave_recaptcha_v2
# (Opcional si migras Firebase a .env)
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# VITE_FIREBASE_STORAGE_BUCKET=...
# VITE_FIREBASE_MESSAGING_SENDER_ID=...
# VITE_FIREBASE_APP_ID=...
# VITE_FIREBASE_MEASUREMENT_ID=...
```

## 🛠 Requisitos

- Node.js 18+ (recomendado LTS)
- npm 9+ o pnpm/yarn equivalente

## ▶️ Desarrollo local

1. Instala dependencias

```bash
npm install
```

2. Crea `.env` con tu `VITE_RECAPTCHA_SITE_KEY` (opcional pero recomendado)

3. Arranca el servidor de desarrollo (puerto 3000)

```bash
npm run dev
```

Visita: http://localhost:3000

> Nota: el servidor se expone en `--host ::`, por lo que también escucha en interfaces locales IPv6.

## 🏗️ Build y vista previa

Genera la build de producción en `dist/`:

```bash
npm run build
```

Previsualiza la build en local (puerto 3000):

```bash
npm run preview
```

El script de build ejecuta opcionalmente `tools/generate-llms.js` (si no existe, continúa igualmente) y luego `vite build`.

## ☁️ Deploy

El directorio `dist/` es estático y puede desplegarse en:

- Netlify / Vercel
- GitHub Pages
- Firebase Hosting (recomendado si ya usas Firebase)
- Cualquier hosting de archivos estáticos

## 🔒 Firebase y autenticación

- `src/firebase.jsx` inicializa Firebase (Firestore, Auth, Storage) solo si la config `VITE_FIREBASE_*` está completa.
- La sesión anónima solo se intenta si `VITE_ENABLE_ANON_AUTH=true`. Si la usas, permite Auth anónima en la consola de Firebase.
- Considera mover las claves a `.env` para producción.

## 🎨 Tailwind y diseño

- Config dark mode por clase, paleta personalizada (`boreal-dark`, `boreal-aqua`, `boreal-purple`, `boreal-blue`).
- `tailwindcss-animate` para animaciones y componentes Radix.
- Fuentes Montserrat importadas vía `<Helmet>` en `App.jsx`.

## 🧩 Calidad y scripts

- Linter: ESLint instalado (sin script dedicado en package.json). Puedes ejecutar ESLint con configuración propia si lo deseas.
- Tests: `cd functions && npm test` (correo y certificados en `functions/`). El frontend no tiene tests.
- Modo de prueba del panel admin: `npm run dev:demo` (`vite --mode demo`, datos en memoria).

## 🤝 Contribuir

1. Crea un fork del repositorio
2. Crea una rama de funcionalidad: `feat/mi-cambio`
3. Commit con mensajes claros
4. Abre un Pull Request describiendo tu cambio

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Revisa el archivo `LICENSE` para más detalles.

## 🗺️ Notas rápidas

- Alias `@` facilita importaciones desde `src` (ej.: `import Navbar from '@/components/Navbar'`).
- ReCAPTCHA v2 se inyecta vía contexto desde `App.jsx`; establece `VITE_RECAPTCHA_SITE_KEY` para tu dominio.
- Redirecciones de rutas en inglés → español incluidas.
