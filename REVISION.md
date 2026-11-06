# REVISIÓN DEL SITIO — Boreal Labs Web

Revisión de solo lectura sobre `main` @ `bdcda84` (rama `claude/revision-sitio-488559`, avanzada por fast-forward a `main` porque el worktree original estaba desactualizado). No se tocó código de la aplicación.

**Verificado:** `npx vite build --outDir /tmp/build-review` OK (16 s). `cd functions && npm test` 9/9 OK. `npm audit --omit=dev` en raíz (14 vulnerabilidades: 1 crítica, 6 altas, 7 moderadas) y en `functions/` (21: 2 críticas, 8 altas, 10 moderadas, 1 baja). Auditoría DOM a 390 px con `vite --mode demo` en 9 rutas (sin desbordes horizontales, todas las `<img>` con `alt`).
**No verificado:** reglas vivas en producción (los archivos dicen "BORRADOR no desplegado"), contraste de color real, Lighthouse, rendimiento en red real, panel admin con datos reales, versiones más nuevas de `firebase-functions` (usar `npm outdated`).

Etiquetas: **[Auto]** un modelo pequeño lo aplica sin decisiones de producto ni acceso externo. **[Manual]** requiere al dueño (consola, producto, credenciales, refactor arriesgado). Todo cambio de `firestore.rules`/`storage.rules`/`functions/` solo surte efecto al desplegarlo (acción manual del dueño).

## Índice

