// Modo de prueba: Cloud Functions simuladas sobre la base en memoria.
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { isPresent } from '@/admin/lib';

export const getFunctions = () => ({ type: 'functions' });

const handlers = {
  // Crea los docs de `certificados` igual que la Function real, pero sin PDF (urlPdf vacío).
  async generateCertificates({ eventName }) {
    const regs = await getDocs(query(collection({}, 'registrations'), where('eventName', '==', eventName)));
    const existing = await getDocs(query(collection({}, 'certificados'), where('nombreEvento', '==', eventName)));
    const done = new Set(existing.docs.map((d) => `${(d.get('correoUsuario') || '').toLowerCase()}|${d.get('tipo') || 'participante'}`));
    let created = 0;
    let skipped = 0;
    for (const r of regs.docs) {
      const data = r.data();
      const email = (data.userEmail || '').toLowerCase();
      const tipo = (data.tipo || 'participante').toLowerCase();
      if (!isPresent(data.statusAsistencia) || !email || done.has(`${email}|${tipo}`)) { skipped += 1; continue; }
      await addDoc(collection({}, 'certificados'), {
        correoUsuario: email,
        nombreUsuario: data.userName || '',
        nombreEvento: eventName,
        tipo,
        modalidad: data.tipoAsistencia || 'presencial',
        idValidacion: crypto.randomUUID(),
        fechaEmision: serverTimestamp(),
        urlPdf: '',
      });
      created += 1;
    }
    return { created, skipped, errors: [], pointsApplied: 0, pointsErrors: [] };
  },
  async mergeCertificatesPdf() {
    return { merged: false, reason: 'Modo de prueba: no hay PDFs reales para unir.' };
  },
};

export const httpsCallable = (_functions, name) => async (data) => {
  const handler = handlers[name];
  if (!handler) {
    const err = new Error(`[demo] Function no simulada: ${name}`);
    err.code = 'functions/not-found';
    throw err;
  }
  await new Promise((r) => setTimeout(r, 400));
  return { data: await handler(data || {}) };
};
