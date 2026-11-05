// Reglas compartidas con la Boreal Wallet (otro repo, mismo proyecto Firebase):
// la Wallet solo lee el saldo de userPoints/{uid} y canjea códigos de pointCodes/{código}.
import { toDate } from '@/admin/lib';

// shortcut: heurística por longitud del id; reemplazar si se guarda un campo uid
// (los uid de Firebase Auth por correo/Google tienen 28 caracteres; los ids automáticos de Firestore, 20).
export const isWalletUid = (id) => typeof id === 'string' && id.length === 28;

/**
 * Agrupa los docs de userPoints por correo (puede haber varios por persona: el doc de la Wallet
 * y otros con id aleatorio escritos desde la web antes de que la persona iniciara sesión).
 * `target` es el doc al que deben ir los ajustes: el de la Wallet si existe.
 */
export function groupByEmail(docs) {
  const map = new Map();
  docs.forEach((d) => {
    const email = String(d.email || '').trim().toLowerCase();
    const key = email || `sin-correo:${d.id}`;
    const p = map.get(key) || { key, email, docs: [] };
    p.docs.push(d);
    map.set(key, p);
  });
  return [...map.values()].map((p) => {
    const wallet = p.docs.find((d) => isWalletUid(d.id)) || null;
    const latest = [...p.docs].sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0))[0];
    const balance = p.docs.reduce((acc, d) => acc + (Number(d.balance) || 0), 0);
    return {
      ...p,
      id: p.key,
      balance,
      walletBalance: wallet ? Number(wallet.balance) || 0 : null,
      lastEvent: latest.lastEvent || '',
      updatedAt: latest.updatedAt || null,
      duplicate: p.docs.length > 1,
      noWallet: !wallet,
      target: { ...(wallet || latest), email: p.email },
    };
  });
}

/** Correo → persona agrupada, para unir saldos en memoria (certificados, asistente). */
export const peopleByEmail = (docs) => new Map(groupByEmail(docs).filter((p) => p.email).map((p) => [p.email, p]));

/** Estado de un código de la Wallet. */
export function codeStatus(c, now = Date.now()) {
  const exp = toDate(c.expiresAt);
  if (!c.multiUse && c.used) return 'usado';
  if (c.active === false) return 'inactivo';
  if (exp && exp.getTime() < now) return 'expirado';
  return 'activo';
}

export const STATUS_TONE = { activo: 'success', usado: 'neutral', expirado: 'warning', inactivo: 'danger' };

/** Usos de un código: 1 si es de un solo uso y ya se canjeó; si es multiuso, redeemedCount. */
export const codeUses = (c) => (c.multiUse ? Number(c.redeemedCount) || 0 : c.used ? 1 : 0);

// Crockford base32 sin I, L, O, U: legible y sin caracteres ambiguos. 256 % 32 === 0 → sin sesgo.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => ALPHABET[b & 31]).join('');
  return `BL-${chars.slice(0, 4)}-${chars.slice(4)}`;
}
