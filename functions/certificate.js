// Motor de certificados compartido: lo usan la Cloud Function (functions/index.js) y el panel admin
// (vista previa y modo de prueba). Módulo puro: no toca Firestore ni Storage ni usa Buffer.
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';

export const DEFAULT_LAYOUT = {
  canvas: { widthPx: 2000, heightPx: 1414, orientation: 'landscape', paperHint: '≈ A4' },
  safeMarginPx: 35,
  elements: {
    nombreUsuario: {
      rel: { x: 0.10, y: 0.297, width: 0.80, height: 0.078 },
      style: { fontFamily: 'Libre Franklin', fontSizePx: 64, fontWeight: 800, fontStyle: 'normal', color: '#373737', textAlign: 'center', transform: 'uppercase', tracking: '0.5px' },
    },
    nombreEvento: {
      rel: { x: 0.15, y: 0.431, width: 0.70, height: 0.056 },
      style: { fontFamily: 'Libre Franklin', fontSizePx: 42, fontWeight: 700, fontStyle: 'normal', color: '#373737', textAlign: 'center' },
    },
    ciudadFecha: {
      rel: { x: 0.125, y: 0.622, width: 0.75, height: 0.035 },
      style: { fontFamily: 'Libre Franklin', fontSizePx: 26, fontWeight: 700, fontStyle: 'italic', color: '#373737', textAlign: 'center' },
    },
    tipoParticipacion: {
      rel: { x: 0.15, y: 0.75, width: 0.70, height: 0.035 },
      style: { fontFamily: 'Libre Franklin', fontSizePx: 22, fontWeight: 600, fontStyle: 'normal', color: '#373737', textAlign: 'center' },
    },
    idValidacion: {
      rel: { x: 0.865, y: 0.93, width: 0.10, height: 0.03 },
      style: { fontFamily: 'Libre Franklin', fontSizePx: 18, fontWeight: 400, fontStyle: 'normal', color: '#373737', textAlign: 'center' },
    },
    // Párrafo opcional (events.certificateDescription): solo se dibuja si el evento lo tiene.
    descripcion: {
      rel: { x: 0.15, y: 0.50, width: 0.70, height: 0.10 },
      style: { fontFamily: 'Libre Franklin', fontSizePx: 22, fontWeight: 400, fontStyle: 'normal', color: '#373737', textAlign: 'center' },
    },
    qrValidacion: {
      rel: { x: 0.865, y: 0.78, width: 0.10, height: 0.141 },
    },
  },
};

/** Mezcla un layout.json subido con los defaults (asegura campos como 'ciudadFecha' aunque falten). */
export function mergeLayout(loaded) {
  if (!loaded) return DEFAULT_LAYOUT;
  return {
    ...DEFAULT_LAYOUT,
    ...loaded,
    elements: { ...DEFAULT_LAYOUT.elements, ...(loaded.elements || {}) },
  };
}

/** Rol del registro: 'participante' | 'ponente' | 'staff' (mismo criterio histórico de la Function). */
export { resolveRole } from './roles.js';

/** Texto de modalidad tal como viene en el registro ('Presencial', 'Virtual', …). */
export const resolveModality = (r) => (r.modalidad || r.tipoParticipacion || r.tipoAsistencia || '').toString();

/** Archivos de plantilla a probar, en orden, dentro de la carpeta (y luego en cert-templates/). */
export function templateCandidates(role, modalityLower) {
  if (role === 'ponente') return ['base-ponente.pdf', 'ponente.pdf', 'speaker.pdf', 'ponente-virtual.pdf'];
  if (role === 'staff') return ['base-staff.pdf', 'staff.pdf'];
  if (role === 'participante' && modalityLower === 'virtual') return ['base-virtual.pdf', 'virtual.pdf', 'base.pdf'];
  return ['base-volunt.pdf', 'base.pdf', 'participante.pdf'];
}

