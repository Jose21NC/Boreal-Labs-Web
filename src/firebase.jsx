import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getStorage } from 'firebase/storage';
// getAnalytics es opcional, pero puedes mantenerlo si lo usas
import { getAnalytics } from "firebase/analytics";

// --- ¡ADVERTENCIA DE SEGURIDAD! ---
// NUNCA dejes tus claves secretas escritas directamente en el código
// -----------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyCEP8h9z4pW9NIV3qEd2XrrAOGkkgZGAiQ",
  authDomain: "borealabsweb.firebaseapp.com",
  projectId: "borealabsweb",
  storageBucket: "borealabsweb.firebasestorage.app",
  messagingSenderId: "338356857449",
  appId: "1:338356857449:web:742c8d0f7fb9e25e1390f8",
  measurementId: "G-4EGW38C9RY"
};


// --- INICIALIZACIÓN ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app); // Analytics
const storage = getStorage(app);

// Habilitar logs de debug para Firestore (útil para desarrollo)
setLogLevel('debug');

// --- AUTENTICACIÓN ---
// Inicia sesión anónimamente para que las reglas de seguridad de
// Firestore (como 'allow read if request.auth != null') funcionen.
// No usaremos __initial_auth_token por ahora para simplificar.
const authenticate = async () => {
  try {
    console.log("Autenticando anónimamente...");
    await signInAnonymously(auth);
    console.log("Autenticación exitosa. User ID:", auth.currentUser?.uid);
  } catch (error) {
    console.error("Error durante la autenticación anónima:", error);
  }
};

// Inicia la autenticación en cuanto se carga el archivo
authenticate();

// Exporta las instancias que usaremos en la app
// Exporta storage también para poder resolver download URLs desde Storage
export { db, auth, analytics, storage };
