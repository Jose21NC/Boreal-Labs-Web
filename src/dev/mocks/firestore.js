// Firestore en memoria para el modo de prueba (`npm run dev:demo`). Vite lo usa en lugar de
// 'firebase/firestore' solo con --mode demo (ver vite.config.js); nunca entra en el build.
// Implementa solo la API que usa el sitio. Persiste en localStorage para sobrevivir recargas.
import { seed } from '@/dev/seed';

const STORAGE_KEY = 'demo:firestore:v1';

export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static fromDate(date) { return Timestamp.fromMillis(date.getTime()); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static now() { return Timestamp.fromMillis(Date.now()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
  isEqual(other) { return other instanceof Timestamp && other.toMillis() === this.toMillis(); }
  valueOf() { return this.toMillis(); }
}

// --- serialización (Timestamp/Date <-> JSON) ---
const encode = (v) => {
  if (v instanceof Timestamp) return { __ts: v.toMillis() };
  if (v instanceof Date) return { __ts: v.getTime() };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
  return v;
};
const decode = (v) => {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object') {
    if ('__ts' in v) return Timestamp.fromMillis(v.__ts);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
  }
  return v;
};

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return decode(JSON.parse(raw));
  } catch { /* datos corruptos: volver a la semilla */ }
  return decode(encode(seed()));
};

let store = load(); // { 'coleccion/path': { id: data } }
const listeners = new Set();

const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(encode(store))); } catch { /* cuota llena */ }
  listeners.forEach((l) => l());
};

/** Restablece la base de prueba a la semilla original. */
export const resetDemoData = () => {
  store = decode(encode(seed()));
  persist();
};

// --- referencias ---
const joinPath = (base, segments) => [base, ...segments].filter(Boolean).join('/');
const randomId = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);

export const getFirestore = () => ({ type: 'firestore' });
export const setLogLevel = () => {};

export function collection(parent, ...segments) {
  const base = parent?.type === 'doc' ? parent.path : '';
  return { type: 'collection', path: joinPath(base, segments.flatMap((s) => s.split('/'))) };
}

export function doc(parent, ...segments) {
  const flat = segments.flatMap((s) => String(s).split('/'));
  if (parent?.type === 'collection') {
    const id = flat[0] ?? randomId();
    return makeDocRef(`${parent.path}/${[id, ...flat.slice(1)].join('/')}`);
  }
  return makeDocRef(flat.join('/'));
}

const makeDocRef = (path) => {
  const parts = path.split('/');
  return { type: 'doc', path, id: parts[parts.length - 1], parentPath: parts.slice(0, -1).join('/') };
};

// --- valores especiales ---
const SENTINEL = Symbol('sentinel');
export const serverTimestamp = () => ({ [SENTINEL]: 'serverTimestamp' });
export const increment = (n) => ({ [SENTINEL]: 'increment', n });
export const deleteField = () => ({ [SENTINEL]: 'delete' });
export const arrayUnion = (...items) => ({ [SENTINEL]: 'arrayUnion', items });
export const arrayRemove = (...items) => ({ [SENTINEL]: 'arrayRemove', items });

const resolveValue = (value, previous) => {
  const s = value && value[SENTINEL];
  if (s === 'serverTimestamp') return Timestamp.now();
  if (s === 'increment') return (Number(previous) || 0) + value.n;
  if (s === 'arrayUnion') return [...new Set([...(previous || []), ...value.items])];
  if (s === 'arrayRemove') return (previous || []).filter((x) => !value.items.includes(x));
  if (value instanceof Date) return Timestamp.fromDate(value);
  return value;
};

const applyFields = (target, fields) => {
  const out = structuredCloneSafe(target);
  Object.entries(fields).forEach(([key, value]) => {
    const keys = key.split('.');
    let node = out;
    keys.slice(0, -1).forEach((k) => { node[k] = node[k] && typeof node[k] === 'object' ? node[k] : {}; node = node[k]; });
    const last = keys[keys.length - 1];
    if (value && value[SENTINEL] === 'delete') delete node[last];
    else node[last] = resolveValue(value, node[last]);
  });
  return out;
};

const structuredCloneSafe = (obj) => decode(encode(obj || {}));

// --- snapshots ---
const getField = (data, field) => String(field).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), data);

const makeSnap = (ref, data) => ({
  id: ref.id,
  ref,
  exists: () => data !== undefined,
  data: () => (data === undefined ? undefined : structuredCloneSafe(data)),
  get: (field) => getField(data, field),
});

const readDoc = (ref) => store[ref.parentPath]?.[ref.id];

// --- consultas ---
export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir });
export const limit = (n) => ({ kind: 'limit', n });
export const documentId = () => '__name__';
export const query = (ref, ...constraints) => ({ type: 'query', path: ref.path, constraints: [...(ref.constraints || []), ...constraints] });

const comparable = (v) => (v instanceof Timestamp ? v.toMillis() : v instanceof Date ? v.getTime() : v);

