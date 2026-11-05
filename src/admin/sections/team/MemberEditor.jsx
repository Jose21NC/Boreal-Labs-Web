// Crear / editar integrante con previsualización en vivo de la tarjeta pública.
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import TeamMemberCard from '@/components/TeamMemberCard';
import { TEAM_TAG_OPTIONS, normalizeSection, normalizeTag, resolveMemberImage } from '@/lib/team';
import { Button, Card, CardBody, CardHeader, Field, Input, PageHeader, Select, Skeleton, Textarea, useConfirm } from '@/admin/ui';
import { formatDateTime, logActivity } from '@/admin/lib';
import {
  MAX_IMAGE_SIZE_MB, cleanString, isFullUrl, isValidNameSurname, memberToForm, normalizeInstagram,
  normalizeLinkedin, normalizeWhatsapp, safeFileName, validateImageFile,
} from './utils';

// react-easy-crop solo se descarga al elegir una foto.
const PhotoCropper = lazy(() => import('./PhotoCropper'));

export default function MemberEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(!isNew);
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState(memberToForm());
  const [currentImage, setCurrentImage] = useState(null); // URL ya publicada
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [cropSource, setCropSource] = useState(null);
  const [imageError, setImageError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    if (isNew || !db) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'teamMembers', id));
        if (!alive) return;
        if (!snap.exists()) {
          toast({ title: 'Integrante no encontrado', variant: 'destructive' });
          navigate('/admin/equipo', { replace: true });
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        const member = { ...data, memberSection: normalizeSection(data), memberTag: normalizeTag(data) };
        setOriginal(member);
        setForm(memberToForm(member));
        setCurrentImage(await resolveMemberImage(member));
      } catch (error) {
        console.error('Error cargando integrante:', error);
        toast({ title: 'No se pudo cargar el integrante', variant: 'destructive' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, isNew, navigate, toast]);

  // Libera blob: URLs al cambiar o desmontar.
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  useEffect(() => () => { if (cropSource?.url) URL.revokeObjectURL(cropSource.url); }, [cropSource]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const whatsapp = useMemo(() => normalizeWhatsapp(form.whatsappInput), [form.whatsappInput]);
  const instagramUrl = useMemo(() => normalizeInstagram(form.instagramInput), [form.instagramInput]);
  const linkedinUrl = useMemo(() => normalizeLinkedin(form.linkedinInput), [form.linkedinInput]);

  // Exigir "nombre apellido" solo si el nombre cambió: no bloquear la edición de registros antiguos.
  const nameChanged = !original || form.name.trim() !== String(original.name || '').trim();
  const nameError = form.name.trim() && nameChanged && !isValidNameSurname(form.name) ? 'Debe tener exactamente 2 palabras: nombre y apellido.' : '';
  const externalError = form.externalUrl.trim() && !isFullUrl(form.externalUrl) ? 'Debe empezar con http:// o https://.' : '';

  const photoUrl = imageFile ? imagePreview : currentImage;
  const preview = {
    name: form.name || 'Nombre Apellido',
    role: form.role || 'Cargo',
    description: form.description || 'Descripción del integrante del equipo.',
    memberTag: form.teamTag,
    email: cleanString(form.email),
    resolvedImageUrl: photoUrl || null,
    linkedinUrl,
    instagramUrl,
    whatsappUrl: whatsapp.url,
    externalUrl: cleanString(form.externalUrl),
  };

  const onPickImage = (e) => {
    setImageError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { setImageError(error); return; }
    setCropSource({ file, url: URL.createObjectURL(file) });
  };

  const removePhoto = () => {
    setImageFile(null);
    setImagePreview('');
    setCurrentImage(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.role.trim() || !form.description.trim()) {
      toast({ title: 'Faltan datos', description: 'Nombre, cargo y descripción son obligatorios.', variant: 'destructive' });
      return;
    }
    if (nameError || whatsapp.error || externalError) {
      toast({ title: 'Revisa el formulario', description: nameError || whatsapp.error || externalError, variant: 'destructive' });
      return;
    }
    if (!db) {
      toast({ title: 'Firebase no está configurado', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let imageUrl = currentImage || null;
      if (imageFile) {
        const fileRef = storageRef(storage, `team-members/${Date.now()}-${safeFileName(imageFile.name)}`);
        await uploadBytes(fileRef, imageFile, { contentType: imageFile.type });
        imageUrl = await getDownloadURL(fileRef);
      } else if (original && currentImage && typeof original.imageUrl !== 'string') {
        imageUrl = original.imageUrl; // conservar el formato heredado ({ref} / array) si no se cambió la foto
      }
      const actor = auth?.currentUser?.email || null;
      const payload = {
        name: form.name.trim(),
        role: form.role.trim(),
        description: form.description.trim(),
        teamSection: form.teamSection,
        teamTag: form.teamTag,
        email: cleanString(form.email),
        imageUrl,
        linkedinUrl,
        instagramUrl,
        whatsappUrl: whatsapp.url,
        externalUrl: cleanString(form.externalUrl),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      };
      if (isNew) {
        const ref = await addDoc(collection(db, 'teamMembers'), { ...payload, createdAt: serverTimestamp(), createdBy: actor });
        logActivity('equipo.agregado', `Agregó a ${payload.name} al equipo (${payload.teamTag})`, { id: ref.id });
        toast({ title: 'Integrante agregado', description: `${payload.name} ya aparece en /equipo.` });
      } else {
        await updateDoc(doc(db, 'teamMembers', id), payload);
        logActivity('equipo.editado', `Editó el perfil de ${payload.name}`, { id });
        toast({ title: 'Cambios guardados' });
      }
      navigate('/admin/equipo');
    } catch (error) {
      console.error('Error al guardar integrante:', error);
      toast({ title: 'No se pudo guardar', description: 'Intenta nuevamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    const dirty = imageFile || JSON.stringify(form) !== JSON.stringify(memberToForm(original || undefined));
    if (dirty && !(await confirm({ title: '¿Descartar cambios?', description: 'Los cambios sin guardar se perderán.', confirmLabel: 'Descartar', tone: 'danger' }))) return;
    navigate('/admin/equipo');
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Skeleton className="h-[600px]" /><Skeleton className="h-96" /></div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title={isNew ? 'Nuevo integrante' : `Editar a ${original?.name || ''}`}
        description={original?.updatedAt
          ? `Última edición ${formatDateTime(original.updatedAt)}${original.updatedBy ? ` por ${original.updatedBy}` : ''}.`
          : 'Los cambios se publican en /equipo al guardar.'}
        actions={(
          <>
            <Button variant="ghost" onClick={cancel}><ArrowLeft className="h-4 w-4" />Volver</Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!!cropSource}>
              {isNew ? 'Agregar integrante' : 'Guardar cambios'}
            </Button>
          </>
        )}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Datos básicos" description="Tal como se mostrarán en la página pública." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre completo *" hint="Solo un nombre y un apellido." error={nameError}>
                <Input value={form.name} onChange={set('name')} placeholder="Ana Pérez" required autoComplete="off" />
              </Field>
              <Field label="Cargo *">
                <Input value={form.role} onChange={set('role')} placeholder="Coordinadora de Finanzas" required />
              </Field>
              <Field label="Grupo *">
                <Select value={form.teamSection} onChange={set('teamSection')}>
                  <option value="DIRECTIVA">Directiva</option>
                  <option value="STAFF">Staff</option>
                </Select>
              </Field>
              <Field label="Etiqueta *">
                <Select value={form.teamTag} onChange={set('teamTag')}>
                  {[...new Set([...TEAM_TAG_OPTIONS, form.teamTag])].map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                </Select>
              </Field>
              <Field label="Descripción *" className="sm:col-span-2" hint={`${form.description.length} caracteres`}>
                <Textarea rows={4} value={form.description} onChange={set('description')} placeholder="Breve descripción del perfil y su aporte al equipo." required />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Foto de perfil" description={`JPG, PNG o WEBP de hasta ${MAX_IMAGE_SIZE_MB} MB. Se recorta en círculo antes de guardar.`} />
            <CardBody className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-adm-border bg-adm-surface-2 text-xs text-adm-muted">
                {photoUrl ? <img src={photoUrl} alt="Foto seleccionada" className="h-full w-full object-cover" /> : 'Sin foto'}
              </div>
              <div className="flex flex-wrap gap-2">
                <input ref={fileInput} type="file" accept={'image/jpeg,image/png,image/webp'} className="sr-only" onChange={onPickImage} aria-label="Elegir foto de perfil" />
                <Button onClick={() => fileInput.current?.click()}><ImagePlus className="h-4 w-4" />{photoUrl ? 'Cambiar foto' : 'Subir foto'}</Button>
                {photoUrl && <Button variant="danger-ghost" onClick={removePhoto}><Trash2 className="h-4 w-4" />Quitar</Button>}
              </div>
              {imageError && <p className="w-full text-xs text-adm-danger" role="alert">{imageError}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contacto y redes" description="Opcional. Escribe el usuario o pega la URL; se completa el enlace." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <Input type="email" value={form.email} onChange={set('email')} placeholder="ana@borealabs.org" />
              </Field>
              <Field label="WhatsApp" error={whatsapp.error} hint={whatsapp.url || '8 dígitos locales; se agrega el prefijo 505.'}>
                <Input value={form.whatsappInput} onChange={set('whatsappInput')} placeholder="12345678 o https://wa.me/…" inputMode="tel" />
              </Field>
              <Field label="Instagram" hint={instagramUrl || 'usuario o https://instagram.com/usuario'}>
                <Input value={form.instagramInput} onChange={set('instagramInput')} placeholder="@usuario" />
              </Field>
              <Field label="LinkedIn" hint={linkedinUrl || 'usuario o https://linkedin.com/in/usuario'}>
                <Input value={form.linkedinInput} onChange={set('linkedinInput')} placeholder="usuario" />
              </Field>
              <Field label="Enlace externo" className="sm:col-span-2" error={externalError} hint="Portafolio o sitio personal. Solo http(s).">
                <Input type="url" value={form.externalUrl} onChange={set('externalUrl')} placeholder="https://…" />
              </Field>
            </CardBody>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-adm-muted">Vista previa en /equipo</p>
          {/* La página pública siempre es oscura: el fondo replica ese contexto. */}
          <div className="rounded-2xl bg-boreal-dark p-4 text-white">
            <TeamMemberCard member={preview} />
          </div>
          <p className="mt-2 text-xs text-adm-muted">Sección: {form.teamSection === 'DIRECTIVA' ? 'Directiva' : 'Staff'}</p>
        </div>
      </div>

      {cropSource && (
      <Suspense fallback={null}>
      <PhotoCropper
        source={cropSource}
        onCancel={() => setCropSource(null)}
        onError={(msg) => { setImageError(msg); setCropSource(null); }}
        onDone={(file) => {
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
          setCropSource(null);
        }}
      />
      </Suspense>
      )}
    </form>
  );
}

