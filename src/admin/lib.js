// Utilidades compartidas del panel admin: bitácora del equipo, fechas y exportación CSV.
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';

/**
 * Registra una acción en `adminActivity` para que el equipo vea quién hizo qué.
 * Nunca lanza: si falla, la acción principal ya se completó y no debe revertirse por la bitácora.
 * @param {string} action  verbo corto, p. ej. 'certificados.generados'
 * @param {string} summary texto legible, p. ej. 'Generó 12 certificados para "Taller IA"'
 * @param {object} [meta]  datos extra serializables (ids, conteos)
 */
export async function logActivity(action, summary, meta = {}) {
  if (!db) return;
  try {
    await addDoc(collection(db, 'adminActivity'), {
      action,
      summary,
      meta,
      actorEmail: auth?.currentUser?.email || 'desconocido',
      actorName: auth?.currentUser?.displayName || null,
      at: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[admin] No se pudo registrar la actividad', error);
  }
}

/** Convierte Timestamp de Firestore, Date, número o string a Date (o null). */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && 'seconds' in value) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFmt = new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const relFmt = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export const formatDate = (value) => { const d = toDate(value); return d ? dateFmt.format(d) : '—'; };
export const formatDateTime = (value) => { const d = toDate(value); return d ? dateTimeFmt.format(d) : '—'; };

export function formatRelative(value) {
  const d = toDate(value);
  if (!d) return '—';
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relFmt.format(seconds, 'second');
  if (abs < 3600) return relFmt.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relFmt.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return relFmt.format(Math.round(seconds / 86400), 'day');
  return dateFmt.format(d);
}

/**
 * Descarga un CSV (UTF-8 con BOM para que Excel respete tildes).
 * @param {string} filename
 * @param {Array<{key: string, label: string, value?: (row) => any}>} columns
 * @param {Array<object>} rows
 */
export function downloadCsv(filename, columns, rows) {
  const escape = (v) => {
    const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    // Prefijo ' contra inyección de fórmulas al abrir en Excel/Sheets.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [
    columns.map((c) => escape(c.label)).join(','),
    ...rows.map((row) => columns.map((c) => escape(c.value ? c.value(row) : row[c.key])).join(',')),
  ];
  const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Normaliza texto para búsquedas sin tildes ni mayúsculas. */
/** URL pública de validación de un certificado (aquí y no en templates/engine para no arrastrar pdf-lib). */
export const validationUrlFor = (id) => `${window.location.origin}/validacion?id=${encodeURIComponent(id)}`;

export const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Mismo criterio que functions/index.js para "asistió". */
export const isPresent = (value) => {
  if (typeof value === 'string') return ['presente', 'present'].includes(value.toLowerCase());
  return !!value;
};
