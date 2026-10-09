# AGENTS.md — Boreal-Labs-Web

Sitio estático de una sola app (Vite + React 18). No es monorepo. Todo el contenido visible al usuario está en **español** (UI, rutas, comentarios, `CHANGELOG.md`). Mantener ese idioma.

## Comandos

```bash
npm install
npm run dev       # vite --host :: --port 3000  → http://localhost:3000
npm run build     # `node tools/generate-llms.js || true && vite build`
npm run preview   # sirve dist/ en puerto 3000
```

- **No hay tests, ni script de lint, ni typecheck.** ESLint está instalado pero sin config en el repo (`eslint` + `eslint-config-react-app`, sin `.eslintrc*`). No inventes `npm test` ni `npm run lint`.
- `npm run build` invoca `tools/generate-llms.js`, que **no existe** en el repo. Está protegido con `|| true`; el build funciona igual. No "arreglar" ese script.
- `node_modules/` no está instalado en el checkout por defecto.

## Variables de entorno (gotcha importante)

No hay `.env` commiteado (`.git` y `.gitignore` excluyen `.env` y `.env*.local`). `src/firebase.jsx` lee **todas** las claves de `import.meta.env.VITE_FIREBASE_*`: sin `.env` local la app inicializa Firebase con `undefined` y todo lo que toque Firestore falla.

| Var | Efecto |
|---|---|
| `VITE_FIREBASE_*` (7 claves) | Config de Firebase. Sin ellas Firestore/Auth/Storage no funcionan. |
| `VITE_ENABLE_ANON_AUTH` | **Opt-in.** La auth anónima solo corre si vale exactamente `'true'`. Por defecto NO hay sesión, así que las reglas de Firestore que exigen `request.auth != null` bloquean las lecturas. |
| `VITE_FIRESTORE_DEBUG` | `'true'` en DEV ⇒ `setLogLevel('debug')`. Silencioso por defecto. |
| `VITE_ADMIN_EMAILS` | Lista separada por comas que habilita `/admin*` (`src/components/AdminGate.jsx`). Sin ella no hay acceso admin. |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA v2. v3 fue removido intencionalmente — no reintroducirlo. |
| `VITE_ASSET_BASE` | Cambia el `base` de Vite para servir assets desde un CDN. Default `/`. |

## Firebase es opcional (no la rompas)

`src/firebase.jsx` ya **no** inicializa Firebase si falta la config: chequea `apiKey`/`projectId`/`appId` y, si no están, exporta `db`/`auth`/`storage` como `null` más el flag `isFirebaseConfigured`. Solo loguea un warning en DEV.

Esto importa porque `initializeApp()` **lanza** `auth/invalid-api-key` con config incompleta, y como antes corría a nivel de módulo, el throw tumbaba el árbol entero de React: sin `.env`, todas las páginas caían al `ErrorBoundary`, incluidas las estáticas. Con el guard, una landing sin Firebase funciona igual.

**No reviertas esto.** Si un consumidor necesita `db`, debe tolerar `null` (ver el early-return en `handleSubscribe` de `VoxlabPage.jsx`). `AdminGate.jsx` y `configService.js` asumen Firebase presente: no los uses en una página estática sin revisar.

## Assets: cómo se sirve un archivo (clave para el APK)

Regla dura de Vite, y es la fuente de casi todos los "no encuentro el archivo":

- `public/**` se copia **verbatim** a `dist/`. Se referencia por ruta absoluta: `/logoBoreal.svg`.
- `src/**` **no** se sirve. Solo llega a `dist/` si se importa explícitamente desde el código.
- Vite solo reconoce como asset las extensiones de su lista por defecto (imágenes, fuentes, medios). `.apk` **no** está: `import apk from '@/apk/app-release.apk'` falla. Necesita `assetsInclude: ['**/*.apk']` en `vite.config.js` o el sufijo `?url`.
- Un APK de 53 MB dentro del grafo de assets lo hashea y lo mueve a `dist/assets/`. **No lo hagas**: lo que funciona es `public/` + URL sin hash.

## El APK de Voxlab

- El binario vive en `public/app-release.apk` (53 MB) y se sirve como `/app-release.apk`. Verificá que siga siendo un APK real, no HTML:
  ```bash
  file public/app-release.apk          # debe decir "Android package (APK)"
  curl -sI http://localhost:3000/app-release.apk | grep -i content-type
  ```
