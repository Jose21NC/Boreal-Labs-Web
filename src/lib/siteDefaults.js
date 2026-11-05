// Valores por defecto del contenido editable (siteConfig/home y siteConfig/links).
// Sin dependencias de Firebase: lo importan Home/Navbar/Footer para pintar al instante,
// y configService (cargado bajo demanda) los reemplaza con lo guardado en Firestore.
import partnerUam from '@/images/partners/uam.webp';
import partnerUni from '@/images/partners/uni.webp';
import partnerInatec from '@/images/partners/inatec.webp';
import partnerUnanNuevo from '@/images/partners/unanNuevo.webp';
import partnerAspire from '@/images/partners/aspire.webp';
import partnerTedx from '@/images/partners/logo-white.webp';

export const defaultLinks = {
  youtubeVideoUrl: '',
  walletUrl: 'https://wallet.borealabs.org',
  communityUrl: 'https://chat.whatsapp.com/HAaxnHFYsuaBltQ812XhRW?mode=wwc',
  instagramUrl: 'https://instagram.com/boreal.labs',
};

export const defaultHomeConfig = {
  images: { hero: '', workshop: '', about: '' },
  impacts: [
    { icon: 'Heart', metric: '+850', description: 'Jóvenes impactados a nivel nacional.' },
    { icon: 'Award', metric: '12', description: 'Eventos y talleres realizados con éxito.' },
    { icon: 'University', metric: '7', description: 'Alianzas con universidades y centros de innovación.' },
    { icon: 'Award', metric: '280', description: 'certificados digitales emitidos' },
  ],
  partners: [
    { name: 'Universidad Americana (UAM)', alt: 'Logo UAM', imgSrc: partnerUam, width: 256, height: 91 },
    { name: 'Universidad Nacional de Ingeniería', alt: 'Logo UNI', imgSrc: partnerUni, width: 207, height: 128 },
    { name: 'Tecnologico Nacional (INATEC)', alt: 'Logo INATEC', imgSrc: partnerInatec, width: 218, height: 128 },
    { name: 'Universidad Nacional Autonoma de Nicaragua, Managua - UNAN', alt: 'Logo UNAN', imgSrc: partnerUnanNuevo, width: 181, height: 128 },
    { name: 'Aspire Institute Inc.', alt: 'Logo Aspire', imgSrc: partnerAspire, width: 256, height: 97 },
    { name: 'TEDx Avenida Bolivar', alt: 'Logo TEDx Avenida Bolivar', imgSrc: partnerTedx, width: 256, height: 89 },
  ],
};

// Imágenes editables del sitio. Vacío = imagen incluida en el build (responsive, optimizada).
export const SITE_IMAGES = [
  { key: 'hero', label: 'Portada del inicio', hint: 'Fondo del encabezado. Horizontal, 1920×1080 recomendado.' },
  { key: 'workshop', label: 'Imagen de talleres (inicio)', hint: 'Sección de talleres. Horizontal, 1280×720 recomendado.' },
  { key: 'about', label: 'Imagen “Quiénes somos”', hint: 'Página Nosotros. 1200×900 recomendado.' },
];

export const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

/** Mezcla el doc de Firestore con los defaults; descarta enlaces que no sean http(s) (evita javascript:). */
export function resolveLinks(data = {}) {
  const out = { ...defaultLinks };
  Object.keys(defaultLinks).forEach((key) => {
    if (isHttpUrl(data[key])) out[key] = String(data[key]).trim();
  });
  if (!data.youtubeVideoUrl && isHttpUrl(data.youtubeUrl)) out.youtubeVideoUrl = data.youtubeUrl; // campo heredado
  return out;
}

/**
 * Logos de los aliados por defecto son assets con hash de Vite: si el doc guardó una ruta local
 * (p. ej. /assets/uam-abc.webp de un build anterior), se usa el asset actual del aliado con el mismo nombre.
 */
const resolvePartnerLogo = (partner) => {
  const src = String(partner.imgSrc || '');
  if (/^(https?:|blob:)/i.test(src)) return partner;
  const fallback = defaultHomeConfig.partners.find((p) => p.name === partner.name);
  return fallback ? { ...partner, imgSrc: fallback.imgSrc, width: partner.width || fallback.width, height: partner.height || fallback.height } : partner;
};

/** Solo URLs https (Storage) por cada imagen conocida; lo demás cae a la imagen del build. */
export function resolveImages(images = {}) {
  return Object.fromEntries(SITE_IMAGES.map(({ key }) => [key, /^https:\/\//i.test(String(images?.[key] || '')) ? images[key] : '']));
}

export function resolveHomeConfig(data = {}) {
  return {
    impacts: Array.isArray(data.impacts) ? data.impacts : defaultHomeConfig.impacts,
    partners: Array.isArray(data.partners) ? data.partners.map(resolvePartnerLogo).filter((p) => p.imgSrc) : defaultHomeConfig.partners,
    images: resolveImages(data.images),
  };
}
