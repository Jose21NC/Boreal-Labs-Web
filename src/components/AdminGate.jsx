import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { auth } from '@/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Gate de autenticación con Firebase Auth (email/contraseña) + allowlist de correos
// VITE_ADMIN_EMAILS=correo1@dom.com,correo2@dom.com

const EMAILS_ENV = import.meta.env.VITE_ADMIN_EMAILS || '';
const STORAGE_KEY = 'admin:isAuthed';

export default function AdminGate({ children }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allowedEmails = useMemo(() => EMAILS_ENV.split(',').map(e => e.trim().toLowerCase()).filter(Boolean), []);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email && allowedEmails.includes(user.email.toLowerCase())) {
        try { sessionStorage.setItem(STORAGE_KEY, 'true'); } catch {}
        setAuthed(true);
      } else {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
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
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    signOut(auth).finally(() => setAuthed(false));
  };

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
          <p className="text-xs opacity-70">Este acceso usa Firebase Authentication (email/contraseña) y una lista de correos permitidos.</p>
        </form>
      </div>
    );
  }

  // Detecta si está en /admin/layout
  const isLayoutEditor = typeof window !== 'undefined' && window.location.pathname === '/admin/layout';
  return (
    <div className="relative">
      {/* Botón de cerrar sesión eliminado; ahora está dentro del menú del panel Admin */}
      {children}
    </div>
  );
}
