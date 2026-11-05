// Modo de prueba: un admin ficticio siempre autenticado (el panel no pide login con --mode demo).
const demoUser = {
  uid: 'demo-admin',
  email: 'demo@borealabs.org',
  displayName: 'Admin de prueba',
  photoURL: null,
  getIdToken: async () => 'demo-token',
};

const demoAuth = { currentUser: demoUser };

export const getAuth = () => demoAuth;
export const browserLocalPersistence = { type: 'LOCAL' };
export const setPersistence = async () => {};
export const onAuthStateChanged = (_auth, cb) => {
  setTimeout(() => cb(demoAuth.currentUser), 0);
  return () => {};
};
export const signInWithEmailAndPassword = async () => ({ user: demoUser });
export const signInWithPopup = async () => ({ user: demoUser });
export const signInAnonymously = async () => ({ user: demoUser });
// En modo prueba "cerrar sesión" no hace nada: no hay a dónde volver.
export const signOut = async () => {};
export class GoogleAuthProvider {
  setCustomParameters() { return this; }
  addScope() { return this; }
}
