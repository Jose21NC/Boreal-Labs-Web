import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();

const isPresent = (value) => {
  if (typeof value === 'string') return value.toLowerCase() === 'presente' || value.toLowerCase() === 'present';
  return !!value;
};

export const generateCertificates = onCall({ cors: true, region: 'us-central1' }, async (request) => {
  const { eventName } = request.data || {};

  if (!eventName) throw new HttpsError('invalid-argument', 'Falta eventName');
  // Requerir autenticación de Firebase
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado');

  // Traer registros del evento
  const regsSnap = await db.collection('registrations').where('eventName', '==', eventName).get();
  const regs = regsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Traer certificados existentes de este evento para evitar duplicados por rol
  const certsSnap = await db.collection('certificados').where('nombreEvento', '==', eventName).get();
  const existingByEmailRole = new Set(
    certsSnap.docs.map((d) => {
      const email = (d.get('correoUsuario') || '').toLowerCase();
      // Algunos certificados antiguos no tenían 'tipo'; inferir: si modalidad es 'ponente' o 'staff' tomarlos como tal; de lo contrario, 'participante'
      const tipo = (d.get('tipo') || '').toLowerCase() || ((d.get('modalidad') || '').toLowerCase().match(/^(ponente|staff)$/)?.[0] || 'participante');
      return `${email}|${tipo}`;
    })
  );

  let created = 0;
  let skipped = 0;
  const errors = [];

  // Intentar obtener la fecha del evento desde la colección 'events'
  let eventDate = null;
  try {
    let eventDocSnap = null;
    const withId = regs.find((r) => r.eventId);
    if (withId?.eventId) {
      // Buscar por ID de evento del primer registro con eventId
      eventDocSnap = await db.collection('events').doc(withId.eventId).get();
    }
    if (!eventDocSnap || !eventDocSnap.exists) {
      // Fallback: buscar por título == eventName
      const evQuery = await db.collection('events').where('title', '==', eventName).limit(1).get();
      if (!evQuery.empty) eventDocSnap = evQuery.docs[0];
    }
    if (eventDocSnap && eventDocSnap.exists) {
      const ed = eventDocSnap.get('date');
      // Puede ser Timestamp, Date o string
      if (ed?.toDate) eventDate = ed.toDate();
      else if (typeof ed === 'string') eventDate = new Date(ed);
      else if (ed instanceof Date) eventDate = ed;
    }
  } catch (e) {
    console.warn('No se pudo leer fecha del evento', e?.message || e);
  }

  for (const r of regs) {
    if (!isPresent(r.statusAsistencia)) continue; // solo presentes
    const email = (r.userEmail || '').toLowerCase();
  if (!email) { skipped++; continue; }
  // Determinar rol del registro para comparar duplicados por rol
  const roleLower = (r.tipo || '').toLowerCase() || ((r.tipoAsistencia || '').toLowerCase().match(/^(ponente|staff|participante)$/)?.[0] || 'participante');
  if (existingByEmailRole.has(`${email}|${roleLower}`)) { skipped++; continue; }

    try {
      const idValidacion = (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`);

      // Helpers para layout
    const loadOptional = async (path) => {
      try {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        if (!exists) return null;
        const [buf] = await file.download();
        return buf;
      } catch {
        return null;
      }
    };

      const defaultLayout = {
      canvas: { widthPx: 2000, heightPx: 1414, orientation: 'landscape', paperHint: '≈ A4' },
      safeMarginPx: 35,
      elements: {
        nombreUsuario: {
          rel: { x: 0.10, y: 0.297, width: 0.80, height: 0.078 },
          style: { fontFamily: 'Libre Franklin', fontSizePx: 64, fontWeight: 800, fontStyle: 'normal', color: '#373737', textAlign: 'center', transform: 'uppercase', tracking: '0.5px' }
        },
        nombreEvento: {
          rel: { x: 0.15, y: 0.431, width: 0.70, height: 0.056 },
          style: { fontFamily: 'Libre Franklin', fontSizePx: 42, fontWeight: 700, fontStyle: 'normal', color: '#373737', textAlign: 'center' }
        },
        ciudadFecha: {
          rel: { x: 0.125, y: 0.622, width: 0.75, height: 0.035 },
          style: { fontFamily: 'Libre Franklin', fontSizePx: 26, fontWeight: 700, fontStyle: 'italic', color: '#373737', textAlign: 'center' }
        },
        tipoParticipacion: {
          rel: { x: 0.15, y: 0.75, width: 0.70, height: 0.035 },
          style: { fontFamily: 'Libre Franklin', fontSizePx: 22, fontWeight: 600, fontStyle: 'normal', color: '#373737', textAlign: 'center' }
        },
        idValidacion: {
            rel: { x: 0.865, y: 0.93, width: 0.10, height: 0.03 },
            style: { fontFamily: 'Libre Franklin', fontSizePx: 18, fontWeight: 400, fontStyle: 'normal', color: '#373737', textAlign: 'center' }
        },
        qrValidacion: {
            rel: { x: 0.865, y: 0.78, width: 0.10, height: 0.141 }
        }
      }
    };

      const layoutBuf = await loadOptional('cert-templates/layout.json');
      const loadedLayout = layoutBuf ? JSON.parse(layoutBuf.toString('utf8')) : null;
      // Mezclar con defaults para asegurar campos como 'ciudadFecha' aunque el JSON subido no los tenga
      const layout = loadedLayout
        ? {
            ...defaultLayout,
            ...loadedLayout,
            elements: {
              ...defaultLayout.elements,
              ...(loadedLayout.elements || {}),
            },
          }
        : defaultLayout;

    // 1) Generar PDF: usar plantilla si existe, sino lienzo vacío
  // Determinar rol (tipo) y modalidad por registro
  const roleLower = (r.tipo || '').toLowerCase() || ((r.tipoAsistencia || '').toLowerCase().match(/^(ponente|staff|participante)$/)?.[0] || 'participante');
  const modalityLower = (r.modalidad || r.tipoParticipacion || r.tipoAsistencia || '').toLowerCase();
  const isPonente = roleLower === 'ponente';
  const isStaff = roleLower === 'staff';
  const isParticipante = roleLower === 'participante';
  const isVirtualParticipant = isParticipante && modalityLower === 'virtual';
  const templatePath = isPonente
    ? 'cert-templates/base-ponente.pdf'
    : isStaff
    ? 'cert-templates/base-staff.pdf'
    : (isVirtualParticipant ? 'cert-templates/base-virtual.pdf' : 'cert-templates/base.pdf');
  const templateBuf = await loadOptional(templatePath);
      let pdfDoc;
      if (templateBuf) {
        pdfDoc = await PDFDocument.load(templateBuf);
      } else {
        // A4 landscape aprox (pts)
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([842, 595]);
      }
      // Registrar fontkit para permitir incrustar fuentes TTF personalizadas
      try { pdfDoc.registerFontkit(fontkit); } catch {}
      const page = pdfDoc.getPage(0);

    // Fuentes: tratar de cargar fuentes personalizadas
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  const ffBold = await loadOptional('cert-templates/fonts/LibreFranklin-Bold.ttf');
  const ffRegular = await loadOptional('cert-templates/fonts/LibreFranklin-Regular.ttf');
  const ffItalic = await loadOptional('cert-templates/fonts/LibreFranklin-Italic.ttf');
  const ffBoldItalic = await loadOptional('cert-templates/fonts/LibreFranklin-BoldItalic.ttf');
      const fontMap = {};
      const tryEmbed = async (buf, key) => {
        try { if (buf) return await pdfDoc.embedFont(buf); } catch (e) { console.warn('Font embed failed', key, e?.message || e); }
        return null;
      };
  const boldFont = await tryEmbed(ffBold, 'LibreFranklin-Bold');
  const regularFont = await tryEmbed(ffRegular, 'LibreFranklin-Regular');
  const italicFont = await tryEmbed(ffItalic, 'LibreFranklin-Italic');
  const boldItalicFont = await tryEmbed(ffBoldItalic, 'LibreFranklin-BoldItalic');
  if (boldFont) fontMap['Libre Franklin:bold'] = boldFont;
  if (regularFont) fontMap['Libre Franklin:normal'] = regularFont;
  if (italicFont) fontMap['Libre Franklin:italic'] = italicFont;
  if (boldItalicFont) fontMap['Libre Franklin:bolditalic'] = boldItalicFont;

      const { width: pageW, height: pageH } = page.getSize();

  const sx = pageW / (layout.canvas?.widthPx || 2000);
  const sy = pageH / (layout.canvas?.heightPx || 1414);

      const hexToRgb = (hex) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
      if (!m) return rgb(0, 0, 0);
      return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
    };

      const pickFont = (style) => {
        const fam = (style.fontFamily || '').trim().toLowerCase();
        let weightRaw = style.fontWeight;
        let weight;
        if (typeof weightRaw === 'number') weight = weightRaw;
        else if (typeof weightRaw === 'string') {
          const w = weightRaw.trim().toLowerCase();
          if (w === 'bold' || w === 'bolder') weight = 700;
          else if (w === 'normal' || w === 'regular') weight = 400;
          else {
            const parsed = Number(w);
            weight = Number.isFinite(parsed) ? parsed : 400;
          }
        } else {
          weight = 400;
        }
        const italic = (style.fontStyle || '').toLowerCase().includes('italic');

        const wantsLibre = fam.includes('libre franklin');
        if (wantsLibre) {
          if (italic && weight >= 700) {
            // Prefer exact BoldItalic if available
            if (fontMap['Libre Franklin:bolditalic']) return fontMap['Libre Franklin:bolditalic'];
            if (fontMap['Libre Franklin:italic']) return fontMap['Libre Franklin:italic'];
            if (fontMap['Libre Franklin:bold']) return fontMap['Libre Franklin:bold'];
            return helveticaBoldOblique;
          }
          if (italic) {
            if (fontMap['Libre Franklin:italic']) return fontMap['Libre Franklin:italic'];
            return helveticaOblique;
          }
          if (weight >= 700) {
            if (fontMap['Libre Franklin:bold']) return fontMap['Libre Franklin:bold'];
            return helveticaBold;
          }
          if (fontMap['Libre Franklin:normal']) return fontMap['Libre Franklin:normal'];
          return helvetica;
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
  // Usar escala horizontal para una medición de ancho más fiel
  const fontSize = (style.fontSizePx || 20) * sx;
  const charSpacing = parseFloat(String(style.tracking || 0).replace('px', '')) * sx || 0;
      const toUpper = (style.transform || '').toLowerCase() === 'uppercase';
      const content = toUpper ? String(text).toUpperCase() : String(text);

      const x = (boxRel.x || 0) * pageW;
      const yTop = (boxRel.y || 0) * pageH;
      const w = (boxRel.width || 1) * pageW;
      const h = (boxRel.height || 0) * pageH;
      // pdf-lib usa bottom-left, así que convertimos top-left a base-line approx
      const y = pageH - yTop - h + (h - fontSize) / 2; // centrado vertical dentro de la caja

      const textWidth = font.widthOfTextAtSize(content, fontSize) + charSpacing * (content.length - 1);
      let drawX = x;
      const align = (style.textAlign || 'left').toLowerCase();
      if (align === 'center') drawX = x + (w - textWidth) / 2;
      else if (align === 'right') drawX = x + (w - textWidth);

      page.drawText(content, { x: drawX, y, size: fontSize, font, color, characterSpacing: charSpacing, maxWidth: w });
    };

      // Fecha y ciudad (Managua) usando la fecha del evento
      const ciudadFechaText = (() => {
        const d = eventDate || new Date();
        try {
          const day = new Intl.DateTimeFormat('es-NI', { day: 'numeric', timeZone: 'America/Managua' }).format(d);
          const month = new Intl.DateTimeFormat('es-NI', { month: 'long', timeZone: 'America/Managua' }).format(d);
          const year = new Intl.DateTimeFormat('es-NI', { year: 'numeric', timeZone: 'America/Managua' }).format(d);
          return `Dado en la ciudad de Managua, a los ${day} días del mes de ${month} de ${year}`;
        } catch {
          const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
          return `Dado en la ciudad de Managua, a los ${d.getDate()} días del mes de ${months[d.getMonth()]} de ${d.getFullYear()}`;
        }
      })();

      // URL de validación y QR
      const base = process.env.VALIDATION_URL_BASE || 'https://borealabs.org/validacion?id=';
      const validationUrl = `${base}${encodeURIComponent(idValidacion)}`;
      const qrBox = layout.elements?.qrValidacion?.rel;
      if (qrBox) {
        const qrWidth = Math.max(64, Math.round((qrBox.width || 0.1) * pageW));
        const qrPng = await QRCode.toBuffer(validationUrl, { width: qrWidth });
        const qrImage = await pdfDoc.embedPng(qrPng);
        const x = (qrBox.x || 0) * pageW;
        const yTop = (qrBox.y || 0) * pageH;
        const w = (qrBox.width || 0.1) * pageW;
        const h = (qrBox.height || 0.1) * pageH;
        const y = pageH - yTop - h;
        page.drawImage(qrImage, { x, y, width: w, height: h });
      }

      // Campos de texto
    const L = layout.elements || {};
    if (L.nombreUsuario?.rel) drawTextBox(r.userName || '', L.nombreUsuario.rel, L.nombreUsuario.style || {});
  const eventTitleForThis = isPonente && r.customEventName ? r.customEventName : (r.eventName || eventName || '');
  if (L.nombreEvento?.rel) drawTextBox(eventTitleForThis, L.nombreEvento.rel, L.nombreEvento.style || {});
    // Soportar 'modalidad' o 'tipoParticipacion' según el layout (solo para participantes)
    const modalidadBox = L.modalidad || L.tipoParticipacion;
    const modalidadText = isParticipante ? (r.modalidad || r.tipoParticipacion || r.tipoAsistencia || '') : '';
    if (modalidadBox?.rel && modalidadText) drawTextBox(modalidadText, modalidadBox.rel, modalidadBox.style || {});
  if (L.idValidacion?.rel) drawTextBox(`${idValidacion}`, L.idValidacion.rel, L.idValidacion.style || {});
    if (L.ciudadFecha?.rel) drawTextBox(ciudadFechaText, L.ciudadFecha.rel, L.ciudadFecha.style || {});

      const pdfBytes = await pdfDoc.save();

      // 2) Subir a Storage y obtener URL pública de descarga
      const safeEvent = eventName.replace(/[^a-zA-Z0-9_-]+/g, '_');
      const path = `certificates/${safeEvent}/${idValidacion}.pdf`;
      const file = bucket.file(path);
      const token = (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
      await file.save(Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        metadata: { metadata: { firebaseStorageDownloadTokens: token } },
        public: false,
        resumable: false,
      });
      const encodedPath = encodeURIComponent(path);
      const urlPdf = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

      // 3) Crear documento en 'certificados'
      await db.collection('certificados').add({
        correoUsuario: r.userEmail || '',
        fechaEmision: FieldValue.serverTimestamp(),
        idValidacion,
        modalidad: modalidadText || '',
        tipo: roleLower,
        nombreEvento: eventTitleForThis || eventName,
        nombreUsuario: r.userName || '',
        urlPdf,
      });
      
  existingByEmailRole.add(`${email}|${roleLower}`);
      created++;
    } catch (err) {
      console.error('Error en certificado para', email, err?.message || err);
      errors.push({ email, message: err?.message || String(err) });
    }
  }

  return { created, skipped, errors };
});
