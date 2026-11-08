// Formulario público de /claude: nombre, correo, WhatsApp y comprobante de pago → subsRequests (se aprueba en /claude/admin).
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { CheckCircle2, UploadCloud } from 'lucide-react';
import { db, storage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  return (
    <div className="min-h-screen bg-boreal-dark px-4 pb-16 pt-24 text-white">
      <Helmet><title>Obtén la oferta</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="mx-auto max-w-lg rounded-2xl border border-white/15 bg-[#0f172acc] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-8">
        {done ? (
          <div className="py-6 text-center" role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-boreal-aqua" />
            <h1 className="mt-4 text-2xl font-extrabold">¡Listo! Estamos activando tu cuenta</h1>
            <p className="mt-3 text-white/75">En breve te llegará un correo con tus datos de acceso: un correo y una contraseña. Revisa también la carpeta de spam.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold">Obtén la oferta</h1>
              {offer?.price ? <p className="mt-1 text-white/75">C$ {offer.price} al mes.</p> : null}
              {offer?.paymentInstructions ? <p className="mt-3 whitespace-pre-line rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/80">{offer.paymentInstructions}</p> : null}
              <p className="mt-3 text-sm text-white/60">Realiza tu pago y envíanos la captura del comprobante.</p>
            </div>
            {honeypot}
            <div><Label htmlFor="of-name">Nombre y apellido</Label><Input id="of-name" autoComplete="name" value={f.name} onChange={set('name')} required /></div>
            <div><Label htmlFor="of-email">Correo electrónico</Label><Input id="of-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></div>
            <div><Label htmlFor="of-wa">Número de WhatsApp</Label><Input id="of-wa" type="tel" autoComplete="tel" placeholder="+505 8888 8888" value={f.whatsapp} onChange={set('whatsapp')} required /></div>
            <div>
              <Label htmlFor="of-proof">Captura del comprobante de pago</Label>
              <label htmlFor="of-proof" className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/25 bg-white/5 p-4 text-sm text-white/75 hover:border-boreal-aqua/60">
                <UploadCloud className="h-5 w-5 shrink-0 text-boreal-aqua" />
                <span className="truncate">{f.file ? f.file.name : 'Elige una imagen (JPG, PNG, WEBP)'}</span>
              </label>
              <input id="of-proof" type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(e) => setF((p) => ({ ...p, file: e.target.files?.[0] || null }))} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? 'Enviando…' : 'Enviar solicitud'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
