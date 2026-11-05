// Normalizadores y validaciones del formulario de equipo (portados de TeamEditorPage).
export const MAX_IMAGE_SIZE_MB = 8;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const isFullUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const sanitizeUsername = (value) => String(value || '').trim().replace(/^@+/, '');

export const normalizeWhatsapp = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { url: null, error: '' };
  if (isFullUrl(raw)) return { url: raw, error: '' };
  const digits = raw.replace(/\D/g, '');
  if (!digits) return { url: null, error: '' };
  if (digits.length !== 8) return { url: null, error: 'El número de WhatsApp debe tener exactamente 8 dígitos.' };
  return { url: `https://wa.me/505${digits}`, error: '' };
};

export const normalizeInstagram = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (isFullUrl(raw)) return raw;
  const username = sanitizeUsername(raw.replace(/^instagram\.com\//i, '')).split('/')[0];
  return username ? `https://instagram.com/${username}` : null;
};

export const normalizeLinkedin = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (isFullUrl(raw)) return raw;
  const normalized = raw.replace(/^linkedin\.com\//i, '').replace(/^in\//i, '').replace(/^@+/, '').split('/')[0];
  return normalized ? `https://linkedin.com/in/${normalized}` : null;
};

export const cleanString = (value) => {
  const out = String(value || '').trim();
  return out.length > 0 ? out : null;
};

export const isValidNameSurname = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length === 2;

export const validateImageFile = (file) => {
  if (!file) return 'No se seleccionó ningún archivo.';
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Formato no compatible. Usa JPG, PNG o WEBP.';
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) return `La imagen supera ${MAX_IMAGE_SIZE_MB} MB.`;
  return '';
};

export const safeFileName = (name) => String(name || 'archivo').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');

export async function cropToFile(imageSrc, pixelCrop, originalName) {
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
  if (!ctx) throw new Error('No se pudo inicializar el editor de imagen.');
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  const base = String(originalName || 'perfil').replace(/\.[^/.]+$/, '');
  return new File([blob], `${base}-cropped.jpg`, { type: 'image/jpeg' });
}

/** Documento de Firestore -> estado del formulario. Las URLs completas pasan tal cual por los normalizadores. */
export const memberToForm = (m = {}) => ({
  name: m.name || '',
  role: m.role || '',
  description: m.description || '',
  teamSection: m.memberSection || 'STAFF',
  teamTag: m.memberTag || 'Directiva General',
  email: m.email || '',
  linkedinInput: m.linkedinUrl || '',
  instagramInput: m.instagramUrl || '',
  whatsappInput: m.whatsappUrl || '',
  externalUrl: m.externalUrl || '',
});

// Enlaces de perfil: 32 caracteres url-safe (192 bits). 64 símbolos = byte & 63 sin sesgo.
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const newInviteToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => TOKEN_ALPHABET[b & 63]).join('');

/** Estado del formulario -> campos de perfil normalizados (mismo criterio que el editor admin). */
export const formToProfile = (form) => ({
  name: form.name.trim(),
  role: form.role.trim(),
  description: form.description.trim(),
  email: cleanString(form.email),
  linkedinUrl: normalizeLinkedin(form.linkedinInput),
  instagramUrl: normalizeInstagram(form.instagramInput),
  whatsappUrl: normalizeWhatsapp(form.whatsappInput).url,
  externalUrl: isFullUrl(form.externalUrl) ? form.externalUrl.trim() : null,
});
