import { db } from '@/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import partnerUam from '@/images/partners/uam.webp';
import partnerUni from '@/images/partners/uni.webp';
import partnerInatec from '@/images/partners/inatec.webp';
import partnerUnanNuevo from '@/images/partners/unanNuevo.webp';
import partnerAspire from '@/images/partners/aspire.webp';
import partnerTedx from '@/images/partners/logo-white.webp';

// Colección y documento donde centralizamos enlaces y configuraciones editables
const CONFIG_COLLECTION = 'siteConfig';
const LINKS_DOC = 'links';
const HOME_DOC = 'home'; // Nuevo documento para info de la página de inicio

// Valores por defecto para evitar fallos si el documento aún no existe
export const defaultLinks = {
  youtubeVideoUrl: '',
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
    { icon: 'Heart', metric: '+850', description: 'Jóvenes impactados a nivel nacional.' },
    { icon: 'Award', metric: '12', description: 'Eventos y talleres realizados con éxito.' },
    { icon: 'University', metric: '7', description: 'Alianzas con universidades y centros de innovación.' },
    { icon: 'Zap', metric: '8', description: 'Proyectos de emprendimiento en desarrollo.' }
  ],
  partners: [
    { name: 'Universidad Americana (UAM)', alt: 'Logo UAM', imgSrc: partnerUam, width: 256, height: 91 },
    { name: 'Universidad Nacional de Ingeniería', alt: 'Logo UNI', imgSrc: partnerUni, width: 207, height: 128 },
    { name: 'Tecnologico Nacional (INATEC)', alt: 'Logo INATEC', imgSrc: partnerInatec, width: 218, height: 128 },
    { name: 'Universidad Nacional Autonoma de Nicaragua, Managua - UNAN', alt: 'Logo UNAN', imgSrc: partnerUnanNuevo, width: 181, height: 128 },
    { name: 'Aspire Institute Inc.', alt: 'Logo Aspire', imgSrc: partnerAspire, width: 256, height: 97 },
    { name: 'TEDx Avenida Bolivar', alt: 'Logo TEDx Avenida Bolivar', imgSrc: partnerTedx, width: 256, height: 89 },
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

