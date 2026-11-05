// /equipo/perfil/:token — un integrante completa o actualiza su perfil con un enlace único.
// Envía teamSubmissions/{token}; no se publica nada hasta que el aprobador lo revise en /admin/equipo/solicitudes.
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2, Clock, ImagePlus, Link2Off, Loader2, Trash2 } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import TeamMemberCard from '@/components/TeamMemberCard';
import { useFormGuard } from '@/lib/antiSpam';
import { normalizeSection, normalizeTag, resolveMemberImage } from '@/lib/team';
import {
  formToProfile, isFullUrl, isValidNameSurname, memberToForm, normalizeWhatsapp, safeFileName, validateImageFile,
} from '@/admin/sections/team/utils';

// El recorte reutiliza el del panel (react-easy-crop + Modal admin); solo se descarga al elegir foto.
const PhotoCropper = lazy(() => import('@/admin/sections/team/PhotoCropper'));
const MAX_UPLOAD_MB = 5; // storage.rules: team-pending < 5 MB

const inputCls = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-boreal-aqua focus:outline-none focus:ring-2 focus:ring-boreal-aqua/40';

function Field({ label, hint, error, children }) {
  return (
    <label className="block space-y-1.5 text-left">
      <span className="text-sm font-medium text-gray-200">{label}</span>
      {children}
      {error ? <span className="block text-xs text-red-400" role="alert">{error}</span> : hint ? <span className="block text-xs text-gray-400">{hint}</span> : null}
    </label>
  );
}

function Message({ icon: Icon, title, children, tone = 'text-boreal-aqua' }) {
  return (
    <div className="glass-effect mx-auto max-w-lg rounded-2xl p-8 text-center">
      <Icon className={`mx-auto mb-4 h-12 w-12 ${tone}`} aria-hidden="true" />
      <h1 className="mb-3 text-2xl font-bold text-white">{title}</h1>
      <div className="text-gray-300">{children}</div>
    </div>
  );
}

