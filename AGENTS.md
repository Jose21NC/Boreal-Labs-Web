# AGENTS.md — Boreal-Labs-Web

Sitio estático de una sola app (Vite + React 18). No es monorepo. Todo el contenido visible al usuario está en **español** (UI, rutas, comentarios, `CHANGELOG.md`). Mantener ese idioma.

## Comandos

```bash
npm install
npm run dev       # vite --host :: --port 3000  → http://localhost:3000
npm run build     # vite build
npm run preview   # sirve dist/ en puerto 3000
```

- **No hay tests, ni script de lint, ni typecheck.** ESLint está instalado pero sin config en el repo (`eslint` + `eslint-config-react-app`, sin `.eslintrc*`). No inventes `npm test` ni `npm run lint`.
- `node_modules/` no está instalado en el checkout por defecto.

## Variables de entorno (gotcha importante)

No hay `.env` commiteado (`.git` y `.gitignore` excluyen `.env` y `.env*.local`). `src/firebase.jsx` lee **todas** las claves de `import.meta.env.VITE_FIREBASE_*`: sin `.env` local la app inicializa Firebase con `undefined` y todo lo que toque Firestore falla.

| Var | Efecto |
|---|---|
| `VITE_FIREBASE_*` (7 claves) | Config de Firebase. Sin ellas Firestore/Auth/Storage no funcionan. |
| `VITE_ENABLE_ANON_AUTH` | **Opt-in.** La auth anónima solo corre si vale exactamente `'true'`. Por defecto NO hay sesión, así que las reglas de Firestore que exigen `request.auth != null` bloquean las lecturas. |
| `VITE_FIRESTORE_DEBUG` | `'true'` en DEV ⇒ `setLogLevel('debug')`. Silencioso por defecto. |
| `VITE_ADMIN_EMAILS` | Lista separada por comas que habilita `/admin*` (`src/components/AdminGate.jsx`, email/contraseña o Google). Si falta, usa la lista por defecto del código. Debe coincidir con `isAdmin()` en `firestore.rules`/`storage.rules` y `ADMIN_EMAILS` en `functions/index.js`. |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA v2. v3 fue removido intencionalmente — no reintroducirlo. |
| `VITE_APPCHECK_SITE_KEY` | Opt-in. Clave reCAPTCHA Enterprise para Firebase App Check (`src/firebase.jsx`). Sin ella App Check no se inicializa; no activar "Enforce" en la consola hasta definirla. |
| `VITE_ASSET_BASE` | Cambia el `base` de Vite para servir assets desde un CDN. Default `/`. |

## Firebase es opcional (no la rompas)

`src/firebase.jsx` ya **no** inicializa Firebase si falta la config: chequea `apiKey`/`projectId`/`appId` y, si no están, exporta `db`/`auth`/`storage` como `null` más el flag `isFirebaseConfigured`. Solo loguea un warning en DEV.

Esto importa porque `initializeApp()` **lanza** `auth/invalid-api-key` con config incompleta, y como antes corría a nivel de módulo, el throw tumbaba el árbol entero de React: sin `.env`, todas las páginas caían al `ErrorBoundary`, incluidas las estáticas. Con el guard, una landing sin Firebase funciona igual.

**No reviertas esto.** Si un consumidor necesita `db`, debe tolerar `null` (ver el early-return en `handleSubscribe` de `VoxlabPage.jsx`). `AdminGate.jsx` y `configService.js` asumen Firebase presente: no los uses en una página estática sin revisar.

## Voxlab

- `/voxlab` es la landing de producto de la app Voxi (capturas, features, CTA). Sui no aparece ahí: tiene web propia.
- El APK ya no se sirve desde este sitio. El botón de descarga (`src/components/InstallButton.jsx`) usa un enlace externo editable en `/admin/sitio` → Enlaces ("Descarga de Voxlab", `siteConfig/links.voxlabDownloadUrl`); vacío = "Próximamente".
- Assets de la mascota: `src/voxlab/voxi-awake.png` (hero), `outlinevox.png` (patrón de fondo).
- Recordatorio de Vite: `public/**` se copia tal cual a `dist/`; `src/**` solo llega si se importa.

## Deploy

Dos caminos, solo uno está automatizado:

