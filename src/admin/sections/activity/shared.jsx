// Piezas compartidas entre "Actividad del equipo" y el Resumen (que muestra las últimas acciones).
import React from 'react';
import { cn } from '@/lib/utils';

/** Áreas = prefijo de `action` antes del punto (p. ej. 'eventos.creado' → 'eventos'). */
export const AREAS = {
  eventos: 'Eventos',
  certificados: 'Certificados',
  plantillas: 'Plantillas',
  voluntariado: 'Voluntariado',
  equipo: 'Equipo',
  sitio: 'Sitio',
  puntos: 'Puntos',
  accesos: 'Accesos',
};

export const areaOf = (action) => String(action || '').split('.')[0] || 'otros';
export const actorLabel = (item) => item.actorName || item.actorEmail || 'desconocido';

export function ActorAvatar({ item, className }) {
  return (
    <span
      className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-adm-accent/15 text-xs font-semibold uppercase text-adm-accent', className)}
      title={item.actorEmail || undefined}
      aria-hidden="true"
    >
      {actorLabel(item).slice(0, 1)}
    </span>
  );
}