/** Normaliza el nombre de carpeta de plantillas; null si es inválido (evita '..'). */
export function normalizeTemplateSet(value) {
  if (!value) return null;
  let cleaned = String(value).trim().replace(/\\/g, '/');
  cleaned = cleaned.replace(/^\/+/, '').replace(/\/+$/, '');
  cleaned = cleaned.replace(/^cert-templates\//, '');
  if (!cleaned || cleaned.includes('..')) return null;
  return cleaned;
}

/** "Dado en la ciudad de Managua, a los N días del mes de M de AAAA". */
export function formatCiudadFecha(date) {
  const d = date || new Date();
  try {
    const day = new Intl.DateTimeFormat('es-NI', { day: 'numeric', timeZone: 'America/Managua' }).format(d);
    const month = new Intl.DateTimeFormat('es-NI', { month: 'long', timeZone: 'America/Managua' }).format(d);
    const year = new Intl.DateTimeFormat('es-NI', { year: 'numeric', timeZone: 'America/Managua' }).format(d);
    return `Dado en la ciudad de Managua, a los ${day} días del mes de ${month} de ${year}`;
  } catch {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `Dado en la ciudad de Managua, a los ${d.getDate()} días del mes de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  }
}

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
};

const parseWeight = (raw) => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const w = raw.trim().toLowerCase();
    if (w === 'bold' || w === 'bolder') return 700;
    if (w === 'normal' || w === 'regular') return 400;
    const parsed = Number(w);
    return Number.isFinite(parsed) ? parsed : 400;
  }
  return 400;
};

/**
 * Dibuja un certificado.
 * @param {object} opts
 * @param {Uint8Array|ArrayBuffer|null} opts.templateBytes PDF base; sin él se usa A4 horizontal en blanco.
 * @param {object} opts.layout layout ya mezclado con mergeLayout().
 * @param {{bold?, regular?, italic?, boldItalic?}} [opts.fonts] bytes TTF de Libre Franklin (opcionales).
 * @param {object} opts.data { nombreUsuario, nombreEvento, modalidad, rol, idValidacion, validationUrl, ciudadFecha, descripcion? }
 * @returns {Promise<Uint8Array>}
 */
export async function renderCertificate({ templateBytes, layout, fonts = {}, data }) {
  let pdfDoc;
  if (templateBytes) {
    pdfDoc = await PDFDocument.load(templateBytes);
  } else {
    // A4 landscape aprox (pts)
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([842, 595]);
  }
  // Registrar fontkit para permitir incrustar fuentes TTF personalizadas
  try { pdfDoc.registerFontkit(fontkit); } catch {}
  const page = pdfDoc.getPage(0);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  const tryEmbed = async (buf, key) => {
    try { if (buf) return await pdfDoc.embedFont(buf); } catch (e) { console.warn('Font embed failed', key, e?.message || e); }
    return null;
  };
  const fontMap = {};
  const boldFont = await tryEmbed(fonts.bold, 'LibreFranklin-Bold');
  const regularFont = await tryEmbed(fonts.regular, 'LibreFranklin-Regular');
  const italicFont = await tryEmbed(fonts.italic, 'LibreFranklin-Italic');
  const boldItalicFont = await tryEmbed(fonts.boldItalic, 'LibreFranklin-BoldItalic');
  if (boldFont) fontMap['Libre Franklin:bold'] = boldFont;
  if (regularFont) fontMap['Libre Franklin:normal'] = regularFont;
  if (italicFont) fontMap['Libre Franklin:italic'] = italicFont;
  if (boldItalicFont) fontMap['Libre Franklin:bolditalic'] = boldItalicFont;

  const { width: pageW, height: pageH } = page.getSize();
  const sx = pageW / (layout.canvas?.widthPx || 2000);

  const pickFont = (style) => {
    const fam = (style.fontFamily || '').trim().toLowerCase();
    const weight = parseWeight(style.fontWeight);
    const italic = (style.fontStyle || '').toLowerCase().includes('italic');
    if (fam.includes('libre franklin')) {
      if (italic && weight >= 700) {
        return fontMap['Libre Franklin:bolditalic'] || fontMap['Libre Franklin:italic'] || fontMap['Libre Franklin:bold'] || helveticaBoldOblique;
      }
      if (italic) return fontMap['Libre Franklin:italic'] || helveticaOblique;
      if (weight >= 700) return fontMap['Libre Franklin:bold'] || helveticaBold;
      return fontMap['Libre Franklin:normal'] || helvetica;
    }
    // Cualquier otra familia: aproximar con Helvetica variantes
    if (italic && weight >= 700) return helveticaBoldOblique;
    if (italic) return helveticaOblique;
    if (weight >= 700) return helveticaBold;
    return helvetica;
  };

  const drawTextBox = (text, boxRel, style) => {
    if (!text && text !== 0) return;
    const font = pickFont(style);
    const color = hexToRgb(style.color || '#000000');
    let fontSize = (style.fontSizePx || 20) * sx;
    let charSpacing = parseFloat(String(style.tracking || 0).replace('px', '')) * sx || 0;
    const toUpper = (style.transform || '').toLowerCase() === 'uppercase';
    const content = toUpper ? String(text).toUpperCase() : String(text);

    const x = (boxRel.x || 0) * pageW;
    const yTop = (boxRel.y || 0) * pageH;
    const w = (boxRel.width || 1) * pageW;
    const h = (boxRel.height || 0) * pageH;

    let textWidth = font.widthOfTextAtSize(content, fontSize) + charSpacing * (content.length - 1);
    // Auto-ajuste: un nombre largo se reduce para caber en una línea en vez de partirse fuera de la caja.
    const fit = style.autoFit !== false && textWidth > w && textWidth > 0;
    if (fit) {
      const scale = w / textWidth;
      fontSize *= scale;
      charSpacing *= scale;
      textWidth = w;
    }
    // pdf-lib usa bottom-left: convertir top-left a línea base, centrado vertical dentro de la caja
    const y = pageH - yTop - h + (h - fontSize) / 2;
    let drawX = x;
    const align = (style.textAlign || 'left').toLowerCase();
    if (align === 'center') drawX = x + (w - textWidth) / 2;
    else if (align === 'right') drawX = x + (w - textWidth);

    const opts = { x: drawX, y, size: fontSize, font, color, characterSpacing: charSpacing };
    if (!fit) opts.maxWidth = w; // igual que antes para el texto que ya cabía
    page.drawText(content, opts);
  };

  // Párrafo con ajuste de línea: reduce la letra (hasta 60%) hasta que todas las líneas quepan en la caja.
  const drawParagraph = (text, boxRel, style) => {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const font = pickFont(style);
    const color = hexToRgb(style.color || '#000000');
    const x = (boxRel.x || 0) * pageW;
    const w = (boxRel.width || 1) * pageW;
    const h = (boxRel.height || 0) * pageH;
    const base = (style.fontSizePx || 20) * sx;
    const wrap = (size) => words.reduce((lines, word) => {
      const last = lines[lines.length - 1];
      const candidate = last ? `${last} ${word}` : word;
      if (last && font.widthOfTextAtSize(candidate, size) > w) lines.push(word);
      else lines[lines.length - 1 || 0] = candidate;
      return lines;
    }, ['']);
    let size = base;
    let lines = wrap(size);
    while (lines.length * size * 1.25 > h && size > base * 0.6) { size *= 0.92; lines = wrap(size); }
    const lineH = size * 1.25;
    let y = pageH - (boxRel.y || 0) * pageH - (h - lines.length * lineH) / 2 - size;
    const align = (style.textAlign || 'left').toLowerCase();
    lines.forEach((line) => {
      const lw = font.widthOfTextAtSize(line, size);
      const lx = align === 'center' ? x + (w - lw) / 2 : align === 'right' ? x + w - lw : x;
      page.drawText(line, { x: lx, y, size, font, color });
      y -= lineH;
    });
  };

  const L = layout.elements || {};

  // QR primero (mismo orden que la versión original)
  const qrBox = L.qrValidacion?.rel;
  if (qrBox && data.validationUrl) {
    const qrWidth = Math.max(64, Math.round((qrBox.width || 0.1) * pageW));
    // toDataURL funciona en Node y en el navegador (toBuffer solo existe en Node); embedPng acepta data URI.
    const qrPng = await QRCode.toDataURL(data.validationUrl, { width: qrWidth });
    const qrImage = await pdfDoc.embedPng(qrPng);
    const w = (qrBox.width || 0.1) * pageW;
    const h = (qrBox.height || 0.1) * pageH;
    page.drawImage(qrImage, { x: (qrBox.x || 0) * pageW, y: pageH - (qrBox.y || 0) * pageH - h, width: w, height: h });
  }

  if (L.nombreUsuario?.rel) drawTextBox(data.nombreUsuario || '', L.nombreUsuario.rel, L.nombreUsuario.style || {});
  if (L.nombreEvento?.rel) drawTextBox(data.nombreEvento || '', L.nombreEvento.rel, L.nombreEvento.style || {});
  // Soportar 'modalidad' o 'tipoParticipacion' según el layout; solo para participantes
  const modalidadBox = L.modalidad || L.tipoParticipacion;
  if (modalidadBox?.rel && data.modalidad && data.rol === 'participante') {
    drawTextBox(data.modalidad, modalidadBox.rel, modalidadBox.style || {});
  }
  if (L.idValidacion?.rel) drawTextBox(`${data.idValidacion}`, L.idValidacion.rel, L.idValidacion.style || {});
  if (L.ciudadFecha?.rel) drawTextBox(data.ciudadFecha, L.ciudadFecha.rel, L.ciudadFecha.style || {});
  if (L.descripcion?.rel && data.descripcion) drawParagraph(data.descripcion, L.descripcion.rel, L.descripcion.style || {});

  return pdfDoc.save();
}
