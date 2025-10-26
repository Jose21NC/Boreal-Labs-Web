import { db } from '@/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

// Colección y documento donde centralizamos enlaces y configuraciones editables
const CONFIG_COLLECTION = 'siteConfig';
const LINKS_DOC = 'links';

// Valores por defecto para evitar fallos si el documento aún no existe
export const defaultLinks = {
  youtubeVideoUrl: 'https://www.youtube.com/embed/TU_ID_DEL_VIDEO',
  walletUrl: 'https://wallet.borealabs.org',
  communityUrl: 'https://chat.whatsapp.com/HAaxnHFYsuaBltQ812XhRW?mode=wwc',
  instagramUrl: 'https://instagram.com/boreal.labs',
};

let cachedLinks = null;

// Normaliza una URL de YouTube a formato embebible
export function normalizeYouTubeUrl(url) {
  if (!url) return defaultLinks.youtubeVideoUrl;
  try {
    // Ya es formato embed
    if (url.includes('/embed/')) return url;

    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${id}`;
    }
    // www.youtube.com/watch?v=<id>
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      // También soporta /shorts/<id> o /live/<id>
      const parts = u.pathname.split('/').filter(Boolean);
      const possibleId = parts[1];
      if ((parts[0] === 'shorts' || parts[0] === 'live') && possibleId) {
        return `https://www.youtube.com/embed/${possibleId}`;
      }
    }
  } catch (e) {
    // Si no es una URL válida, devuelve por defecto
  }
  return defaultLinks.youtubeVideoUrl;
}

export async function getLinks() {
  if (cachedLinks) return cachedLinks;
  const ref = doc(db, CONFIG_COLLECTION, LINKS_DOC);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    cachedLinks = { ...defaultLinks, ...data };
  } else {
    cachedLinks = { ...defaultLinks };
  }
  return cachedLinks;
}

export function subscribeLinks(callback) {
  const ref = doc(db, CONFIG_COLLECTION, LINKS_DOC);
  return onSnapshot(ref, (snap) => {
    const data = snap.exists() ? snap.data() : {};
    cachedLinks = { ...defaultLinks, ...data };
    callback(cachedLinks);
  }, (error) => {
    // En caso de error, devolvemos los defaults para no romper la UI
    callback(cachedLinks || defaultLinks);
    console.error('Error suscribiéndose a siteConfig/links:', error);
  });
}

export async function getLink(key, fallback) {
  const links = await getLinks();
  return links?.[key] ?? fallback ?? null;
}
