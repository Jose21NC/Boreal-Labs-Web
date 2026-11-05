// Reglas compartidas del equipo: las usan la página pública (/equipo) y el panel admin,
// para que la previsualización del admin coincida con lo publicado.
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase';

export const TEAM_TAG_OPTIONS = [
  'Directiva General',
  'Operaciones',
  'Finanzas',
  'Redes',
  'Voluntariado',
  'Secretaria General',
  'Relaciones Institucionales',
];

export const TAG_STYLES = {
  'Directiva General': 'border-sky-400/50 bg-sky-500/15 text-sky-200',
  Operaciones: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200',
  Finanzas: 'border-lime-400/50 bg-lime-500/15 text-lime-200',
  Redes: 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200',
  Voluntariado: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
  'Secretaria General': 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200',
  'Relaciones Institucionales': 'border-rose-400/50 bg-rose-500/15 text-rose-200',
};

// Solo permite enlaces http(s); evita javascript: u otros esquemas guardados en Firestore.
export const safeUrl = (value) => (/^https?:\/\//i.test(String(value || '').trim()) ? value : null);

export const normalizeSection = (member) => {
  const raw = String(member.teamSection || member.teamType || member.group || member.area || '').toLowerCase().trim();
  if (raw.includes('directiva') || raw.includes('board') || raw.includes('lider')) return 'DIRECTIVA';
  return 'STAFF';
};

export const normalizeTag = (member) => {
  const rawTag = String(member.teamTag || member.tag || member.label || '').trim();
  const found = TEAM_TAG_OPTIONS.find((tag) => tag.toLowerCase() === rawTag.toLowerCase());
  if (found) return found;
  if (rawTag) return rawTag;
  return normalizeSection(member) === 'DIRECTIVA' ? 'Directiva General' : 'Operaciones';
};

/** imageUrl puede ser string, {ref} o [{downloadURL|ref}] (datos heredados). Devuelve URL o null. */
export async function resolveMemberImage(member) {
  const img = member.imageUrl;
  try {
    if (typeof img === 'string') return img || null;
    const first = Array.isArray(img) ? img[0] : img;
    if (first?.downloadURL) return first.downloadURL;
    if (first?.ref && storage) return await getDownloadURL(storageRef(storage, first.ref));
  } catch (e) {
    console.warn('No se pudo resolver imageUrl para', member.id, e);
  }
  return null;
}

// Único correo que puede aprobar/rechazar solicitudes de perfil (igual que firestore.rules: teamSubmissions).
export const TEAM_APPROVER = 'admin@borealabs.org';

// Campos de perfil que un integrante puede proponer por enlace (teamSubmissions) y que se copian a teamMembers.
export const PROFILE_FIELDS = [
  ['name', 'Nombre'], ['role', 'Cargo'], ['description', 'Descripción'], ['email', 'Email'],
  ['linkedinUrl', 'LinkedIn'], ['instagramUrl', 'Instagram'], ['whatsappUrl', 'WhatsApp'],
  ['externalUrl', 'Enlace externo'], ['imageUrl', 'Foto'],
];

export const inviteUrl = (token) => `${window.location.origin}/equipo/perfil/${token}`;
