import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { auth } from '@/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Gate de autenticación con Firebase Auth (email/contraseña o Google) + allowlist de correos.
// VITE_ADMIN_EMAILS sobreescribe la lista; mantenerla igual que firestore.rules y functions/index.js.

const EMAILS_ENV = import.meta.env.VITE_ADMIN_EMAILS || 'contacto@borealabs.org,admin@borealabs.org,jose@borealabs.org';

export default function AdminGate({ children }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allowedEmails = useMemo(() => EMAILS_ENV.split(',').map(e => e.trim().toLowerCase()).filter(Boolean), []);

  useEffect(() => {
    if (!auth) return;
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email && allowedEmails.includes(user.email.toLowerCase())) {
        setAuthed(true);
      } else {
        setAuthed(false);
      }
    });
    return () => unsub();
  }, [allowedEmails]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const okEmail = allowedEmails.includes((email || '').toLowerCase());
      if (!okEmail) {
        toast({ title: 'Acceso denegado', description: 'Este correo no está permitido', variant: 'destructive' });
        return;
      }
      await signInWithEmailAndPassword(auth, email, password);
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
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      if (!allowedEmails.includes((user.email || '').toLowerCase())) {
        await signOut(auth);
        toast({ title: 'Acceso denegado', description: 'Esta cuenta de Google no está permitida', variant: 'destructive' });
        return;
      }
      toast({ title: 'Acceso concedido', description: 'Sesión iniciada con Google' });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast({ title: 'No se pudo ingresar con Google', description: err?.code || 'Error desconocido', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    signOut(auth).finally(() => setAuthed(false));
  };

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
      {children}
    </div>
  );
}
