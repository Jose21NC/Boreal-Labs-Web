// Rasteriza la 1.ª página de un PDF a imagen para el lienzo del editor y las miniaturas.
// pdfjs-dist (~1 MB + worker) se importa de forma dinámica: solo se descarga al abrir Plantillas,
// nunca en el sitio público. Un <iframe>/<object> no sirve aquí: el visor del navegador añade
// márgenes/zoom propios y no se pueden alinear las cajas arrastrables con la página.
let pdfjsPromise = null;
const loadPdfjs = () => {
  pdfjsPromise ||= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
};

/**
 * @param {Uint8Array} bytes
 * @param {number} targetWidth ancho en px de la imagen
 * @returns {Promise<{url: string, width: number, height: number}>} url = blob: (revocar al terminar); width/height en puntos PDF
 */
export async function renderFirstPage(bytes, targetWidth) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise; // copia: pdfjs transfiere el buffer al worker
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: targetWidth / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return { url: URL.createObjectURL(blob), width: base.width, height: base.height };
  } finally {
    doc.destroy();
  }
}
