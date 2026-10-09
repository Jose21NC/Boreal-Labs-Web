import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getStorage } from 'firebase/storage';

// --- ¡ADVERTENCIA DE SEGURIDAD! ---
// NUNCA dejes tus claves secretas escritas directamente en el código
// -----------------------------------

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


// --- INICIALIZACIÓN ---
// La app se despliega sin .env en algunos entornos (ej. previews de Voxlab,
// donde la landing es estática y no usa Firestore). initializeApp() lanza
// `auth/invalid-api-key` si falta la config, y como esto corre a nivel de
// módulo, el throw tumba el árbol entero de React. Inicializamos solo si
// hay config y exponemos null en su defecto, para que las páginas estáficas
// (Voxlab, descargas de APK) no dependan de Firebase.
const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else if (import.meta.env.DEV) {
  console.warn(
    '[firebase] Sin VITE_FIREBASE_* configurado. Las funciones de Firebase ' +
      '(Firestore, Auth, Storage) están desactivadas; el resto de la app funciona.'
  );
}

// Evita ruido en consola; activar solo si VITE_FIRESTORE_DEBUG=true en desarrollo.
if (db) {
  const enableFirestoreDebug = import.meta.env.DEV && import.meta.env.VITE_FIRESTORE_DEBUG === 'true';
  setLogLevel(enableFirestoreDebug ? 'debug' : 'silent');
}

// --- AUTENTICACIÓN ---
// Inicia sesión anónimamente para que las reglas de seguridad de
// Firestore (como 'allow read if request.auth != null') funcionen.
// No usaremos __initial_auth_token por ahora para simplificar.
const authenticate = async () => {
  // Sin config no hay nada que autenticar.
  if (!auth) {
    return;
  }

  // Solo intenta auth anónima si se habilita explícitamente por entorno.
  if (import.meta.env.VITE_ENABLE_ANON_AUTH !== 'true') {
    return;
  }

  // Si ya hay sesión iniciada (admin/email), no sobreescribir flujo.
  if (auth.currentUser) {
    return;
  }

  try {
    console.log("Autenticando anónimamente...");
    await signInAnonymously(auth);
    console.log("Autenticación exitosa. User ID:", auth.currentUser?.uid);
  } catch (error) {
    // Firebase puede devolver 'auth/admin-restricted-operation' si el proyecto
    // no permite anonymous sign-in. No queremos que esto rompa la app.
    if (error?.code === 'auth/admin-restricted-operation') {
      console.warn('Autenticación anónima no permitida en este proyecto (admin-restricted-operation). Continuando sin auth.');
    } else {
      console.error("Error durante la autenticación anónima:", error);
    }
  }
};

// Inicia la autenticación en cuanto se carga el archivo
authenticate();

// Exporta las instancias que usaremos en la app
// Exporta storage también para poder resolver download URLs desde Storage
// `isFirebaseConfigured` permite a los consumidores saltarse la UI de Firebase
// (ej. VoxlabPage) cuando el entorno no trae claves.
export { db, auth, storage, isFirebaseConfigured };
