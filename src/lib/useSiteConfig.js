// Hooks públicos: pintan con los defaults al instante y los reemplazan cuando llega Firestore.
// configService se importa dinámicamente para que Firebase no entre en el bundle inicial.
import { useEffect, useState } from 'react';
import { defaultHomeConfig, defaultLinks } from '@/lib/siteDefaults';

// Las imágenes personalizadas se recuerdan para no mostrar la del build y cambiarla en cada visita.
const IMAGES_KEY = 'site:images';
const cachedImages = () => {
  try { return JSON.parse(localStorage.getItem(IMAGES_KEY)) || null; } catch { return null; }
};

function useConfig(getterName, fallback) {
  const [value, setValue] = useState(() => {
    const images = getterName === 'getHomeConfig' && cachedImages();
    return images ? { ...fallback, images: { ...fallback.images, ...images } } : fallback;
  });
  useEffect(() => {
    let alive = true;
    // En reposo: el SDK de Firebase no compite con el render inicial (LCP/TBT).
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    idle(() => {
      import('@/lib/configService')
        .then((m) => m[getterName]())
        .then((v) => {
          if (v?.images) { try { localStorage.setItem(IMAGES_KEY, JSON.stringify(v.images)); } catch { /* modo privado */ } }
          if (alive) setValue(v);
        })
        .catch(() => { /* sin red o sin Firebase: se quedan los defaults */ });
    }, { timeout: 3000 });
    return () => { alive = false; };
  }, [getterName]);
  return value;
}

export const useSiteLinks = () => useConfig('getLinks', defaultLinks);
export const useHomeConfig = () => useConfig('getHomeConfig', defaultHomeConfig);
