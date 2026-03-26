import { db } from '@/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

// Colección y documento donde centralizamos enlaces y configuraciones editables
const CONFIG_COLLECTION = 'siteConfig';
const LINKS_DOC = 'links';
const HOME_DOC = 'home'; // Nuevo documento para info de la página de inicio

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

// Configuración por defecto para la Home (Impacto y Aliados)
export const defaultHomeConfig = {
  impacts: [
    { icon: 'Heart', metric: '+650', description: 'Jóvenes impactados a nivel nacional.' },
    { icon: 'Award', metric: '12', description: 'Eventos y talleres realizados con éxito.' },
    { icon: 'University', metric: '7', description: 'Alianzas con universidades y centros de innovación.' },
    { icon: 'Zap', metric: '8', description: 'Proyectos de emprendimiento en desarrollo.' }
  ],
  partners: [
    { name: 'Universidad Americana (UAM)', alt: 'Logo UAM', imgSrc: 'https://logosnicas.com/wp-content/uploads/2022/08/universidad_americana_2020.png' },
    { name: 'Universidad Nacional de Ingeniería', alt: 'Logo UNI', imgSrc: 'https://www.ualn.edu.ni/wp-content/uploads/2023/02/UNI.png' },
    { name: 'Tecnologico Nacional (INATEC)', alt: 'Logo INATEC', imgSrc: 'https://www.tecnacional.edu.ni/media/uploads/2016/11/18/logo-inatec-2016.png' },
    { name: 'Universidad Nacional Autonoma de Nicaragua, Managua - UNAN', alt: 'Logo UNAN', imgSrc: 'https://www.ualn.edu.ni/wp-content/uploads/2023/02/UNAN-MANAGUA.png' },
    { name: 'Aspire Institute Inc.', alt: 'Logo Aspire', imgSrc: 'https://www.aspireleaders.org/wp-content/uploads/2025/04/Aspire-logotype_red_lg_transparent-1.png' },
  ]
};

export function subscribeHomeConfig(callback) {
  const ref = doc(db, CONFIG_COLLECTION, HOME_DOC);
  return onSnapshot(ref, (snap) => {
    const data = snap.exists() ? snap.data() : {};
    callback({
      impacts: data.impacts || defaultHomeConfig.impacts,
      partners: data.partners || defaultHomeConfig.partners
    });
  }, (error) => {
    callback(defaultHomeConfig);
    console.error('Error suscribiéndose a siteConfig/home:', error);
  });
}

