// Formulario de inscripción configurable por evento: lo comparten el editor del admin y /eventos.
// Campos guardados en `events/{id}.formFields`; respuestas en `registrations/{id}.answers`.
import { doc, getDoc } from 'firebase/firestore';

export const FIELD_TYPES = [
  { value: 'text', label: 'Respuesta corta' },
  { value: 'textarea', label: 'Respuesta larga' },
  { value: 'select', label: 'Opción única (lista)' },
  { value: 'radio', label: 'Opción única (botones)' },
  { value: 'multiselect', label: 'Selección múltiple' },
  { value: 'checkbox', label: 'Casilla sí/no' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'email', label: 'Correo' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'url', label: 'Enlace (URL)' },
  { value: 'image', label: 'Imagen' },
];
export const CHOICE_TYPES = ['select', 'radio', 'multiselect'];
export const MAX_FIELDS = 25;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Claves que ya usan los eventos existentes; no se pueden borrar desde el admin.
export const BUILTIN_CATEGORIES = [
  { value: 'workshop', label: 'Taller' },
  { value: 'conference', label: 'Conferencia' },
  { value: 'networking', label: 'Networking' },
  { value: 'competition', label: 'Competencia' },
  { value: 'voluntariado', label: 'Voluntariado' },
];

/** Categorías integradas + `siteConfig/eventCategories.items` ({ key, label }). */
export const mergeCategories = (items) => [
  ...BUILTIN_CATEGORIES,
  ...(Array.isArray(items) ? items : [])
    .filter((c) => c?.key && c?.label && !BUILTIN_CATEGORIES.some((b) => b.value === c.key))
    .map((c) => ({ value: c.key, label: c.label, custom: true })),
];

/** Lectura pública de las categorías personalizadas; sin Firebase o con error, solo las integradas. */
export async function loadEventCategories(db) {
  if (!db) return BUILTIN_CATEGORIES;
  try {
    const snap = await getDoc(doc(db, 'siteConfig', 'eventCategories'));
    return mergeCategories(snap.exists() ? snap.data().items : []);
  } catch (error) {
    console.warn('[eventos] No se pudieron leer las categorías; se usan las integradas.', error);
    return BUILTIN_CATEGORIES;
  }
}

/** El código de inscripción se compara en mayúsculas y sin espacios en los extremos (admin y formulario). */
export const normalizeCode = (value) => String(value || '').trim().toUpperCase();

const randomChars = (n, alphabet) => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
};
/** Sin 0/O/1/I para que se pueda dictar. */
export const generateCode = () => randomChars(8, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
/** id corto y estable de un campo; nunca se reutiliza porque es aleatorio. */
export const newFieldId = () => `f_${randomChars(6, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;

export const isHttpUrl = (v) => /^https?:\/\/\S+$/i.test(String(v || '').trim());

const isEmpty = (field, v) => {
  if (field.type === 'checkbox') return v !== true;
  if (field.type === 'multiselect') return !Array.isArray(v) || v.length === 0;
  if (field.type === 'image') return !v;
  return v == null || String(v).trim() === '';
};

/** Valida las respuestas del formulario público. Devuelve el primer error legible o null. */
export function validateAnswers(fields, values) {
  for (const f of fields || []) {
    const v = values[f.id];
    if (f.required && isEmpty(f, v)) return `Completa "${f.label}".`;
    if (isEmpty(f, v)) continue; // eslint-disable-line no-continue
    if (f.type === 'multiselect' && f.maxSelections && v.length > f.maxSelections) return `En "${f.label}" elige como máximo ${f.maxSelections}.`;
    if (f.type === 'url' && !isHttpUrl(v)) return `"${f.label}" debe ser un enlace que empiece con http:// o https://.`;
    if (f.type === 'email' && !/^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(String(v).trim())) return `"${f.label}" debe ser un correo válido.`;
    if (f.type === 'number' && !Number.isFinite(Number(v))) return `"${f.label}" debe ser un número.`;
    if (f.type === 'image') {
      if (!String(v.type || '').startsWith('image/')) return `"${f.label}" debe ser una imagen.`;
      if (v.size > MAX_IMAGE_BYTES) return `La imagen de "${f.label}" supera 5 MB.`;
    }
  }
  return null;
}

/** Valida la definición de campos en el editor del admin. */
export function validateFields(fields) {
  if (fields.length > MAX_FIELDS) return `Máximo ${MAX_FIELDS} campos adicionales.`;
  for (const [i, f] of fields.entries()) {
    if (!String(f.label || '').trim()) return `El campo adicional #${i + 1} necesita una etiqueta.`;
    if (CHOICE_TYPES.includes(f.type) && (f.options || []).filter((o) => o.trim()).length < 2) return `"${f.label}" necesita al menos 2 opciones.`;
  }
  return null;
}

/** Limpia la definición antes de guardarla (sin claves vacías). */
export const cleanFields = (fields) => fields.map((f) => {
  const out = { id: f.id, type: f.type, label: f.label.trim(), required: !!f.required };
  if (f.help?.trim()) out.help = f.help.trim();
  if (f.placeholder?.trim() && !['checkbox', 'image', ...CHOICE_TYPES].includes(f.type)) out.placeholder = f.placeholder.trim();
  if (CHOICE_TYPES.includes(f.type)) out.options = [...new Set(f.options.map((o) => o.trim()).filter(Boolean))];
  if (f.type === 'multiselect' && Number(f.maxSelections) > 0) out.maxSelections = Math.floor(Number(f.maxSelections));
  return out;
});

/** Texto plano de una respuesta (tabla, CSV). Imágenes: su URL. */
export const answerText = (v) => {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.join('; ');
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'object') return v.url || '';
  return String(v);
};
