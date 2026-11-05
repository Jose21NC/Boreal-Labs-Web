// Modo de prueba: genera plantillas PDF de ejemplo (A4 horizontal) alineadas con DEFAULT_LAYOUT,
// para que el editor y la generación de certificados se puedan probar de punta a punta.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const NAVY = rgb(0.12, 0.16, 0.29);
const GOLD = rgb(0.78, 0.62, 0.27);
const GREY = rgb(0.45, 0.47, 0.52);

async function buildTemplate({ subtitle, lead, body }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]);
  const { width: W, height: H } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const top = (rel) => H - rel * H; // y relativo desde arriba → coordenada PDF
  const center = (text, font, size, relY, color = NAVY) =>
    page.drawText(text, { x: (W - font.widthOfTextAtSize(text, size)) / 2, y: top(relY), size, font, color });

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.99, 0.98, 0.96) });
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: NAVY, borderWidth: 3 });
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: GOLD, borderWidth: 1 });
  page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: NAVY });

  center('BOREAL LABS', bold, 12, 0.09, GOLD);
  center('CERTIFICADO', bold, 40, 0.17);
  center(subtitle, regular, 14, 0.215, GREY);
  center(lead, regular, 13, 0.27, GREY);
  page.drawLine({ start: { x: W * 0.2, y: top(0.385) }, end: { x: W * 0.8, y: top(0.385) }, thickness: 0.8, color: GOLD });
  center(body, regular, 13, 0.415, GREY);

  [0.2, 0.5].forEach((relX, i) => {
    const x = W * relX;
    page.drawLine({ start: { x, y: top(0.84) }, end: { x: x + W * 0.22, y: top(0.84) }, thickness: 0.8, color: NAVY });
    const label = i === 0 ? 'Dirección General' : 'Coordinación Académica';
    page.drawText(label, { x: x + (W * 0.22 - regular.widthOfTextAtSize(label, 10)) / 2, y: top(0.87), size: 10, font: regular, color: GREY });
  });
  page.drawText('Valida este certificado', { x: W * 0.84, y: top(0.765), size: 7, font: regular, color: GREY });
  return doc.save();
}

/** { 'cert-templates/...': Uint8Array } */
export async function demoTemplateFiles() {
  const participante = await buildTemplate({ subtitle: 'DE PARTICIPACIÓN', lead: 'Se otorga el presente certificado a', body: 'por su participación en' });
  const virtual = await buildTemplate({ subtitle: 'DE PARTICIPACIÓN VIRTUAL', lead: 'Se otorga el presente certificado a', body: 'por su participación en línea en' });
  const ponente = await buildTemplate({ subtitle: 'DE RECONOCIMIENTO', lead: 'Se reconoce a', body: 'por compartir su conocimiento como ponente en' });
  const voluntariado = await buildTemplate({ subtitle: 'DE VOLUNTARIADO', lead: 'Se agradece a', body: 'por su servicio voluntario en' });
  return {
    'cert-templates/base.pdf': participante,
    'cert-templates/BASE UAM - DIEM/base.pdf': participante,
    'cert-templates/BASE UAM - DIEM/base-virtual.pdf': virtual,
    'cert-templates/BASE UAM - DIEM/base-ponente.pdf': ponente,
    'cert-templates/VOLUNTARIADO/base.pdf': voluntariado,
  };
}
