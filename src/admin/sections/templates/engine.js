// Puente entre el panel y el motor compartido (functions/certificate.js): carga plantillas, layout y
// fuentes desde Storage con el MISMO orden de búsqueda que la Cloud Function, para que la vista previa
// sea idéntica al certificado real.
import { ref, getBytes, listAll, uploadBytes, deleteObject } from 'firebase/storage';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { PDFDocument } from 'pdf-lib';
import { db, storage } from '@/firebase';
import {
  DEFAULT_LAYOUT, mergeLayout, renderCertificate, templateCandidates, normalizeTemplateSet, formatCiudadFecha,
} from '../../../../functions/certificate.js';

export { DEFAULT_LAYOUT, mergeLayout, renderCertificate, templateCandidates, normalizeTemplateSet, formatCiudadFecha };

export const ROOT = 'cert-templates';
/** Carpetas conocidas aunque aún no estén en Storage (antes vivían en AdminPanel/LayoutEditor). */
export const DEFAULT_SETS = ['BASE UAM - DIEM'];
const LOCAL_SETS_KEY = 'admin:templateSets';
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Variantes que el editor permite subir. `role`/`modality` sirven para la vista previa. */
export const VARIANTS = [
  { file: 'base.pdf', label: 'Participante presencial', short: 'Presencial', role: 'participante', modality: 'presencial' },
  { file: 'base-virtual.pdf', label: 'Participante virtual', short: 'Virtual', role: 'participante', modality: 'virtual' },
  { file: 'base-ponente.pdf', label: 'Ponente', short: 'Ponente', role: 'ponente', modality: 'presencial' },
  { file: 'base-staff.pdf', label: 'Staff', short: 'Staff', role: 'staff', modality: 'presencial' },
];

/** set '' = carpeta raíz (plantillas generales que sirven de respaldo a todas las carpetas). */
export const setPath = (set) => (set ? `${ROOT}/${set}` : ROOT);
export const setLabel = (set) => (set ? set : 'General (raíz)');

import { validationUrlFor } from '@/admin/lib';
export { validationUrlFor };

const loadOptional = async (path) => {
  try {
    return new Uint8Array(await getBytes(ref(storage, path)));
  } catch {
    return null; // no existe o sin permiso: igual que la Function, se sigue con el siguiente candidato
  }
};

const loadFirst = async (paths) => {
  for (const p of paths) {
    const buf = await loadOptional(p);
    if (buf) return { buf, path: p };
  }
  return null;
};

let fontsPromise = null;
/** Libre Franklin desde Storage (opcional, cacheada). Sin ellas el motor usa Helvetica, igual que en producción. */
export const loadFonts = () => {
  fontsPromise ||= Promise.all(['Bold', 'Regular', 'Italic', 'BoldItalic'].map((n) => loadOptional(`${ROOT}/fonts/LibreFranklin-${n}.ttf`)))
    .then(([bold, regular, italic, boldItalic]) => ({ bold, regular, italic, boldItalic }));
  return fontsPromise;
};

/** Layout efectivo de una carpeta: el suyo, el general o el default. */
export async function loadLayout(set) {
  const pick = await loadFirst([`${setPath(set)}/layout.json`, `${ROOT}/layout.json`]);
  const parsed = pick ? JSON.parse(new TextDecoder().decode(pick.buf)) : null;
  return { layout: mergeLayout(parsed), source: pick?.path || null, raw: parsed };
}

/** Plantilla PDF que usaría la Function para ese rol/modalidad. */
export async function loadTemplate(set, role, modality) {
  const candidates = templateCandidates(role, String(modality || '').toLowerCase());
  return loadFirst([...candidates.map((p) => `${setPath(set)}/${p}`), ...candidates.map((p) => `${ROOT}/${p}`)]);
}

/** Datos de ejemplo para vista previa. */
export const sampleData = (overrides = {}) => ({
  nombreUsuario: 'María Fernanda López',
  nombreEvento: 'Taller de IA Generativa',
  modalidad: 'Presencial',
  rol: 'participante',
  idValidacion: '3f2a9c1e-7b4d-4e8a-9c21-5d6e7f8a9b0c',
  ciudadFecha: formatCiudadFecha(new Date()),
  ...overrides,
});

/**
 * Renderiza un certificado real con el motor compartido.
 * @param {{set: string, role: string, modality: string, layout?: object, data?: object}} opts
 * @returns {Promise<{bytes: Uint8Array, templatePath: string|null, layoutSource: string|null}>}
 */
export async function renderPreview({ set, role, modality, layout, data }) {
  const [template, layoutInfo, fonts] = await Promise.all([
    loadTemplate(set, role, modality),
    layout ? null : loadLayout(set),
    loadFonts(),
  ]);
  const d = sampleData({ rol: role, modalidad: modality === 'virtual' ? 'Virtual' : 'Presencial', ...data });
  const bytes = await renderCertificate({
    templateBytes: template?.buf || null,
    layout: layout ? mergeLayout(layout) : layoutInfo.layout,
    fonts,
    data: { ...d, validationUrl: validationUrlFor(d.idValidacion) },
  });
  return { bytes, templatePath: template?.path || null, layoutSource: layout ? 'editor' : layoutInfo.source };
}

export const pdfBlobUrl = (bytes) => URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));

// ---------- Carpetas ----------
export function readLocalSets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SETS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function rememberSet(set) {
  const cleaned = normalizeTemplateSet(set);
  if (!cleaned) return null;
  const list = readLocalSets();
  if (!list.includes(cleaned)) {
    try { localStorage.setItem(LOCAL_SETS_KEY, JSON.stringify([...list, cleaned])); } catch { /* cuota */ }
  }
  return cleaned;
}