- **CI real**: `.github/workflows/deploy.yml` — en push a `main`, `npm install` → `npm run build` → FTP de `./dist/` a Hostinger (`FTP_SERVER`/`FTP_USERNAME`/`FTP_PASSWORD`/`FTP_PATH`). Node 20.
- **Local**: `deploy_hostinger.sh` (build → zip → `upload_build.exp` → `extract_build.exp`). Los `.exp` están gitignorados (`*.exp`), así que este script **no funciona** en un clon nuevo.
- `firebase.json` existe para Hosting pero el deploy documentado es Hostinger por FTP.

## Arquitectura (lo que no se deduce de los nombres)

- Entrada: `src/main.jsx` → `src/App.jsx` (`BrowserRouter`, `HelmetProvider`, contexto de reCAPTCHA, `Navbar`/`Footer`, `ScrollToTop`).
- Alias `@` → `src` (`vite.config.js`).
- Rutas en español con redirect desde las de inglés (`/about`→`/nosotros`, `/team`→`/equipo`, `/events`→`/eventos`). Voxlab expone `/voxlab` y redirige `/Voxlab` y `/VOXLAB`.
- `EventsPage.jsx` es un archivo grande expandido a mano; editarlo con cuidado. El panel admin vive en `src/admin` (ver "Panel admin").
- `src/lib/configService.js` lee configuración editable desde Firestore (`siteConfig/links`, `siteConfig/home`) con defaults y `onSnapshot`. Todo consumidor debe tolerar que el doc no exista.
- `functions/` es un proyecto Node separado para Cloud Functions (`generateCertificates`, región `us-central1`, `VALIDATION_URL_BASE`). Se despliega aparte del frontend.
- `src/index.css` self-hostea la fuente **Agrandir**; `font-agrandir` en Tailwind depende de ella. Si algo se ve con otra tipografía, revisar ese archivo primero.

## Panel admin (`src/admin`)

- `/admin/*` monta `src/admin/AdminApp.jsx` (rutas, cada sección con `lazy`) dentro de `AdminLayout.jsx` (shell: sidebar `NAV`, drawer móvil, tema claro/oscuro/sistema en `localStorage['admin:theme']`, paleta ⌘K, banner de modo prueba).
- `ui.jsx` es el kit (Button, Card, StatCard, Table, Modal, Tabs, EmptyState, Skeleton, `useConfirm`…). No usar `src/components/ui` dentro del panel.
- `lib.js`: `logActivity`, fechas (`toDate`, `formatDate`, `formatRelative`), `normalize`, `isPresent`, `downloadCsv`.
- `sections/<área>/index.jsx` = una sección por ruta (`dashboard` = `/admin`, `activity` = `/admin/actividad`, `events`, `certificates`, …).

Convenciones:
- Solo tokens `adm-*` de Tailwind (`bg-adm-surface`, `text-adm-muted`, `adm-accent`, `adm-danger`…). Nada de colores fijos: rompe uno de los dos temas.
- Confirmaciones con `useConfirm()`, nunca `window.confirm`.
- Tras **cada** mutación exitosa: `logActivity('area.verbo', 'Resumen legible', meta)`. El área (prefijo antes del punto) alimenta los filtros de `/admin/actividad`. Nunca lanza.
- `db` puede ser `null`: mostrar `EmptyState` "Firebase no configurado". Una consulta = un `getDocs` por colección; `getCountFromServer` si solo hace falta el número.
- Las reglas de `adminActivity` caen en el catch-all `match /{document=**}` (solo admin); no necesita regla propia.

Modo de prueba: `npm run dev:demo` (`vite --mode demo`). `vite.config.js` reemplaza `firebase/*` por los mocks en memoria de `src/dev/mocks`, con la semilla `src/dev/seed.js` persistida en `localStorage['demo:firestore:v1']` (borrar la clave para volver a la semilla). `AdminGate` se salta el login **solo** en ese modo, y `vite build --mode demo` lanza error a propósito para que nunca llegue a producción.

## Otras instrucciones del repo

`.github/copilot-instructions.md` tiene un detalle fino de los flujos de Firestore (eventos, registros, certificados, admin). Leerlo antes de tocar esos flujos; no duplicar su contenido aquí.