- [Crítico](#crítico): R-01, R-02
- [Alto](#alto): R-03 … R-09
- [Medio](#medio): R-10 … R-24
- [Bajo](#bajo): R-25 … R-33
- [Fortalezas](#fortalezas)
- [Resumen de conteos](#resumen-de-conteos)

---

## Crítico

### R-01 — `certificados` es listable públicamente: nombres, correos y PDFs con token expuestos **[Manual]**
- **Archivos:** `firestore.rules:99` (`match /certificados/{id} { allow read: if true; ... }`), `src/pages/PaginaValidacion.jsx:39-45` (consulta por `idValidacion`), `functions/index.js:237-248` (campos guardados: `correoUsuario`, `nombreUsuario`, `urlPdf`).
- **Evidencia:** `allow read` cubre `get` y `list`. Cualquiera con la `apiKey` pública puede hacer `getDocs(collection(db,'certificados'))` y obtener todos los correos, nombres y `urlPdf` (URL de Storage con `firebaseStorageDownloadTokens`, es decir, descarga directa de cada PDF).
- **Impacto:** fuga masiva de PII y de todos los certificados emitidos; permite suplantar/descargar certificados ajenos y scraping de correos.
- **Fix:**
  1. En `generateCertificates` usar `idValidacion` como ID del documento: `db.collection('certificados').doc(idValidacion).create({...})` (también cubre R-10).
  2. `PaginaValidacion.jsx`: reemplazar el `query/where/getDocs` por `getDoc(doc(db,'certificados',validationId))`.
  3. Reglas:
     ```
     match /certificados/{id} {
       allow get: if true;                       // el ID es un UUID no adivinable
       allow list: if isAdmin()
         || (signedIn() && resource.data.correoUsuario == myEmail()); // Wallet: consulta where correoUsuario == email
       allow write: if isAdmin();
     }
     ```
  4. Migrar los certificados existentes (script admin: copiar cada doc a `certificados/{idValidacion}` y borrar el antiguo). Confirmar que la Wallet solo consulta por `correoUsuario` autenticada.
  5. Opcional: no guardar `correoUsuario` en lo que devuelve `get` público (mostrar en validación solo nombre/evento/fecha).

### R-02 — `isAdmin()` no exige `email_verified`: escalada a admin por registro con correo ajeno **[Manual]**
- **Archivos:** `firestore.rules:7-17` (y `isSuperAdmin` `:21-24`, `myEmail`), `storage.rules:6-17`, `functions/index.js:27-38` (`assertAdmin`).
- **Evidencia:** la decisión se basa en `request.auth.token.email in adminEmails` o en el doc `isAdmin/{email}`, sin comprobar `request.auth.token.email_verified`. El login por correo/contraseña está habilitado (`src/components/AdminGate.jsx`). Si alguno de los correos base (`contacto@`, `admin@`, `jose@`) no tiene aún una cuenta email/contraseña en Authentication, cualquiera puede crearla con ese correo sin verificarlo y obtendría admin completo en Firestore, Storage y Functions (leer todos los registros, enviar correos, asignar puntos).
- **Impacto:** toma total del backend.
- **Fix:** en las tres funciones `isAdmin` añadir `&& request.auth.token.get('email_verified', false) == true` (y en `assertAdmin`: `if (token.email_verified !== true) throw new HttpsError('permission-denied', ...)`). Antes de desplegar: confirmar en la consola que cada admin que entra con contraseña tiene el correo verificado (los de Google ya lo están); si no, enviar verificación o pasar a Google. Revisar también Authentication → Configuración → "Una cuenta por correo" y deshabilitar el alta pública de usuarios si no se necesita (Authentication → Configuración de usuario → deshabilitar "Crear/borrar cuentas" para clientes, solo tras comprobar que Wallet no lo usa).

---

## Alto

### R-03 — Registro público sin verificación server-side + correo automático a terceros **[Manual]**
- **Archivos:** `src/pages/EventsPage.jsx:122-190` (token `recaptchaTokenV2` solo se guarda), `firestore.rules:108-134`, `functions/index.js:397-406` (`onRegistrationCreated`), `functions/email.js`, `src/lib/antiSpam.jsx` (honeypot + 3 s, solo cliente), `src/firebase.jsx:36-44` (App Check opt-in).
- **Evidencia:** ningún componente valida `recaptchaTokenV2` contra Google; las reglas aceptan cualquier `create` con forma válida. Cada `registrations` creado dispara un correo desde `contacto@borealabs.org` al `userEmail` indicado (sin verificar que sea de quien registra). El ID `eventId_correo` permite además "ocupar" el correo de otra persona (pre-registrarla con datos falsos: ella no podrá inscribirse y recibe correo no solicitado). Igual en `voluntarios2026` (ID = correo). Un script puede además llenar `capacity` con correos falsos (el contador sube con cada registro).
- **Impacto:** mail-bombing a terceros, agotar la cuota diaria de Workspace (500–2000 correos) bloqueando los correos legítimos y dañar la reputación del dominio; denegar cupos y registros a personas reales.
- **Fix (orden de menor a mayor esfuerzo):**
  1. Activar App Check: definir `VITE_APPCHECK_SITE_KEY` (reCAPTCHA Enterprise), monitorear 1–2 semanas y pulsar "Enforce" en Firestore/Storage/Functions.
  2. Mover el registro a una callable `registerForEvent` (Admin SDK) que: verifique el token reCAPTCHA v2 contra `https://www.google.com/recaptcha/api/siteverify` (secreto `RECAPTCHA_SECRET` en Secret Manager), aplique límite por IP/correo (p. ej. contador en `rateLimits/{ip-hash}` con transacción) y escriba la inscripción + contador. Entonces cerrar el `create` público en reglas (`allow create: if false`).
  3. Enviar el correo de confirmación solo tras verificar el correo (enlace de doble confirmación) o limitar a 1 correo/dirección/evento (ya lo hace `sendOnce`) y poner un tope diario en la función (`maxInstances: 1` ya existe).
  4. Reglas: además exigir `userEmail == userEmail.lower()` (ver R-13).

### R-04 — `pointCodes`: cualquier usuario con sesión puede listar todos los códigos y canjearlos **[Manual]**
- **Archivo:** `firestore.rules:194` (`match /pointCodes/{code} { allow read: if signedIn(); ... }`). `signedIn()` = cualquier no anónimo (cualquier usuario de Wallet o de Google).
- **Evidencia:** el ID del documento es el propio código; `read` incluye `list`. Un usuario puede enumerar todos los códigos sin usar y canjear los que no son suyos (puntos reales).
- **Fix:** `allow get: if signedIn(); allow list: if isAdmin();` (el canje usa `get` por ID/QR). Verificar en el repo de la Wallet que no hace `list`/`where` sobre `pointCodes` antes de desplegar.

### R-05 — `productos`/`purchases`: stock vaciable y compras sin descontar stock **[Manual]**
- **Archivo:** `firestore.rules:183` (`match /productos/{id}` (update: "Compra: solo descontar stock") y `purchases` (`allow create`).
- **Evidencia:** el `update` de `productos` solo exige que `stock` baje; no exige una compra asociada → cualquier usuario autenticado puede poner el stock de todos los productos en 0 (DoS de la tienda). A la inversa, `purchases` valida precio×cantidad y saldo, pero no que el stock se descuente ni que alcance → se puede comprar sin límite sin tocar `stock`.
- **Fix:** en `productos.update` añadir `&& existsAfter(/databases/$(database)/documents/userPoints/$(request.auth.uid)/purchases/$(request.resource.data.lastPurchaseId))` y `stock == resource.data.stock - getAfter(...).data.quantity`; en `purchases.create` exigir `getAfter(productos/$(productId)).data.stock == get(productos/$(productId)).data.stock - quantity`. Requiere cambio coordinado en la Wallet (escribir `lastPurchaseId`).

### R-06 — Código de acceso de evento vulnerable a fuerza bruta **[Manual]**
- **Archivos:** `firestore.rules:130` (`eventSecrets/{eventId}/check/{code}` con `allow get`), `src/pages/EventsPage.jsx:346`, `src/admin/sections/events/AccessCode.jsx`.
- **Evidencia:** cada `getDoc` de `.../check/{código}` responde permitido/denegado sin límite de intentos; los códigos "legibles" son cortos. Un script prueba miles por minuto.
- **Fix:** exigir App Check (R-03.1) y subir longitud mínima del código (≥8 caracteres alfanuméricos) en `AccessCode.jsx` (validar y generar con `crypto.getRandomValues`). Mejor: mover la verificación a la callable de R-03 con límite de intentos por IP.

### R-07 — Enlace de Meet publicado en `events/{id}` (lectura pública) **[Manual]**
- **Archivos:** `src/admin/sections/events/EventForm.jsx:39,50,168` (`meetLink` se guarda en el doc del evento), `firestore.rules` (`events` `allow read: if true`), `functions/emailTemplates.js` (lo usa en el correo).
- **Evidencia:** la UI solo lo muestra tras inscribirse (`EventsPage.jsx:207`), pero cualquiera puede leer el campo desde Firestore sin inscribirse.
- **Impacto:** se entra a eventos virtuales sin registro (aforo, control, asistencia sin registro).
- **Fix:** guardar `meetLink` en `eventSecrets/{eventId}` (ya solo-admin, `firestore.rules` `eventSecrets`), y que `onRegistrationCreated`/`sendSeatConfirmations` lo lean de ahí con Admin SDK; en `EventForm.jsx` escribir/leer desde `eventSecrets`. El panel (admin) lo seguirá viendo.

### R-08 — Dependencias con vulnerabilidades conocidas en producción **[Auto] (parte) / [Manual] (majors)**
- **Archivos:** `package.json`, `package-lock.json`, `functions/package.json`, `functions/package-lock.json`.
- **Evidencia (`npm audit --omit=dev`):**
  - Raíz: `websocket-driver` (crítica), `protobufjs`, `@grpc/grpc-js`, `nanoid`, `postcss`, `source-map-js`, `brace-expansion` (altas), `react-router`/`react-router-dom`/`@remix-run/router` (moderada). Todas con `fix available via npm audit fix`.
  - `functions/`: `protobufjs` y `proxy-addr` (críticas), `body-parser`, `express`, `form-data`, `jws`, `path-to-regexp`, `@fastify/busboy`, `@grpc/grpc-js` (altas), `nodemailer` (alta, directa; el fix requiere `nodemailer@10`), `firebase-admin` (moderada vía `google-gax`, fix = `firebase-admin@14`).
- **Fix [Auto]:** `npm audit fix` en la raíz y en `functions/`; ejecutar `npm run build` y `cd functions && npm test`; commitear los lockfiles. **[Manual]:** `functions/`: subir `nodemailer` a `^10` (revisar `functions/email.js`: la API `createTransport`/`sendMail` no cambia) y `firebase-admin` a `^14` (`initializeApp/getFirestore/getStorage/getAuth` iguales; probar `generateCertificates` en emulador antes de desplegar). Dejar `npm audit --omit=dev` en CI (R-14).

### R-09 — FTP sin cifrar en el despliegue (CI) **[Manual]**
- **Archivo:** `.github/workflows/deploy.yml` (acción `SamKirkland/FTP-Deploy-Action@v4.3.0`, sin `protocol`).
- **Evidencia:** el protocolo por defecto de la acción es `ftp` (texto plano): usuario, contraseña y todo `dist/` viajan sin cifrar. Además cada push sube ~53 MB del APK.
- **Fix:** añadir `protocol: ftps` y `port: 21` (comprobar en hPanel de Hostinger que el FTPS explícito está disponible; si no, SFTP con otra acción). Fijar la acción por SHA de commit, agregar `permissions: { contents: read }` y `concurrency: { group: deploy, cancel-in-progress: true }`.

---

## Medio

### R-10 — `generateCertificates` no es idempotente ante ejecuciones simultáneas **[Manual]**
- **Archivo:** `functions/index.js:48-142,237`.
- **Evidencia:** la lista `existingByEmailRole` se calcula una vez al inicio; dos clics/ejecuciones en paralelo (o un reintento tras timeout de 540 s) crean certificados duplicados por persona/rol. `certificados.add()` genera ID aleatorio.
- **Fix:** ID determinista con `create()`: `const certId = sha1(`${eventKey}|${email}|${roleLower}`)` y `await db.collection('certificados').doc(certId).create({...})`, capturando `code === 6 (ALREADY_EXISTS)` como "omitido". Coordinar con R-01 (que propone `idValidacion` como ID): en ese caso guardar un índice `certIndex/{hash}` creado con `create()` en la misma transacción. Opcional: bloqueo por evento `certLocks/{eventKey}` con TTL de 10 min.

### R-11 — `generateCertificates` descarga plantilla, layout y 4 fuentes de Storage por cada inscrito **[Auto]**
- **Archivo:** `functions/index.js:135-217` (`loadOptional`, `layoutPick`, `templatePick`, `fonts` están dentro del `for (const r of regs)`).
- **Evidencia:** para 300 asistentes son ~2 100 descargas secuenciales; riesgo de superar `timeoutSeconds: 540` y de dejar la emisión a medias.
- **Fix:** mover `loadOptional`/`loadFirst` fuera del bucle y cachear por ruta: `const cache = new Map(); const loadOptional = (p) => cache.get(p) ?? (cache.set(p, (async()=>{...})()), cache.get(p));` (cachear la promesa). Cargar `fonts` y `layout` una sola vez antes del `for`; `templatePick` cacheado por `roleLower|modalidad`. Ejecutar el render en lotes de 5 con `Promise.all` si se desea.

### R-12 — Puntos de certificados no idempotentes **[Manual]**
- **Archivo:** `functions/index.js:261-321`.
- **Evidencia:** los puntos solo se otorgan a los certificados creados en esa corrida; si `userPoints` falla (`pointsErrors`) y se reejecuta, esos certificados ya existen (`skipped`) y los puntos no se reintentan. Además `increment` + `adminGrants.add()` no están en la misma transacción (un fallo entre ambos deja saldo sin historial).
- **Fix:** usar `adminGrants/{certId}` con `create()` y `increment` en un mismo `db.runTransaction`/`batch`; al omitir un certificado existente verificar si ya tiene su `adminGrants` y otorgarlo si falta.

### R-13 — Las reglas no fuerzan minúsculas en el correo usado como ID **[Auto]**
- **Archivos:** `firestore.rules` bloques `registrations` (`id == eventId + '_' + userEmail`) y `voluntarios2026` (`id == email`); el cliente sí normaliza (`EventsPage.jsx:159`).
- **Evidencia:** vía API se puede registrar `Ana@x.com` y `ana@x.com` como dos personas (duplicados y doble cupo).
- **Fix:** en `validEmail` añadir `&& e == e.lower()` (o en cada `create`: `request.resource.data.userEmail == request.resource.data.userEmail.lower()` y `.email == .email.lower()`). Comprobar que `VolunteerPage.jsx` normaliza antes (`grep -n toLowerCase src/pages/VolunteerPage.jsx`).

### R-14 — CI sin pruebas, sin auditoría, sin despliegue de reglas/Functions; Node desalineado **[Manual]**
- **Archivos:** `.github/workflows/deploy.yml`, `package.json`, `functions/package.json` (`engines.node: "22"`), `vite.config.js`.
- **Evidencia:** CI usa Node `'20'` y `npm install` (no `npm ci`: builds no reproducibles); `functions/` declara Node 22; local es Node 24. No se corre `npm test`, ni `npm audit`, ni se publican `firestore.rules`/`storage.rules`/`functions` (las reglas dicen "BORRADOR… no desplegado": nadie garantiza que lo vivo coincida). Vite 7 exige Node ≥ 20.19.
- **Fix:** `node-version: '22'`, `npm ci`, pasos `cd functions && npm ci && npm test` y `npm audit --omit=dev --audit-level=high` (informativo al inicio). Añadir job manual (`workflow_dispatch`) `firebase deploy --only firestore:rules,storage` con `FIREBASE_TOKEN`/WIF. Añadir `"engines": {"node": ">=20.19"}` a la raíz.

### R-15 — Permisos por sección son solo de interfaz; listas de admins duplicadas en 5 sitios **[Manual]**
- **Archivos:** `src/admin/access.js:1-10`, `src/components/AdminGate.jsx:15`, `firestore.rules:7-24`, `storage.rules:8`, `functions/index.js:24`, `.github/copilot-instructions.md`.
- **Evidencia:** el propio `access.js` lo admite: "todos los admins tienen el mismo acceso en Firestore". Un admin con `permissions: ['eventos']` puede leer/escribir cualquier colección con la consola del navegador. Los correos base están copiados en cuatro archivos distintos (riesgo de desalineación, p. ej. `isSuperAdmin` solo en reglas+cliente).
- **Fix:** guardar `permissions` como custom claim o leerlas de `isAdmin/{email}` en reglas por colección (`get(isAdmin/$(email)).data.permissions.hasAny([...])`); mientras tanto avisar en la UI de Accesos que es un filtro visual. Centralizar los correos base en `isAdmin/{email}` (solo la cuenta raíz hardcoded).

### R-16 — Sin Content-Security-Policy; Analytics sin consentimiento **[Manual]**
- **Archivos:** `public/.htaccess:20-26`, `firebase.json:14-34`, `index.html:3-10`.
- **Evidencia:** las cabeceras de seguridad existen pero sin CSP (el comentario lo reconoce); `HSTS` sin `includeSubDomains`; GTM/Google Ads (`AW-18357825422`) se carga en todas las páginas sin banner de consentimiento (relevante para visitantes de la UE). El login de Google por popup necesita `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
- **Fix:** desplegar primero `Content-Security-Policy-Report-Only` y vigilar la consola: `default-src 'self'; script-src 'self' https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google-analytics.com https://*.cloudfunctions.net https://us-central1-*.cloudfunctions.net; img-src 'self' data: blob: https://firebasestorage.googleapis.com https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-src https://www.google.com https://www.youtube-nocookie.com https://*.firebaseapp.com; frame-ancestors 'self'; base-uri 'self'; object-src 'none'` (el `<script>` inline de gtag exige hash o moverlo a un archivo). Añadir `includeSubDomains` a HSTS. Cargar GTM solo tras consentimiento. Mantener `.htaccess` y `firebase.json` sincronizados (están duplicados).

### R-17 — Storage: subidas anónimas con `image/*` (acepta SVG) y lectura pública de comprobantes **[Auto]**
- **Archivo:** `storage.rules:20-42`.
- **Evidencia:** `contentType.matches('image/.*')` admite `image/svg+xml` (SVG activo servido desde un dominio de Google, útil para phishing); no hay tope por usuario (cuota de Storage abusable); `team-pending` solo verifica que la invitación exista, no que esté activa/vigente; `attendance-proofs` y `registration-uploads` son `get` públicos (contienen PII/capturas).
- **Fix:** en los tres bloques usar `request.resource.contentType.matches('image/(jpeg|png|webp|heic)')`; en `team-pending` añadir `&& firestore.get(/databases/(default)/documents/teamInvites/$(token)).data.get('active', true) == true && firestore.get(...).data.expiresAt > request.time`. Recordar desplegar. (Mitigar abuso de cuota con App Check, R-03.)

### R-18 — `events` público expone el correo del admin creador y otros campos internos **[Auto]**
- **Archivo:** `src/admin/sections/events/actions.js:179` (`createdBy: me()` escrito en `events/{id}`, de lectura pública).
- **Evidencia:** cada evento publicado revela el correo del admin que lo creó (`createdBy`). (`updatedBy` en `registrations` y `eventSecrets` no es público: sin problema).
- **Fix:** no escribir `createdBy`/`updatedBy` en `events` (guardarlo en `adminActivity`, que ya registra `logActivity`), o moverlo a `eventSecrets/{id}`. Limpiar los existentes con un script admin (`FieldValue.delete()`).

### R-19 — Costo de lecturas de Firestore en el panel y el resumen **[Auto]**
- **Archivos:** `src/admin/sections/dashboard/index.jsx:25-29` (lee `events` y `certificados` completos, y todos los `registrations` presentes en cada carga), 36 usos de `getDocs/onSnapshot` en `src/` y solo 5 `limit(` en todo el código.
- **Fix:** `certificados` → `getCountFromServer(collection(db,'certificados'))`; "presentes" → `getCountFromServer(query(..., where('statusAsistencia','in', PRESENT_VALUES)))`; `events` con `orderBy('date','desc'), limit(50)` si solo se necesita el próximo/último. Revisar `onSnapshot` sobre `registrations` en `src/admin/sections/events/data.js` y añadir paginación (`limit(200)` + "cargar más") para eventos grandes.

### R-20 — SEO/meta inconsistentes **[Auto]**
- **Archivos:** `src/App.jsx:51-54` (Helmet global con título "…Juventud que Innova Transforma crea Nicaragua" y descripción en **inglés**, que compite con `index.html`), `index.html` (sin `og:image`, `twitter:card`, `og:url`; `<link rel="icon" type="image/png" href="src/images/favicon.webp">` declara tipo PNG para un `.webp`), `src/pages/*.jsx`, `public/sitemap.xml`.
- **Evidencia:** títulos tipo "Inicio - Boreal Labs"; descripciones faltantes en `PaginaValidacion`/`TeamProfilePage`; solo `HomePage`/`TeamPage` definen `canonical` y `og:url`; `sitemap.xml` no incluye `/voxlab`, `/voluntariado/asistencia`; `lastmod` fijo en `2026-03-27`. Al ser SPA sin prerender, los rastreadores sociales (WhatsApp/Facebook) solo ven el `index.html`.
- **Fix:** quitar el `<Helmet>` global de `App.jsx` (cada página ya define el suyo) o traducir y alinear; añadir en `index.html` `og:image` (URL absoluta 1200×630), `og:url`, `twitter:card=summary_large_image`; corregir `type="image/webp"`; añadir `/voxlab` y `/voluntariado/asistencia` al sitemap; poner `noindex` en `/equipo/perfil/:token`, `/voluntariado/personal`, `/validacion`. Mejora mayor [Manual]: prerender (`vite-react-ssg` o `vite-plugin-prerender`) de rutas públicas.

### R-21 — Accesibilidad (WCAG AA): `<main>` anidado, objetivos táctiles pequeños, sin "saltar al contenido" **[Auto]**
- **Archivos:** `src/App.jsx:56` (`<main>`), `src/admin/AdminLayout.jsx:332` y `src/pages/VoxlabPage.jsx:187` (otro `<main>` dentro); `src/components/Navbar.jsx`.
- **Evidencia (DOM a 390 px):** `main: 2` en `/admin` y `/voxlab`; 8 controles interactivos <36 px en `/admin`, 2–3 en rutas públicas (WCAG 2.5.8 pide ≥24 px, recomendable 44); no existe enlace "Saltar al contenido".
- **Fix:** cambiar los `<main>` internos de `AdminLayout.jsx:332` y `VoxlabPage.jsx:187` por `<div>`; en `Navbar.jsx` añadir como primer hijo `<a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:p-3">Saltar al contenido</a>` y `id="contenido" tabIndex={-1}` en el `<main>` de `App.jsx`; `min-h-[44px] min-w-[44px]` en botones icono. Pendiente de medir: contraste (hay 11 usos de `text-white/20..40`, `text-gray-500`, `text-slate-500` en `src/`; verificar ≥4.5:1 con una herramienta).

### R-22 — Rendimiento del bundle público y de las imágenes **[Manual]**
- **Evidencia (build):** carga pública = `vendor-firebase` 394 kB + `vendor` 366 kB + `index` 96 kB + `vendor-motion` 102 kB + CSS único 97 kB (`cssCodeSplit:false`, `vite.config.js`). Panel admin lazy: `vendor-pdf` 1 175 kB y `vendor-pdfjs` 408 kB (bien aislados). Imágenes de hasta 350 kB (`ambiental_1/2`, `limpieza_1`, `refugio_*`) sin `srcset`; solo 3 de ~4 `<img>` por página tienen `loading="lazy"`. Fuentes Agrandir en `.woff` (no `.woff2`) + 3 familias de Google Fonts bloqueantes de terceros.
- **Fix:** (a) `HomePage` no debería arrastrar Firebase en la primera pintura: cargar `configService` con `import()` tras `requestIdleCallback`; (b) usar `LazyMotion` + `m.` de `framer-motion` (−60 kB) o reemplazar animaciones simples por CSS; (c) convertir `public/fonts/*.woff` a `.woff2` y añadir `font-display: swap`; (d) generar variantes 480/768 con `sharp` (`optimize_images.js` ya existe) y `srcset`; (e) `cssCodeSplit: true`; (f) eliminar Google Fonts redundantes (Fredoka, Montserrat, Libre Franklin) si solo se usan en unas pocas vistas.

### R-23 — Código muerto, dependencias sin uso y scripts huérfanos **[Auto]**
- **Evidencia:** dependencias sin ningún `import` en `src/`: `@radix-ui/react-alert-dialog`, `-avatar`, `-checkbox`, `-dropdown-menu`, `-slider`, `-tabs` y `react-lite-youtube-embed`. Scripts raíz que parchean archivos ya inexistentes: `update_app.py` (usa `VolunteerAdminGate`/`VolunteerAdminPanel`), `fix_form2.cjs` (edita `src/pages/AdminPanel.jsx`, que ya no existe), `update_volunteer.js`, `compress_boreal.cjs`, `replace_extensions.js`; archivo mal nombrado `.htacces` en la raíz (duplicado del de `public/`). `npm run build` invoca `tools/generate-llms.js` inexistente (`|| true`, AGENTS.md pide no tocarlo).
- **Fix:** `npm uninstall @radix-ui/react-alert-dialog @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-dropdown-menu @radix-ui/react-slider @radix-ui/react-tabs react-lite-youtube-embed`; `git rm update_app.py fix_form2.cjs update_volunteer.js compress_boreal.cjs replace_extensions.js .htacces` (confirmar con `git grep` que nada los referencia; conservar `optimize_images.js` si se usa); verificar con `npx vite build`.

### R-24 — Ruta de actualización de `firebase-functions`/Cloud Functions **[Manual]**
- **Archivo:** `functions/package.json` (`firebase-functions ^6.6.0`, `firebase-admin ^13.10.0`, `engines.node: "22"`).
- **Evidencia:** las funciones ya usan la API v2 (`onCall`/`onDocumentCreated`), así que el salto de major es de bajo riesgo; `cors: true` en todas las callables; sin `enforceAppCheck`, `maxInstances` solo en los triggers de correo.
- **Fix:** `cd functions && npm outdated`; subir a la última major de `firebase-functions` junto con `firebase-admin@14` (R-08), correr `npm test` y probar en emulador (`npm run serve`). Añadir `enforceAppCheck: true` a las callables una vez activo App Check (R-03), y `maxInstances: 5` a `generateCertificates`/`mergeCertificatesPdf`. Subir la prueba: solo hay 9 pruebas (todas de correo); agregar pruebas de `certificate.js` (`resolveRole`, `templateCandidates`) y de reglas con `@firebase/rules-unit-testing`.

---

## Bajo

### R-25 — Correo "colgado" en `sending` si la función muere tras reclamar **[Manual]**
`functions/email.js:482-497`. Si la instancia se cae entre el `tx.update('sending')` y `sendMail`, el doc queda `sending` y nunca se reintenta (decisión consciente para no duplicar). **Fix:** en el panel mostrar "enviando > 10 min" como reenviable (el botón de reenvío ya existe, `resend`), o un trigger programado que marque `error` los `sending` con `at` < now−10 min.

### R-26 — Logs en producción **[Auto]**
`src/firebase.jsx:77-81` (`console.log("Autenticando anónimamente...", uid)`), ~30 `console.*` en `src/`. **Fix:** en `vite.config.js` añadir `esbuild: { drop: mode === 'production' ? ['console', 'debugger'] : [] }` (o mantener `console.error`: `pure: ['console.log','console.debug']`).

### R-27 — Correo del equipo publicado por diseño **[Manual]**
`src/components/TeamMemberCard.jsx:53` muestra `mailto:` de cada miembro desde `teamMembers` (lectura pública). Confirmar consentimiento de cada persona o permitir ocultarlo (campo `showEmail`).

### R-28 — `answers` de inscripciones sin tope de tamaño por valor **[Auto]**
`firestore.rules` `registrations.create`: `answers.size() <= 40` pero los valores (strings) no tienen límite hasta 1 MiB por documento. **Fix:** no es expresable valor a valor en reglas; limitar en la callable de R-03 o con `request.resource.data.keys().size() <= 20` y validar longitud en el formulario (`maxLength`).

### R-29 — HTML con `no-store` impide caché hacia atrás (bfcache) **[Auto]**
`public/.htaccess:17-21` usa `no-cache, no-store, must-revalidate` + `Pragma`/`Expires 0` para `.html`; `firebase.json` usa `max-age=0,must-revalidate`. **Fix:** `Header set Cache-Control "no-cache"` para `.html` (revalida por ETag y permite bfcache).

### R-30 — Archivos grandes y mezcla de responsabilidades **[Manual]**
`src/pages/EventsPage.jsx` 957 líneas, `VolunteerPage.jsx` 839, `VolunteerAttendancePage.jsx` 452, `src/admin/ui.jsx` 444. **Fix:** extraer el formulario de registro y el modal de confirmación de `EventsPage.jsx` a `src/components/events/*`; no urgente.

### R-31 — Eliminar un evento deja registros huérfanos **[Manual]**
`src/admin/sections/events/actions.js:236-238` borra `events/{id}`, `eventSecrets/{id}` y la plantilla, pero no las `registrations` con ese `eventId` ni los `certificados`. Es probablemente intencional (histórico), pero conviene confirmarlo y documentarlo; si no, añadir borrado por lotes con `commitInChunks`.

### R-32 — Documentación desfasada **[Auto]**
`README.md` ("Auth anónima… Analytics") y `AGENTS.md` (menciona `VolunteerAdminPanel.jsx` 173 KB, `AdminPanel.jsx` 128 KB, "no hay tests" cuando existen los de `functions/email.test.mjs`) ya no reflejan el repo (`src/admin/**`, modo demo `--mode demo`, Functions con correo). **Fix:** actualizar ambos; añadir el comando `npx vite --mode demo` y `cd functions && npm test`.

### R-33 — Oportunidades de actualización **[Manual]**
`tailwindcss` 3→4, `react` 18→19, `framer-motion` 10→`motion`, `lucide-react` 0.285 (muy antigua; actualizar y revisar iconos renombrados), `react-router` 6→7 (ya activan `future` flags), `baseline-browser-mapping` desactualizado (`npm i baseline-browser-mapping@latest -D`). Hacer una por PR con `npx vite build` y pasada visual a 390 px en claro/oscuro.

---

## Fortalezas

- Reglas de Firestore muy cuidadas: `create` público con `hasOnly`, límites de longitud, `request.time`, IDs deterministas contra duplicados y contador de cupos validado con `existsAfter/getAfter` y tope de `capacity`; los créditos de voluntariado solo los asigna un admin; denegación por defecto (`/{document=**}` solo admin).
- Anónimos excluidos de `isAdmin()`; superadmins separados para la colección `isAdmin`.
- `sendOnce`: reclamo transaccional antes del envío, `skipped/sent/error` visibles, escape HTML y enlaces `https` verificados (con pruebas).
- Escape correcto en la hoja imprimible de códigos (`Codes.jsx`: `esc()`), sin `dangerouslySetInnerHTML` en todo `src/`; enlaces externos con `rel="noopener noreferrer"`.
- Firebase opcional (el sitio estático no cae sin `.env`), modo demo que no compila en producción, y `ErrorBoundary` en las rutas.
- Code-splitting correcto: el panel admin y el motor PDF (1,6 MB) no cargan en el sitio público; `loading="lazy"` y `width/height` en imágenes; cero desbordes horizontales a 390 px en las 9 rutas revisadas; todas las `<img>` con `alt`.
- Cabeceras de seguridad básicas y caché inmutable correcta con APK sin `immutable`.

---

## Resumen de conteos

| Severidad | Total | [Auto] | [Manual] | Mixto |
|---|---|---|---|---|
| Crítico | 2 | 0 | 2 | 0 |
| Alto | 7 | 0 | 6 | 1 (R-08) |
| Medio | 15 | 8 | 7 | 0 |
| Bajo | 9 | 4 | 5 | 0 |
| **Total** | **33** | **12** | **20** | **1** |

Auto: R-11, R-13, R-17, R-18, R-19, R-20, R-21, R-23 (Medio); R-26, R-28, R-29, R-32 (Bajo). Mixto: R-08 (`npm audit fix` = Auto; majors de `nodemailer`/`firebase-admin` = Manual). Recordatorio: los cambios en reglas/Functions requieren despliegue manual por el dueño.

---

## Estado de aplicación

Aplicados los hallazgos [Auto] en la rama `claude/aplicar-revision-614728`. Build (`npx vite build --outDir /tmp/build-aplicar`) y `cd functions && npm test` (9/9) pasan. Las reglas (`firestore.rules`, `storage.rules`) y `functions/` solo surten efecto al desplegarlos (acción manual del dueño).

| ID | Estado | Nota |
|---|---|---|
| R-08 | Aplicado (parcial) | `npm audit fix` sin `--force` en raíz y `functions/`. Quedan vulnerabilidades que requieren majors (**[Manual]**: `nodemailer@10`, `firebase-admin@14`). |
| R-11 | Aplicado | Plantilla, layout y fuentes se cachean por ejecución (`functions/index.js`). |
| R-13 | Aplicado | `validEmail` exige minúsculas en `firestore.rules`. |
| R-17 | Aplicado (parcial) | Tipos de imagen limitados a jpeg/png/webp/heic (sin SVG). **Omitido:** la comprobación de `active`/`expiresAt` en `team-pending` (requiere confirmar el esquema real de `teamInvites`). |
| R-18 | Aplicado | Ya no se escribe `createdBy` en `events`. **Pendiente:** limpiar los `createdBy` de documentos existentes (script admin, no automatizable aquí). |
| R-19 | Omitido | Las consultas leen documentos completos porque la lógica los necesita (`certKeys`, presentes por evento). Pasarlas a conteos cambia el cálculo; requiere rediseño. |
| R-20 | Aplicado (parcial) | Helmet global en inglés eliminado, favicon con tipo correcto, `og:url`, `twitter:card`, `noindex` en validación y resumen personal, sitemap completado (se quitó `/validacion`). **Omitido:** `og:image` 1200×630 (no hay imagen en el repo). |
| R-21 | Aplicado (parcial) | `<main>` anidados eliminados y enlace "Saltar al contenido". **Omitido:** objetivos táctiles ≥44 px y contraste WCAG (requieren revisión visual y medición). |
| R-23 | Aplicado | 7 dependencias sin uso desinstaladas; 5 scripts huérfanos y `.htacces` eliminados. |
| R-26 | Aplicado | `esbuild.pure` elimina `console.log`/`console.debug` en build; `warn`/`error` se conservan. |
| R-28 | Omitido | No expresable en reglas (límite por valor). Requiere validación en la callable de R-03 o en el formulario; no es [Auto]. |
| R-29 | Aplicado | HTML con `Cache-Control: no-cache` en `public/.htaccess`. |
| R-32 | Aplicado | README y AGENTS.md actualizados (tests en `functions/`, modo demo, auth anónima opt-in, sin Analytics). |
