// Quién entra al panel y qué secciones ve.
// - Admins base: escritos en el código (y en firestore.rules/storage.rules/functions). Ven todo.
// - Superadmins: además gestionan la sección Accesos (colección isAdmin, protegida por las reglas).
// - Admins agregados: isAdmin/{correo} con `permissions` (lista de secciones) o 'all'.
// Ojo: las secciones son un filtro de la interfaz; en Firestore todos los admins tienen el mismo acceso.
import { createContext, useContext } from 'react';

export const BASE_ADMINS = ['contacto@borealabs.org', 'admin@borealabs.org', 'jose@borealabs.org'];
export const SUPER_ADMINS = ['admin@borealabs.org', 'jose@borealabs.org'];

/** Secciones asignables (clave = ruta bajo /admin). El Resumen siempre es visible. */
export const SECTIONS = [
  { key: 'actividad', label: 'Actividad del equipo' },
  { key: 'eventos', label: 'Eventos y asistencia' },
  { key: 'certificados', label: 'Certificados' },
  { key: 'plantillas', label: 'Plantillas' },
  { key: 'puntos', label: 'Puntos' },
  { key: 'voluntariado', label: 'Voluntariado' },
  { key: 'equipo', label: 'Equipo' },
  { key: 'sitio', label: 'Contenido del sitio' },
];

export const AccessContext = createContext({ email: null, isSuper: false, permissions: 'all' });
export const useAccess = () => useContext(AccessContext);

/** ¿Puede ver la sección `key` (p. ej. 'eventos')? '' = Resumen. */
export const canSee = (access, key) => {
  if (!key) return true;
  if (key === 'accesos') return access.isSuper;
  return access.permissions === 'all' || (Array.isArray(access.permissions) && access.permissions.includes(key));
};

export const sectionOfPath = (pathname) => pathname.replace(/^\/admin\/?/, '').split('/')[0];