const matches = (data, id, { field, op, value }) => {
  const actual = comparable(field === '__name__' ? id : getField(data, field));
  const expected = comparable(value);
  switch (op) {
    case '==': return actual === expected;
    case '!=': return actual !== expected;
    case '<': return actual < expected;
    case '<=': return actual <= expected;
    case '>': return actual > expected;
    case '>=': return actual >= expected;
    case 'in': return Array.isArray(value) && value.map(comparable).includes(actual);
    case 'not-in': return Array.isArray(value) && !value.map(comparable).includes(actual);
    case 'array-contains': return Array.isArray(actual) && actual.includes(expected);
    case 'array-contains-any': return Array.isArray(actual) && value.some((v) => actual.includes(v));
    default: throw new Error(`[demo] operador no soportado: ${op}`);
  }
};

const runQuery = (q) => {
  const coll = store[q.path] || {};
  let rows = Object.entries(coll).map(([id, data]) => ({ id, data }));
  const constraints = q.constraints || [];
  constraints.filter((c) => c.kind === 'where').forEach((c) => { rows = rows.filter((r) => matches(r.data, r.id, c)); });
  constraints.filter((c) => c.kind === 'orderBy').reverse().forEach((c) => {
    rows.sort((a, b) => {
      const x = comparable(getField(a.data, c.field));
      const y = comparable(getField(b.data, c.field));
      if (x === y) return 0;
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return (x < y ? -1 : 1) * (c.dir === 'desc' ? -1 : 1);
    });
  });
  const lim = constraints.find((c) => c.kind === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  const docs = rows.map((r) => makeSnap(makeDocRef(`${q.path}/${r.id}`), r.data));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
};

// Simula la latencia de red para que se vean los estados de carga.
const later = (fn) => new Promise((resolve, reject) => setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, 120));

export const getDocs = (q) => later(() => runQuery(q.type === 'collection' ? { ...q, constraints: [] } : q));
export const getDoc = (ref) => later(() => makeSnap(ref, readDoc(ref)));
export const getCountFromServer = (q) => later(() => {
  const { size } = runQuery(q.type === 'collection' ? { ...q, constraints: [] } : q);
  return { data: () => ({ count: size }) };
});

// --- escrituras ---
const writeDoc = (ref, data) => {
  store = { ...store, [ref.parentPath]: { ...(store[ref.parentPath] || {}), [ref.id]: data } };
};

const ops = {
  set: (ref, data, options) => {
    const base = options?.merge ? readDoc(ref) || {} : {};
    writeDoc(ref, applyFields(base, data));
  },
  update: (ref, fieldsOrKey, ...rest) => {
    const current = readDoc(ref);
    if (current === undefined) {
      const err = new Error(`No document to update: ${ref.path}`);
      err.code = 'not-found';
      throw err;
    }
    const fields = typeof fieldsOrKey === 'string' ? { [fieldsOrKey]: rest[0] } : fieldsOrKey;
    writeDoc(ref, applyFields(current, fields));
  },
  delete: (ref) => {
    const coll = { ...(store[ref.parentPath] || {}) };
    delete coll[ref.id];
    store = { ...store, [ref.parentPath]: coll };
  },
};

export const setDoc = (ref, data, options) => later(() => { ops.set(ref, data, options); persist(); });
export const updateDoc = (ref, ...args) => later(() => { ops.update(ref, ...args); persist(); });
export const deleteDoc = (ref) => later(() => { ops.delete(ref); persist(); });
export const addDoc = (collRef, data) => later(() => {
  const ref = doc(collRef);
  ops.set(ref, data);
  persist();
  return ref;
});

export function writeBatch() {
  const queue = [];
  const batch = {
    set: (ref, data, options) => { queue.push(() => ops.set(ref, data, options)); return batch; },
    update: (ref, ...args) => { queue.push(() => ops.update(ref, ...args)); return batch; },
    delete: (ref) => { queue.push(() => ops.delete(ref)); return batch; },
    commit: () => later(() => {
      const snapshot = store;
      try { queue.forEach((op) => op()); } catch (e) { store = snapshot; throw e; }
      persist();
    }),
  };
  return batch;
}

export const runTransaction = async (_db, fn) => {
  const tx = {
    get: (ref) => Promise.resolve(makeSnap(ref, readDoc(ref))),
    set: (ref, data, options) => { ops.set(ref, data, options); return tx; },
    update: (ref, ...args) => { ops.update(ref, ...args); return tx; },
    delete: (ref) => { ops.delete(ref); return tx; },
  };
  const snapshot = store;
  try {
    const result = await fn(tx);
    persist();
    return result;
  } catch (e) {
    store = snapshot;
    throw e;
  }
};

export function onSnapshot(target, onNext, onError) {
  const emit = () => {
    try {
      if (target.type === 'doc') onNext(makeSnap(target, readDoc(target)));
      else onNext(runQuery(target.type === 'collection' ? { ...target, constraints: [] } : target));
    } catch (e) {
      onError?.(e);
    }
  };
  setTimeout(emit, 0);
  listeners.add(emit);
  return () => listeners.delete(emit);
}