export default function TeamProfilePage() {
  const { token } = useParams();
  const { toast } = useToast();
  const { isBot, honeypot } = useFormGuard();
  const [state, setState] = useState('loading'); // loading | invalid | expired | form | sent | duplicate
  const [invite, setInvite] = useState(null);
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState(memberToForm());
  const [currentImage, setCurrentImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [cropSource, setCropSource] = useState(null);
  const [imageError, setImageError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!db) { setState('invalid'); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'teamInvites', token));
        if (!alive) return;
        if (!snap.exists()) { setState('invalid'); return; }
        const inv = snap.data();
        setInvite(inv);
        if (inv.active === false) { setState('invalid'); return; }
        if ((inv.expiresAt?.toMillis?.() || 0) < Date.now()) { setState('expired'); return; }
        if (inv.mode === 'edit' && inv.memberId) {
          const m = await getDoc(doc(db, 'teamMembers', inv.memberId));
          if (!alive) return;
          if (!m.exists()) { setState('invalid'); return; }
          const data = m.data();
          setOriginal(data);
          setForm(memberToForm(data));
          setCurrentImage(await resolveMemberImage(data));
        }
        if (alive) setState('form');
      } catch (error) {
        console.error('Error cargando invitación:', error);
        if (alive) setState('invalid');
      }
    })();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  useEffect(() => () => { if (cropSource?.url) URL.revokeObjectURL(cropSource.url); }, [cropSource]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const profile = useMemo(() => formToProfile(form), [form]);
  const whatsappError = normalizeWhatsapp(form.whatsappInput).error;
  const nameChanged = !original || form.name.trim() !== String(original.name || '').trim();
  const nameError = form.name.trim() && nameChanged && !isValidNameSurname(form.name) ? 'Escribe solo un nombre y un apellido.' : '';
  const externalError = form.externalUrl.trim() && !isFullUrl(form.externalUrl) ? 'Debe empezar con http:// o https://.' : '';
  const photoUrl = imageFile ? imagePreview : currentImage;
  const tag = invite ? normalizeTag(invite) : '';

  const onPickImage = (e) => {
    setImageError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { setImageError(error); return; }
    setCropSource({ file, url: URL.createObjectURL(file) });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!profile.name || !profile.role || !profile.description) {
      toast({ title: 'Faltan datos', description: 'Nombre, cargo y descripción son obligatorios.', variant: 'destructive' });
      return;
    }
    if (nameError || whatsappError || externalError) {
      toast({ title: 'Revisa el formulario', description: nameError || whatsappError || externalError, variant: 'destructive' });
      return;
    }
    if (isBot()) {
      toast({ title: 'Espera un momento', description: 'Revisa tus datos e intenta enviar de nuevo en unos segundos.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let imageUrl = typeof currentImage === 'string' ? currentImage : null;
      let imagePath = null;
      if (imageFile) {
        imagePath = `team-pending/${token}/${Date.now()}-${safeFileName(imageFile.name)}`;
        const fileRef = storageRef(storage, imagePath);
        await uploadBytes(fileRef, imageFile, { contentType: imageFile.type });
        imageUrl = await getDownloadURL(fileRef);
      }
      // firestore.rules exige string en los campos opcionales: los vacíos se omiten en lugar de enviarse como null.
      const optional = Object.fromEntries(Object.entries({ ...profile, imageUrl, imagePath }).filter(([, v]) => v));
      await setDoc(doc(db, 'teamSubmissions', token), {
        ...optional,
        mode: invite.mode,
        ...(invite.mode === 'edit' ? { memberId: invite.memberId } : {}),
        teamSection: invite.teamSection,
        teamTag: invite.teamTag,
        status: 'pending',
        submittedAt: serverTimestamp(),
      });
      setState('sent');
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error enviando perfil:', error);
      // Un create sobre una solicitud existente es un update, que las reglas niegan.
      if (error?.code === 'permission-denied') { setState('duplicate'); window.scrollTo(0, 0); }
      else toast({ title: 'No se pudo enviar', description: 'Intenta nuevamente en unos minutos.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  let content;
  if (state === 'loading') {
    content = <div className="flex justify-center text-boreal-aqua"><Loader2 className="h-10 w-10 animate-spin" aria-label="Cargando" /></div>;
  } else if (state === 'invalid') {
    content = <Message icon={Link2Off} title="Enlace no válido" tone="text-red-400">Este enlace no existe o fue desactivado. Pide uno nuevo al equipo de Boreal Labs.</Message>;
  } else if (state === 'expired') {
    content = <Message icon={Clock} title="Enlace vencido" tone="text-amber-400">Este enlace ya venció. Pide uno nuevo al equipo de Boreal Labs.</Message>;
  } else if (state === 'duplicate') {
    content = <Message icon={Clock} title="Ya enviaste tu perfil">Ya enviaste tu perfil; está pendiente de aprobación.</Message>;
  } else if (state === 'sent') {
    content = (
      <Message icon={CheckCircle2} title="¡Perfil enviado!" tone="text-green-400">
        El equipo de Boreal Labs lo revisará antes de publicarlo en <span className="text-white">/equipo</span>. No necesitas hacer nada más.
      </Message>
    );
  } else {
    content = (
      <form onSubmit={onSubmit} className="relative grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]" noValidate>
        {honeypot}
        <div className="glass-effect space-y-5 rounded-2xl p-6 md:p-8">
          <div className="text-left">
            <h1 className="text-gradient mb-2 text-3xl font-bold">{invite.mode === 'edit' ? 'Actualiza tu perfil' : 'Completa tu perfil'}</h1>
            <p className="text-sm text-gray-400">Se publicará en la página del equipo cuando lo aprobemos.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-gray-300">
            <span className="rounded-full border border-white/15 px-3 py-1">{normalizeSection(invite) === 'DIRECTIVA' ? 'Directiva' : 'Staff'}</span>
            <span className="rounded-full border border-white/15 px-3 py-1">{tag}</span>
            <span className="self-center text-xs text-gray-500">asignado por el equipo</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellido *" error={nameError}>
              <input className={inputCls} value={form.name} onChange={set('name')} maxLength={120} placeholder="Ana Pérez" autoComplete="name" required />
            </Field>
            <Field label="Cargo *">
              <input className={inputCls} value={form.role} onChange={set('role')} maxLength={120} placeholder="Coordinadora de Finanzas" required />
            </Field>
          </div>
          <Field label="Descripción *" hint={`${form.description.length}/1200`}>
            <textarea className={inputCls} rows={4} value={form.description} onChange={set('description')} maxLength={1200} placeholder="Cuéntanos brevemente quién eres y qué aportas al equipo." required />
          </Field>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-xs text-gray-400">
              {photoUrl ? <img src={photoUrl} alt="Foto seleccionada" className="h-full w-full object-cover" /> : 'Sin foto'}
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPickImage} aria-label="Elegir foto de perfil" />
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
              <ImagePlus className="h-4 w-4" />{photoUrl ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {photoUrl && (
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); setCurrentImage(null); }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />Quitar
              </button>
            )}
            {imageError && <p className="w-full text-xs text-red-400" role="alert">{imageError}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input className={inputCls} type="email" value={form.email} onChange={set('email')} maxLength={200} placeholder="ana@ejemplo.com" autoComplete="email" />
            </Field>
            <Field label="WhatsApp" error={whatsappError} hint="8 dígitos; se agrega el prefijo 505.">
              <input className={inputCls} value={form.whatsappInput} onChange={set('whatsappInput')} maxLength={500} placeholder="12345678" inputMode="tel" />
            </Field>
            <Field label="Instagram" hint={profile.instagramUrl || 'usuario o enlace'}>
              <input className={inputCls} value={form.instagramInput} onChange={set('instagramInput')} maxLength={500} placeholder="@usuario" />
            </Field>
            <Field label="LinkedIn" hint={profile.linkedinUrl || 'usuario o enlace'}>
              <input className={inputCls} value={form.linkedinInput} onChange={set('linkedinInput')} maxLength={500} placeholder="usuario" />
            </Field>
          </div>
          <Field label="Enlace externo" error={externalError} hint="Portafolio o sitio personal (http/https).">
            <input className={inputCls} type="url" value={form.externalUrl} onChange={set('externalUrl')} maxLength={500} placeholder="https://…" />
          </Field>

          <button type="submit" disabled={saving || !!cropSource} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-boreal-blue to-boreal-purple px-6 py-3 font-semibold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}Enviar para revisión
          </button>
        </div>

        <div className="lg:sticky lg:top-28">
          <p className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Vista previa</p>
          <TeamMemberCard member={{
            ...profile,
            name: profile.name || 'Nombre Apellido',
            role: profile.role || 'Cargo',
            description: profile.description || 'Tu descripción aparecerá aquí.',
            memberTag: tag,
            resolvedImageUrl: photoUrl || null,
          }}
          />
        </div>
      </form>
    );
  }

  return (
    <>
      <Helmet>
        <title>Perfil del equipo - Boreal Labs</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-boreal-dark px-4 pb-20 pt-32 sm:px-6">
        <div className="mx-auto max-w-5xl">{content}</div>
      </div>
      {cropSource && (
        // PhotoCropper usa el kit del panel: necesita los tokens adm-* de .admin-root.
        <div className="admin-root">
          <Suspense fallback={null}>
            <PhotoCropper
              source={cropSource}
              onCancel={() => setCropSource(null)}
              onError={(msg) => { setImageError(msg); setCropSource(null); }}
              onDone={(file) => {
                if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setImageError(`La foto supera ${MAX_UPLOAD_MB} MB.`); setCropSource(null); return; }
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
                setCropSource(null);
              }}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
