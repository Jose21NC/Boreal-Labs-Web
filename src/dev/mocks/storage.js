// Modo de prueba: Storage en memoria. Los archivos subidos viven como blob: URLs hasta recargar.
// Al iniciar se siembran plantillas de certificado de ejemplo (src/dev/demoTemplates.js).
import { demoTemplateFiles } from '@/dev/demoTemplates';

const files = new Map(); // fullPath -> { url, contentType, size }

export const getStorage = () => ({ type: 'storage' });

export const ref = (storageOrRef, path = '') => {
  // ref(otraRef, 'hijo') resuelve relativo, como el SDK real.
  const base = storageOrRef?.fullPath ? `${storageOrRef.fullPath}/` : '';
  const fullPath = `${base}${String(path).replace(/^\/+/, '')}`.replace(/\/+$/, '');
  return { fullPath, name: fullPath.split('/').pop(), bucket: 'demo-bucket' };
};

const put = (storageRef, data, metadata) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: metadata?.contentType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  files.set(storageRef.fullPath, { url, contentType: blob.type, size: blob.size });
  return { ref: storageRef, metadata: { fullPath: storageRef.fullPath, size: blob.size, contentType: blob.type } };
};

const ready = demoTemplateFiles()
  .then((seed) => Object.entries(seed).forEach(([path, bytes]) => put(ref(null, path), bytes, { contentType: 'application/pdf' })))
  .catch((error) => console.warn('[demo] No se pudieron sembrar plantillas', error));

export const uploadBytes = async (storageRef, data, metadata) => { await ready; return put(storageRef, data, metadata); };

export const uploadString = async (storageRef, value, format = 'raw', metadata) => {
  const text = format === 'data_url' ? await (await fetch(value)).blob() : value;
  return put(storageRef, text, metadata);
};

export function uploadBytesResumable(storageRef, data, metadata) {
  const result = put(storageRef, data, metadata);
  const snapshot = { ref: storageRef, bytesTransferred: result.metadata.size, totalBytes: result.metadata.size, state: 'success' };
  const promise = Promise.resolve(snapshot);
  return {
    snapshot,
    on: (_event, next, _error, complete) => {
      setTimeout(() => { next?.(snapshot); complete?.(); }, 50);
      return () => {};
    },
    then: (a, b) => promise.then(a, b),
    catch: (b) => promise.catch(b),
    cancel: () => false,
    pause: () => false,
    resume: () => false,
  };
}

export const getDownloadURL = async (storageRef) => {
  await ready;
  const file = files.get(storageRef.fullPath);
  if (file) return file.url;
  const err = new Error(`[demo] Objeto no encontrado: ${storageRef.fullPath}`);
  err.code = 'storage/object-not-found';
  throw err;
};

export const getBlob = async (storageRef) => (await fetch(await getDownloadURL(storageRef))).blob();
export const getBytes = async (storageRef) => (await getBlob(storageRef)).arrayBuffer();

export const deleteObject = async (storageRef) => { await ready; files.delete(storageRef.fullPath); };

export const listAll = async (storageRef) => {
  await ready;
  const prefix = storageRef.fullPath ? `${storageRef.fullPath}/` : '';
  const items = [];
  const prefixes = new Set();
  files.forEach((_v, path) => {
    if (!path.startsWith(prefix)) return;
    const rest = path.slice(prefix.length);
    if (rest.includes('/')) prefixes.add(rest.split('/')[0]);
    else items.push(ref(null, path));
  });
  return { items, prefixes: [...prefixes].map((p) => ref(null, prefix + p)) };
};

export const getMetadata = async (storageRef) => {
  await ready;
  const file = files.get(storageRef.fullPath);
  if (!file) throw Object.assign(new Error('not found'), { code: 'storage/object-not-found' });
  return { fullPath: storageRef.fullPath, contentType: file.contentType, size: file.size };
};