- `/voxlab` ya no es una landing de cuenta regresiva: es la landing de producto de la app. `VoxlabPage.jsx` presenta la app con capturas reales (`voxlabstartpage.png`, `voxlabmap.png`), features y CTA de instalación.
- El botón de instalación vive en `src/components/InstallButton.jsx` (`useApkDownload` + componente). `VoxlabPage.jsx` lo usa dos veces: hero y CTA final.
- **El botón hace `fetch(..., { method: 'HEAD' })` antes de habilitarse** y rechaza la descarga si la respuesta es `text/html`. Esto no es paranoia: `public/.htaccess` y `firebase.json` tienen rewrite `**` → `index.html`, así que un APK ausente responde **200 con el HTML del sitio**. Sin esa verificación, un `<a download>` "roto" descarga `index.html` en silencio y el usuario cree que instaló la app.
- `public/.htaccess` y `firebase.json` fijan `Cache-Control: public, max-age=3600, must-revalidate` y `Content-Type: application/vnd.android.package-archive` para `*.apk`. **No** usar `immutable`: el nombre no lleva hash, así que un usuario con el APK cacheado nunca recibiría una versión nueva.
- **Sui no aparece en `/voxlab`.** Es un proyecto con web propia (`sui.app`); mencionarlo en la landing de Voxi confunde. No reintroducirlo.
- Los assets de la mascota: `src/voxlab/voxi-awake.png` es la del hero (512×512, alfa). `src/voxlab/voxi.png` es la versión dormida con "Zzz" de la landing anterior — ya no se usa en el hero. `outlinevox.png` alimenta el patrón SVG de fondo.
- Ojo: el CI sube `dist/` por FTP a Hostinger en cada push a `main`. Son 53 MB por push. Considerar Firebase Storage para el binario.

## Deploy

Dos caminos, solo uno está automatizado:

- **CI real**: `.github/workflows/deploy.yml` — en push a `main`, `npm install` → `npm run build` → FTP de `./dist/` a Hostinger (`FTP_SERVER`/`FTP_USERNAME`/`FTP_PASSWORD`/`FTP_PATH`). Node 20.
- **Local**: `deploy_hostinger.sh` (build → zip → `upload_build.exp` → `extract_build.exp`). Los `.exp` están gitignorados (`*.exp`), así que este script **no funciona** en un clon nuevo.
- `firebase.json` existe para Hosting pero el deploy documentado es Hostinger por FTP.

## Arquitectura (lo que no se deduce de los nombres)

- Entrada: `src/main.jsx` → `src/App.jsx` (`BrowserRouter`, `HelmetProvider`, contexto de reCAPTCHA, `Navbar`/`Footer`, `ScrollToTop`).
- Alias `@` → `src` (`vite.config.js`).
- Rutas en español con redirect desde las de inglés (`/about`→`/nosotros`, `/team`→`/equipo`, `/events`→`/eventos`). Voxlab expone `/voxlab` y redirige `/Voxlab` y `/VOXLAB`.
- `src/pages/AdminPanel.jsx` (128 KB), `VolunteerAdminPanel.jsx` (173 KB) y `EventsPage.jsx` son archivos enormes generados/expandidos a mano. Editarlos con cuidado; hay varios scripts `fix_*.py` y `patcher*.cjs` sueltos en la raíz que son parches puntuales ya aplicados, no herramientas mantenidas.
- `src/lib/configService.js` lee configuración editable desde Firestore (`siteConfig/links`, `siteConfig/home`) con defaults y `onSnapshot`. Todo consumidor debe tolerar que el doc no exista.
- `functions/` es un proyecto Node separado para Cloud Functions (`generateCertificates`, región `us-central1`, `VALIDATION_URL_BASE`). Se despliega aparte del frontend.
- `src/index.css` self-hostea la fuente **Agrandir**; `font-agrandir` en Tailwind depende de ella. Si algo se ve con otra tipografía, revisar ese archivo primero.

## Otras instrucciones del repo

`.github/copilot-instructions.md` tiene un detalle fino de los flujos de Firestore (eventos, registros, certificados, admin). Leerlo antes de tocar esos flujos; no duplicar su contenido aquí.