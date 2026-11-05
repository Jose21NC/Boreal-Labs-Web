// Lectura del contenido editable desde Firestore (siteConfig/links y siteConfig/home).
// Las páginas públicas lo cargan con import() dinámico (ver useSiteConfig.js) para no meter
// el SDK de Firebase en el bundle inicial. Una lectura por documento y por carga de página.
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { defaultHomeConfig, defaultLinks, resolveHomeConfig, resolveLinks } from '@/lib/siteDefaults';

export { defaultHomeConfig, defaultLinks };

const CONFIG_COLLECTION = 'siteConfig';
const cache = {};

// Cachea la promesa (no el resultado) para que Navbar, Footer y Home compartan la misma lectura.
function readConfig(docId, resolve, fallback) {
  if (!db) return Promise.resolve(fallback);
  cache[docId] ||= getDoc(doc(db, CONFIG_COLLECTION, docId))
    .then((snap) => resolve(snap.exists() ? snap.data() : {}))
    .catch((error) => {
      delete cache[docId];
      console.warn(`[config] No se pudo leer siteConfig/${docId}; se usan los valores por defecto.`, error);
      return fallback;
    });
  return cache[docId];
}

export const getLinks = () => readConfig('links', resolveLinks, defaultLinks);
export const getHomeConfig = () => readConfig('home', resolveHomeConfig, defaultHomeConfig);

/** Tras guardar desde el admin: la próxima visita a una página pública vuelve a leer. */
export const invalidateSiteConfig = () => { delete cache.links; delete cache.home; };

export async function getLink(key, fallback) {
  const links = await getLinks();
  return links?.[key] ?? fallback ?? null;
}

// Normaliza una URL de YouTube a formato embebible
export function normalizeYouTubeUrl(url) {
  if (!url) return defaultLinks.youtubeVideoUrl;
  try {
    if (url.includes('/embed/')) return url;
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.replace('/', '')}`;
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      // También soporta /shorts/<id> o /live/<id>
      const parts = u.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
    }
  } catch (e) {
    // Si no es una URL válida, devuelve por defecto
  }
  return defaultLinks.youtubeVideoUrl;
}
