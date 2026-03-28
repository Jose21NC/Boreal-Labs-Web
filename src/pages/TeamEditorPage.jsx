import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Linkedin, Mail, Instagram, Smartphone, Link as LinkIcon } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db, storage } from '@/firebase.jsx';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

const ACCESS_CODE_ENABLED = true;
const TEAM_EDITOR_ACCESS_CODE = 'Staff_BOREAL2026*';
const ACCESS_SESSION_KEY = 'team_editor_unlocked';
const MAX_IMAGE_SIZE_MB = 8;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const TEAM_TAG_OPTIONS = [
  'Directiva General',
  'Operaciones',
  'Finanzas',
  'Redes',
  'Voluntariado',
  'Secretaria General',
  'Relaciones Institucionales',
];

const TAG_STYLES = {
  'Directiva General': 'border-sky-400/50 bg-sky-500/15 text-sky-200',
  Operaciones: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200',
  Finanzas: 'border-lime-400/50 bg-lime-500/15 text-lime-200',
  Redes: 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200',
  Voluntariado: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
  'Secretaria General': 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200',
  'Relaciones Institucionales': 'border-rose-400/50 bg-rose-500/15 text-rose-200',
};

const isFullUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const sanitizeUsername = (value) => String(value || '').trim().replace(/^@+/, '');

const normalizeWhatsapp = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return { url: null, error: '' };
  }
  if (isFullUrl(raw)) {
    return { url: raw, error: '' };
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return { url: null, error: '' };
  }
  if (digits.length !== 8) {
    return { url: null, error: 'El numero de WhatsApp debe tener exactamente 8 digitos.' };
  }

  return { url: `https://wa.me/505${digits}`, error: '' };
};

const normalizeInstagram = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (isFullUrl(raw)) return raw;

  const withoutDomain = raw.replace(/^instagram\.com\//i, '');
  const username = sanitizeUsername(withoutDomain).split('/')[0];
  if (!username) return null;
  return `https://instagram.com/${username}`;
};

const normalizeLinkedin = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (isFullUrl(raw)) return raw;

  const withoutDomain = raw.replace(/^linkedin\.com\//i, '');
  const normalized = withoutDomain.replace(/^in\//i, '').replace(/^@+/, '').split('/')[0];
  if (!normalized) return null;
  return `https://linkedin.com/in/${normalized}`;
};

const cleanString = (value) => {
  const out = String(value || '').trim();
  return out.length > 0 ? out : null;
};

const isValidNameSurname = (value) => {
  const tokens = String(value || '').trim().split(/\s+/).filter(Boolean);
  return tokens.length === 2;
};

const initialsFromName = (value) => {
  const tokens = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'BL';
  if (tokens.length === 1) return tokens[0][0]?.toUpperCase() || 'BL';
  return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase();
};

const validateImageFile = (file) => {
  if (!file) return 'No se selecciono ningun archivo.';
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Formato no compatible. Usa JPG, PNG o WEBP.';
  }
  const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `La imagen supera ${MAX_IMAGE_SIZE_MB}MB.`;
  }
  return '';
};

const getCroppedFileFromPixels = async (imageSrc, pixelCrop, originalName) => {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el editor de imagen.');
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) {
    throw new Error('No se pudo procesar la imagen.');
  }
  const safeName = String(originalName || 'perfil').replace(/\.[^/.]+$/, '');
  return new File([blob], `${safeName}-cropped.jpg`, { type: 'image/jpeg' });
};