/** Archivos (nombres) directamente dentro de una carpeta. */
export async function listFiles(set) {
  try {
    const res = await listAll(ref(storage, setPath(set)));
    return res.items.map((i) => i.name);
  } catch {
    return [];
  }
}

/**
 * Todas las carpetas: Storage (hasta 2 niveles, p. ej. eventos-admin/<slug>), las recordadas en este
 * navegador, las predeterminadas y las asignadas a eventos.
 * @returns {Promise<{sets: Array<{name: string, files: string[], events: string[]}>, rootFiles: string[], byEvent: Record<string,string>}>}
 */
export async function loadTemplateSets() {
  const found = new Map(); // name -> files
  let rootFiles = [];
  try {
    const top = await listAll(ref(storage, ROOT));
    rootFiles = top.items.map((i) => i.name);
    await Promise.all(top.prefixes.filter((p) => p.name !== 'fonts').map(async (p) => {
      const inner = await listAll(p);
      if (inner.items.length || !inner.prefixes.length) found.set(p.name, inner.items.map((i) => i.name));
      await Promise.all(inner.prefixes.map(async (q) => {
        const deep = await listAll(q);
        found.set(`${p.name}/${q.name}`, deep.items.map((i) => i.name));
      }));
    }));
  } catch (error) {
    console.warn('[plantillas] No se pudo listar Storage', error);
  }

  const byEvent = {};
  try {
    const snap = await getDocs(collection(db, 'eventTemplates'));
    snap.docs.forEach((d) => {
      const { eventName, templateSet } = d.data() || {};
      if (eventName && templateSet) byEvent[eventName] = templateSet;
    });
  } catch (error) {
    console.warn('[plantillas] No se pudo leer eventTemplates', error);
  }

  const names = new Set([...DEFAULT_SETS, ...readLocalSets(), ...Object.values(byEvent), ...found.keys()]);
  const sets = [...names].map((name) => ({
    name,
    files: found.get(name) || [],
    events: Object.keys(byEvent).filter((e) => byEvent[e] === name),
  })).sort((a, b) => a.name.localeCompare(b.name));
  return { sets, rootFiles, byEvent };
}

/** Qué archivo usaría cada variante, con respaldo en la raíz. */
export function resolveVariants(files, rootFiles) {
  return VARIANTS.map((v) => {
    const candidates = templateCandidates(v.role, v.modality);
    const own = candidates.find((c) => files.includes(c));
    const fallback = own ? null : candidates.find((c) => rootFiles.includes(c));
    return { ...v, exists: files.includes(v.file), uses: own || null, fallback: fallback || null };
  });
}

/** Valida un PDF antes de subirlo: tipo, tamaño y que pdf-lib lo pueda abrir. Devuelve {pages, width, height}. */
export async function validatePdf(file) {
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!looksPdf) throw new Error('El archivo debe ser un PDF.');
  if (file.size > MAX_PDF_BYTES) throw new Error(`Pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es 10 MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    throw new Error('El PDF está dañado o protegido con contraseña.');
  }
  const pages = doc.getPageCount();
  if (!pages) throw new Error('El PDF no tiene páginas.');
  const { width, height } = doc.getPage(0).getSize();
  return { bytes, pages, width, height };
}

export const uploadTemplatePdf = (set, fileName, bytes) =>
  uploadBytes(ref(storage, `${setPath(set)}/${fileName}`), bytes, { contentType: 'application/pdf' });

/** Guarda layout.json con el mismo formato que exportaba el editor anterior (absPx + rel + style). */
export async function saveLayout(set, layout) {
  const canvas = layout.canvas || DEFAULT_LAYOUT.canvas;
  const elements = Object.fromEntries(Object.entries(layout.elements).map(([key, el]) => [key, {
    absPx: {
      x: Math.round(el.rel.x * canvas.widthPx),
      y: Math.round(el.rel.y * canvas.heightPx),
      width: Math.round(el.rel.width * canvas.widthPx),
      height: Math.round(el.rel.height * canvas.heightPx),
    },
    rel: el.rel,
    ...(el.style ? { style: el.style } : {}),
  }]));
  const json = { canvas, safeMarginPx: layout.safeMarginPx ?? DEFAULT_LAYOUT.safeMarginPx, elements };
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  await uploadBytes(ref(storage, `${setPath(set)}/layout.json`), blob, { contentType: 'application/json' });
  return json;
}

/** Todos los archivos bajo una carpeta, incluidas subcarpetas. */
async function listDeep(storageRefDir) {
  const res = await listAll(storageRefDir);
  const nested = await Promise.all(res.prefixes.map(listDeep));
  return [...res.items, ...nested.flat()];
}

/**
 * Borra una carpeta de plantillas (PDFs + layout.json) y quita su asignación en los eventos
 * (esos eventos pasan a la plantilla automática). Nunca la raíz: es el respaldo de todas.
 * @returns {Promise<{files: number, events: string[]}>}
 */
export async function deleteTemplateSet(set, events = []) {
  const cleaned = normalizeTemplateSet(set);
  if (!cleaned) throw new Error('No se puede eliminar la carpeta raíz.');
  const files = await listDeep(ref(storage, setPath(cleaned)));
  await Promise.all(files.map((f) => deleteObject(f)));
  await Promise.all(events.map((name) => deleteDoc(doc(db, 'eventTemplates', encodeURIComponent(name)))));
  try {
    localStorage.setItem(LOCAL_SETS_KEY, JSON.stringify(readLocalSets().filter((s) => s !== cleaned)));
  } catch { /* modo privado */ }
  return { files: files.length, events };
}
