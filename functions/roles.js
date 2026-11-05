// Sin dependencias: lo importan la Cloud Function y el panel admin sin arrastrar pdf-lib.
/** Rol del registro: 'participante' | 'ponente' | 'staff'. */
export const resolveRole = (r) => (r.tipo || '').toLowerCase()
  || ((r.tipoAsistencia || '').toLowerCase().match(/^(ponente|staff|participante)$/)?.[0] || 'participante');
