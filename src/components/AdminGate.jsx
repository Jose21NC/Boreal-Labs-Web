import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { auth, db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { AccessContext, BASE_ADMINS, SUPER_ADMINS } from '@/admin/access';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Gate de autenticación con Firebase Auth (email/contraseña o Google) + allowlist de correos.
// VITE_ADMIN_EMAILS sobreescribe la lista; mantenerla igual que firestore.rules y functions/index.js.

// Admins base (mismos que firestore.rules/storage.rules y functions/index.js). VITE_ADMIN_EMAILS SUMA correos,
// nunca reemplaza: antes un .env con otra lista dejaba fuera a estas cuentas y el login con Google era rechazado.
const EMAILS_ENV = `${BASE_ADMINS.join(',')},${import.meta.env.VITE_ADMIN_EMAILS || ''}`;

/** Acceso de un correo: admin base (todo) o isAdmin/{correo} activo (sección Accesos). null = sin acceso. */
async function resolveAccess(mail, allowed) {
  const email = mail.toLowerCase();
  const isSuper = SUPER_ADMINS.includes(email);
  if (allowed.includes(email)) return { email, isSuper, permissions: 'all' };
  try {
    const snap = await getDoc(doc(db, 'isAdmin', email));
    if (snap.exists() && snap.data().active !== false) {
      const p = snap.data().permissions;
      return { email, isSuper, permissions: p === 'all' || !Array.isArray(p) ? 'all' : p };
    }
  } catch { /* sin permiso de lectura = no es admin */ }
  return null;
}

// Mensajes claros para los fallos de Google más comunes (el código crudo no ayuda a nadie).
const GOOGLE_ERRORS = {
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados: agrega borealabs.org).',
  'auth/operation-not-allowed': 'El acceso con Google no está habilitado en Firebase (Authentication → Método de acceso → Google).',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google; te redirigimos para continuar.',
  'auth/network-request-failed': 'Sin conexión con Google. Revisa tu internet e intenta de nuevo.',
};

export default function AdminGate({ children }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [access, setAccess] = useState(null);
  const authed = !!access;
  const [submitting, setSubmitting] = useState(false);

  const allowedEmails = useMemo(() => [...new Set(EMAILS_ENV.split(',').map(e => e.trim().toLowerCase()).filter(Boolean))], []);

  useEffect(() => {
    if (!auth) return;
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    // Si se usó el respaldo por redirección, aquí llega su resultado (o su error).
    getRedirectResult(auth).catch((err) => {
      toast({ title: 'No se pudo ingresar con Google', description: GOOGLE_ERRORS[err?.code] || err?.code || 'Error desconocido', variant: 'destructive' });
    });
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAccess(user?.email ? await resolveAccess(user.email, allowedEmails) : null);
    });
    return () => unsub();
  }, [allowedEmails]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      if (!(await resolveAccess(user.email, allowedEmails))) {
        await signOut(auth);
        toast({ title: 'Acceso denegado', description: `${user.email} no tiene acceso al panel.`, variant: 'destructive' });
        return;
      }
      toast({ title: 'Acceso concedido', description: 'Sesión iniciada con Firebase' });
    } catch {
      toast({ title: 'No se pudo ingresar', description: 'Correo o contraseña incorrectos', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      let user;
      try {
        ({ user } = await signInWithPopup(auth, provider));
      } catch (err) {
        // Ventana bloqueada o no soportada (Safari/iOS, navegadores embebidos): seguir por redirección.
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(err?.code)) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw err;
      }
      if (!(await resolveAccess(user.email || '', allowedEmails))) {
        await signOut(auth);
        toast({ title: 'Acceso denegado', description: `${user.email} no está en la lista de administradores.`, variant: 'destructive' });
        return;
      }
      toast({ title: 'Acceso concedido', description: 'Sesión iniciada con Google' });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast({ title: 'No se pudo ingresar con Google', description: GOOGLE_ERRORS[err?.code] || err?.code || 'Error desconocido', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    signOut(auth).finally(() => setAccess(null));
  };

  // Modo de prueba: sin login. `import.meta.env.MODE` es 'production' en todo build, así que esto no se publica.
  if (import.meta.env.MODE === 'demo') {
    return <AccessContext.Provider value={{ email: auth?.currentUser?.email, isSuper: true, permissions: 'all' }}>{children}</AccessContext.Provider>;
  }

  if (!auth) {
    return <div className="max-w-md mx-auto pt-24 sm:pt-28 px-4 text-white">Panel no disponible: Firebase no está configurado.</div>;
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto pt-24 sm:pt-28 px-4 text-white">
        <h1 className="text-2xl font-bold mb-6">Acceso administrativo</h1>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white/5 border border-white/10 rounded-lg p-6">
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@borealabs.org" className="mt-1" required />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" required />
          </div>
          <button type="submit" disabled={submitting} className={`w-full rounded-md px-4 py-2 font-medium transition-colors ${submitting ? 'bg-white/10 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-black'}`}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
          <button type="button" onClick={handleGoogle} disabled={submitting} className="w-full min-h-[44px] rounded-md px-4 py-2 font-medium border border-white/20 bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Ingresar con Google
          </button>
          <p className="text-xs opacity-70">Este acceso usa Firebase Authentication (email/contraseña o Google) y una lista de correos permitidos.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Botón de cerrar sesión eliminado; ahora está dentro del menú del panel Admin */}
      <AccessContext.Provider value={access}>{children}</AccessContext.Provider>
    </div>
  );
}
