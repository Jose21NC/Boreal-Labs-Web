// Formulario público de /claude: nombre, correo, WhatsApp y comprobante de pago → subsRequests (se aprueba en /claude/admin).
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { CheckCircle2, UploadCloud } from 'lucide-react';
import { db, storage } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { compressImageFile } from '@/lib/image';
import { EMAIL_RE, useFormGuard } from '@/lib/antiSpam';

export default function OfferPage() {
  const { toast } = useToast();
  const { isBot, honeypot } = useFormGuard();
  const [offer, setOffer] = useState(null);
  const [f, setF] = useState({ name: '', email: '', whatsapp: '', file: null });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { if (db) getDoc(doc(db, 'subsConfig', 'public')).then((s) => setOffer(s.data() || null)).catch(() => {}); }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const preview = useMemo(() => (f.file ? URL.createObjectURL(f.file) : null), [f.file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const submit = async (e) => {
    e.preventDefault();
    if (isBot()) { setDone(true); return; }
    const email = f.email.trim().toLowerCase();
    if (!f.name.trim() || !EMAIL_RE.test(email) || !f.whatsapp.trim() || !f.file) {
      toast({ title: 'Completa todos los campos', description: 'Nombre, correo válido, WhatsApp y la captura del comprobante.', variant: 'destructive' });
      return;
    }
    if (!db || !storage) { toast({ title: 'No disponible', description: 'Intenta más tarde.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const file = await compressImageFile(f.file);
      const path = `subs-proofs/${Date.now()}-${file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const proofUrl = await getDownloadURL(fileRef);
      await addDoc(collection(db, 'subsRequests'), {
        name: f.name.trim().slice(0, 200), email, whatsapp: f.whatsapp.trim().slice(0, 50), proofUrl, proofPath: path, status: 'pendiente', createdAt: serverTimestamp(),
      });
      setDone(true);
    } catch (err) {
      toast({ title: 'No se pudo enviar', description: 'Revisa que la captura sea una imagen de menos de 5 MB e intenta de nuevo.', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const field = 'mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100';
  const label = 'text-sm font-semibold text-slate-700';
  const price = offer?.price || 300;
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-white to-sky-100 px-4 pb-16 pt-10 text-slate-900">
      <Helmet><title>Obtén la oferta · Boreal Labs</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="relative mx-auto max-w-lg">
        <img src="/logoBoreal.svg" alt="Boreal Labs" className="mx-auto h-10 w-auto invert hue-rotate-180" />
        <div className="mt-8 rounded-3xl border border-sky-200 bg-white/80 p-6 shadow-[0_30px_80px_-20px_rgba(14,165,233,0.35)] backdrop-blur sm:p-8">
          {done ? (
            <div className="py-8 text-center" role="status">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100"><CheckCircle2 className="h-9 w-9 text-sky-500" /></div>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight">¡Listo! Estamos activando tu cuenta</h1>
              <p className="mt-3 text-slate-600">En breve te llegará un correo con tus datos de acceso: un correo y una contraseña. Revisa también la carpeta de spam.</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5">
              <div className="text-center">
                <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-600">Oferta mensual</span>
                <div className="mx-auto mt-4 rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-white to-sky-50 px-6 py-5">
                  <p className="text-6xl font-black tracking-tight text-slate-800 sm:text-7xl">C${price}</p>
                  <p className="text-2xl font-bold text-sky-500">al mes</p>
                </div>
              </div>
              {offer?.paymentInstructions ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                  <p className="mb-1 font-semibold text-slate-800">1. Realiza tu pago</p>
                  <p className="whitespace-pre-line">{offer.paymentInstructions}</p>
                </div>
              ) : null}
              <p className="text-sm font-semibold text-slate-800">{offer?.paymentInstructions ? '2. ' : ''}Envíanos tus datos y la captura del comprobante</p>
              {honeypot}
              <div><label htmlFor="of-name" className={label}>Nombre y apellido</label><input id="of-name" className={field} autoComplete="name" value={f.name} onChange={set('name')} required /></div>
              <div><label htmlFor="of-email" className={label}>Correo electrónico</label><input id="of-email" type="email" className={field} autoComplete="email" value={f.email} onChange={set('email')} required /></div>
              <div><label htmlFor="of-wa" className={label}>Número de WhatsApp</label><input id="of-wa" type="tel" className={field} autoComplete="tel" placeholder="+505 8888 8888" value={f.whatsapp} onChange={set('whatsapp')} required /></div>
              <div>
                <span className={label}>Captura del comprobante de pago</span>
                <label htmlFor="of-proof" className={`mt-1.5 flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition ${f.file ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-white hover:border-sky-400 hover:bg-sky-50'}`}>
                  {preview ? <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-sky-100"><UploadCloud className="h-7 w-7 text-sky-500" /></span>}
                  <span className="min-w-0 text-sm"><span className="block truncate font-semibold text-slate-800">{f.file ? f.file.name : 'Toca para subir la imagen'}</span><span className="text-slate-500">JPG, PNG o WEBP · máx. 5 MB</span></span>
                </label>
                <input id="of-proof" type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(e) => setF((p) => ({ ...p, file: e.target.files?.[0] || null }))} />
              </div>
              <button type="submit" disabled={busy} className="h-14 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-lg font-bold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-[.99] disabled:opacity-60">{busy ? 'Enviando…' : 'Quiero mi acceso'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