const TeamEditorPage = () => {
  const [accessCode, setAccessCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [isAccessGranted, setIsAccessGranted] = useState(() => {
    if (!ACCESS_CODE_ENABLED) return true;

    try {
      return sessionStorage.getItem(ACCESS_SESSION_KEY) === 'ok';
    } catch {
      return false;
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [showImageCropperModal, setShowImageCropperModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState({ file: null, url: '' });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageInputKey, setImageInputKey] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    description: '',
    teamSection: 'STAFF',
    teamTag: TEAM_TAG_OPTIONS[0],
    email: '',
    linkedinInput: '',
    instagramInput: '',
    whatsappInput: '',
    externalUrl: '',
  });

  const handleAccessSubmit = (event) => {
    event.preventDefault();
    setAccessError('');

    if (!ACCESS_CODE_ENABLED) {
      setIsAccessGranted(true);
      return;
    }

    if (accessCode.trim() !== TEAM_EDITOR_ACCESS_CODE) {
      setAccessError('Codigo incorrecto.');
      return;
    }

    try {
      sessionStorage.setItem(ACCESS_SESSION_KEY, 'ok');
    } catch {
      // no-op
    }
    setIsAccessGranted(true);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (event) => {
    setErrorMessage('');
    setImageError('');
    const file = event.target.files?.[0] || null;

    if (!file) {
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setImageError(validationError);
      setImageInputKey((prev) => prev + 1);
      return;
    }

    if (imageToCrop.url) {
      URL.revokeObjectURL(imageToCrop.url);
    }

    const preview = URL.createObjectURL(file);
    setImageToCrop({ file, url: preview });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setShowImageCropperModal(true);
  };

  const whatsappMeta = useMemo(() => normalizeWhatsapp(formData.whatsappInput), [formData.whatsappInput]);
  const normalizedWhatsapp = whatsappMeta.url;
  const whatsappError = whatsappMeta.error;
  const normalizedInstagram = useMemo(() => normalizeInstagram(formData.instagramInput), [formData.instagramInput]);
  const normalizedLinkedin = useMemo(() => normalizeLinkedin(formData.linkedinInput), [formData.linkedinInput]);

  const nameIsValid = useMemo(() => isValidNameSurname(formData.name), [formData.name]);

  const handleCancelImageCrop = () => {
    if (imageToCrop.url) {
      URL.revokeObjectURL(imageToCrop.url);
    }
    setImageToCrop({ file: null, url: '' });
    setShowImageCropperModal(false);
  };

  const handleRemoveSelectedImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl('');
    setImageError('');
    setImageInputKey((prev) => prev + 1);
  };

  const handleApplyImageCrop = async () => {
    if (!imageToCrop.file || !imageToCrop.url || !croppedAreaPixels) {
      return;
    }

    try {
      setIsCropping(true);
      setImageError('');
      const cropped = await getCroppedFileFromPixels(imageToCrop.url, croppedAreaPixels, imageToCrop.file.name);
      const preview = URL.createObjectURL(cropped);

      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }

      setImageFile(cropped);
      setImagePreviewUrl(preview);
      URL.revokeObjectURL(imageToCrop.url);
      setImageToCrop({ file: null, url: '' });
      setShowImageCropperModal(false);
    } catch (error) {
      console.error('Error recortando imagen de perfil:', error);
      setImageError('No se pudo recortar la imagen. Intenta con otra foto en JPG, PNG o WEBP.');
      setErrorMessage('No se pudo recortar la imagen. Intenta seleccionar otra.');
    } finally {
      setIsCropping(false);
    }
  };

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      if (imageToCrop.url) {
        URL.revokeObjectURL(imageToCrop.url);
      }
    };
  }, [imagePreviewUrl, imageToCrop.url]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!nameIsValid) {
      setErrorMessage('El nombre debe contener solo un nombre y un apellido.');
      return;
    }

    if (whatsappError) {
      setErrorMessage(whatsappError);
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedImageUrl = null;
      if (imageFile) {
        const safeName = imageFile.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
        const imagePath = `team-members/${Date.now()}-${safeName}`;
        const fileRef = storageRef(storage, imagePath);
        await uploadBytes(fileRef, imageFile);
        uploadedImageUrl = await getDownloadURL(fileRef);
      }

      const payload = {
        name: formData.name.trim(),
        role: formData.role.trim(),
        description: formData.description.trim(),
        teamSection: formData.teamSection,
        teamTag: formData.teamTag,
        email: cleanString(formData.email),
        imageUrl: uploadedImageUrl,
        linkedinUrl: normalizedLinkedin,
        instagramUrl: normalizedInstagram,
        whatsappUrl: normalizedWhatsapp,
        externalUrl: cleanString(formData.externalUrl),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'teamMembers'), payload);

      setSuccessMessage('Miembro agregado correctamente.');
      setFormData((prev) => ({
        ...prev,
        name: '',
        role: '',
        description: '',
        email: '',
        linkedinInput: '',
        instagramInput: '',
        whatsappInput: '',
        externalUrl: '',
      }));

      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImageFile(null);
      setImagePreviewUrl('');
    } catch (error) {
      console.error('Error al guardar miembro de equipo:', error);
      setErrorMessage('No fue posible guardar el miembro. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Editor de Equipo - Boreal Labs</title>
        <meta
          name="description"
          content="Formulario interno para registrar nuevos miembros del equipo de Boreal Labs."
        />
      </Helmet>

      <div className="pt-32 pb-20 bg-boreal-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {ACCESS_CODE_ENABLED && !isAccessGranted ? (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-lg mx-auto glass-effect rounded-2xl p-6 md:p-8"
            >
              <h1 className="text-2xl md:text-3xl font-black text-white mb-2">Acceso al Editor</h1>
              <p className="text-gray-300 mb-6">Ingresa el codigo de acceso para continuar.</p>

              <form onSubmit={handleAccessSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="accessCode" className="text-gray-200 mb-1 block">Codigo de acceso</Label>
                  <Input
                    id="accessCode"
                    type="password"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Codigo"
                    autoFocus
                    required
                  />
                </div>

                {accessError && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {accessError}
                  </div>
                )}

                <Button type="submit" className="w-full bg-gradient-to-r from-boreal-blue to-boreal-purple text-white">
                  Entrar al editor
                </Button>
              </form>
            </motion.section>
          ) : (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-effect rounded-2xl p-6 md:p-10"
          >
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Editor de Equipo</h1>
            <p className="text-gray-300 mb-8">
              Ruta oculta para registrar integrantes en la coleccion teamMembers.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold">Paso 1. Datos basicos</p>
                  <p className="text-xs text-gray-400 mt-1">Completa nombre y cargo tal como deseas mostrarlo en la pagina publica.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-gray-200 mb-1 block">Nombre completo *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Ejemplo: Ana Perez"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-400">Solo un nombre y un apellido.</p>
                    {!nameIsValid && formData.name.trim().length > 0 && (
                      <p className="mt-1 text-xs text-red-300">Debe tener exactamente 2 palabras.</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="role" className="text-gray-200 mb-1 block">Cargo *</Label>
                    <Input id="role" name="role" value={formData.role} onChange={handleInputChange} placeholder="Ejemplo: Coordinadora de Finanzas" required />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold">Paso 2. Organizacion interna</p>
                  <p className="text-xs text-gray-400 mt-1">Define grupo y etiqueta para ubicar correctamente al miembro.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="teamSection" className="text-gray-200 mb-1 block">Grupo *</Label>
                    <select
                      id="teamSection"
                      name="teamSection"
                      value={formData.teamSection}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded-md border bg-transparent text-white"
                    >
                      <option value="DIRECTIVA" className="text-black">DIRECTIVA</option>
                      <option value="STAFF" className="text-black">STAFF</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="teamTag" className="text-gray-200 mb-1 block">Etiqueta *</Label>
                    <select
                      id="teamTag"
                      name="teamTag"
                      value={formData.teamTag}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded-md border bg-transparent text-white"
                    >
                      {TEAM_TAG_OPTIONS.map((option) => (
                        <option key={option} value={option} className="text-black">
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description" className="text-gray-200 mb-1 block">Descripcion *</Label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    placeholder="Breve descripcion del perfil y su aporte al equipo."
                    className="w-full px-3 py-2 rounded-md border bg-transparent text-white"
                  />
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold">Paso 3. Foto de perfil</p>
                  <p className="text-xs text-gray-400 mt-1">Formatos permitidos: JPG, PNG, WEBP. Tamano maximo: {MAX_IMAGE_SIZE_MB}MB.</p>
                </div>

                <div>
                  <Label htmlFor="imageFile" className="text-gray-200 mb-1 block">Imagen de perfil</Label>
                  <Input key={imageInputKey} id="imageFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
                  <p className="mt-1 text-xs text-gray-400">Antes de guardar, podras recortarla en formato circular.</p>
                  {imageFile && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-xs text-gray-300 truncate">Seleccionada: {imageFile.name}</p>
                      <Button type="button" variant="outline" onClick={handleRemoveSelectedImage} className="text-xs border-white/20 text-white hover:bg-white/10">
                        Quitar
                      </Button>
                    </div>
                  )}
                  {imageError && <p className="mt-2 text-xs text-red-300">{imageError}</p>}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold">Paso 4. Contacto y redes (opcional)</p>
                  <p className="text-xs text-gray-400 mt-1">Puedes agregar uno o varios canales de contacto.</p>
                </div>

                <div>
                  <Label htmlFor="email" className="text-gray-200 mb-1 block">Email</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="whatsappInput" className="text-gray-200 mb-1 block">WhatsApp (numero o URL)</Label>
                    <Input
                      id="whatsappInput"
                      name="whatsappInput"
                      value={formData.whatsappInput}
                      onChange={handleInputChange}
                      placeholder="12345678 o https://wa.me/..."
                    />
                    <p className="mt-1 text-xs text-gray-400 break-all">{normalizedWhatsapp || 'Solo 8 digitos locales. Se agregara prefijo 505.'}</p>
                    {whatsappError && (
                      <p className="mt-1 text-xs text-red-300">{whatsappError}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="instagramInput" className="text-gray-200 mb-1 block">Instagram (user o URL)</Label>
                    <Input
                      id="instagramInput"
                      name="instagramInput"
                      value={formData.instagramInput}
                      onChange={handleInputChange}
                      placeholder="usuario o https://instagram.com/usuario"
                    />
                    <p className="mt-1 text-xs text-gray-400 break-all">{normalizedInstagram || 'Se completara el enlace automaticamente.'}</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="linkedinInput" className="text-gray-200 mb-1 block">LinkedIn (user o URL)</Label>
                  <Input
                    id="linkedinInput"
                    name="linkedinInput"
                    value={formData.linkedinInput}
                    onChange={handleInputChange}
                    placeholder="usuario o https://linkedin.com/in/usuario"
                  />
                  <p className="mt-1 text-xs text-gray-400 break-all">{normalizedLinkedin || 'Se completara el enlace automaticamente.'}</p>
                </div>

                <div>
                  <Label htmlFor="externalUrl" className="text-gray-200 mb-1 block">Enlace externo adicional</Label>
                  <Input id="externalUrl" name="externalUrl" value={formData.externalUrl} onChange={handleInputChange} placeholder="https://..." />
                </div>

                {successMessage && (
                  <div className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                    {successMessage}
                  </div>
                )}

                {errorMessage && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMessage}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || isCropping || !nameIsValid || Boolean(whatsappError)}
                  className="w-full bg-gradient-to-r from-boreal-blue to-boreal-purple text-white"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar miembro'}
                </Button>
              </form>

              <div>
                <h3 className="text-white font-bold mb-3">Previsualizacion</h3>
                <div className="glass-effect rounded-2xl p-4 text-center hover:bg-white/10 transition-all group transform hover:-translate-y-1">
                  <div className="mb-4 overflow-hidden rounded-full w-32 h-32 mx-auto border-2 border-boreal-blue/50 bg-white/5 flex items-center justify-center">
                    {imagePreviewUrl ? (
                      <img
                        alt="Vista previa"
                        className="w-full h-full object-cover"
                        src={imagePreviewUrl}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                        {initialsFromName(formData.name)}
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">{formData.name || 'Nombre Apellido'}</h3>
                  <div className="text-boreal-aqua font-medium mb-2 text-sm">{formData.role || 'Cargo'}</div>

                  <div className="mb-3">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${TAG_STYLES[formData.teamTag] || 'border-boreal-aqua/50 bg-boreal-aqua/10 text-boreal-aqua'}`}>
                      {formData.teamTag}
                    </span>
                  </div>

                  <p className="text-gray-400 mb-4 text-xs">{formData.description || 'Descripcion del miembro del equipo.'}</p>

                  <div className="flex space-x-2 justify-center">
                    {normalizedLinkedin && (
                      <motion.a
                        href={normalizedLinkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
                        aria-label="LinkedIn"
                      >
                        <Linkedin className="w-4 h-4 text-boreal-aqua" />
                      </motion.a>
                    )}

                    {formData.email && (
                      <motion.a
                        href={`mailto:${formData.email}`}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
                        aria-label="Email"
                      >
                        <Mail className="w-4 h-4 text-boreal-aqua" />
                      </motion.a>
                    )}

                    {normalizedInstagram && (
                      <motion.a
                        href={normalizedInstagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
                        aria-label="Instagram"
                      >
                        <Instagram className="w-4 h-4 text-boreal-aqua" />
                      </motion.a>
                    )}

                    {normalizedWhatsapp && (
                      <motion.a
                        href={normalizedWhatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
                        aria-label="WhatsApp"
                      >
                        <Smartphone className="w-4 h-4 text-boreal-aqua" />
                      </motion.a>
                    )}

                    {formData.externalUrl && (
                      <motion.a
                        href={formData.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
                        aria-label="Enlace externo"
                      >
                        <LinkIcon className="w-4 h-4 text-boreal-aqua" />
                      </motion.a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {showImageCropperModal && (
              <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-[#0f172a] border border-white/20 rounded-2xl p-4 space-y-4">
                  <h3 className="text-white font-semibold">Recortar imagen de perfil</h3>
                  <div className="relative h-[320px] bg-black/40 rounded-xl overflow-hidden">
                    <Cropper
                      image={imageToCrop.url}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape="round"
                      showGrid={false}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zoomRange" className="text-gray-200 mb-1 block">Zoom</Label>
                    <input
                      id="zoomRange"
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCancelImageCrop}>
                      Cancelar
                    </Button>
                    <Button type="button" disabled={isCropping} onClick={handleApplyImageCrop} className="bg-boreal-aqua text-black hover:bg-emerald-400">
                      {isCropping ? 'Procesando...' : 'Aplicar recorte'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.section>
          )}
        </div>
      </div>
    </>
  );
};

export default TeamEditorPage;
