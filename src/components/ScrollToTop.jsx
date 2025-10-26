import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Componente para forzar scroll al tope en cada cambio de ruta
export default function ScrollToTop({ behavior = 'auto' }) {
  const { pathname } = useLocation();

  useEffect(() => {
    // Desplaza la ventana al inicio cuando cambia la ruta
    window.scrollTo({ top: 0, left: 0, behavior });
  }, [pathname, behavior]);

  return null;
}
