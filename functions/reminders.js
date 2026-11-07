// Recordatorios automáticos de eventos: qué tanda toca enviar en cada corrida de la Function programada.
// Presencial: 1 día antes. Virtual: 15 minutos antes. Puro (sin Firestore) para poder probarlo.
export const PRESENCIAL_LEAD_MS = 24 * 60 * 60 * 1000;
export const VIRTUAL_LEAD_MS = 15 * 60 * 1000;
export const LOOKAHEAD_MS = PRESENCIAL_LEAD_MS + 60 * 60 * 1000; // ventana de búsqueda: próximas 25 h

const toMs = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : null);

export const isVirtualReg = (reg) => /virtual/i.test(String(reg?.tipoAsistencia || reg?.modalidad || ''));

/**
 * Tandas pendientes para un evento ahora: 'presencial' y/o 'virtual'.
 * Solo antes de que empiece, con recordatorios activados y una vez por tanda (marcas en el evento).
 */
export function duePhases(ev, now = Date.now()) {
  const start = toMs(ev?.startAt);
  if (!ev?.remindersEnabled || !start || now >= start) return [];
  const phases = [];
  if (!ev.reminderPresencialSentAt && now >= start - PRESENCIAL_LEAD_MS) phases.push('presencial');
  if (!ev.reminderVirtualSentAt && now >= start - VIRTUAL_LEAD_MS) phases.push('virtual');
  return phases;
}
