import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard, CalendarDays, Award, FileImage, HeartHandshake, Users, Star, Globe, History,
  Menu, X, Sun, Moon, Monitor, LogOut, Search, FlaskConical, ExternalLink, ShieldCheck,
} from 'lucide-react';
import { canSee, sectionOfPath, useAccess } from './access';
import { auth } from '@/firebase';
import { cn } from '@/lib/utils';
import { Button, ConfirmProvider, Kbd } from './ui';

export const NAV = [
  { group: 'General', items: [
    { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true, keywords: 'inicio dashboard' },
    { to: '/admin/actividad', label: 'Actividad del equipo', icon: History, keywords: 'bitácora historial log' },
  ] },
  { group: 'Eventos', items: [
    { to: '/admin/eventos', label: 'Eventos y asistencia', icon: CalendarDays, keywords: 'registros inscritos asistencia' },
    { to: '/admin/certificados', label: 'Certificados', icon: Award, keywords: 'generar pdf emitir' },
    { to: '/admin/plantillas', label: 'Plantillas', icon: FileImage, keywords: 'diseño layout pdf editor' },
    { to: '/admin/puntos', label: 'Puntos', icon: Star, keywords: 'comunidad balance' },
  ] },
  { group: 'Comunidad', items: [
    { to: '/admin/voluntariado', label: 'Voluntariado', icon: HeartHandshake, keywords: 'voluntarios horas créditos' },
    { to: '/admin/equipo', label: 'Equipo', icon: Users, keywords: 'miembros staff directiva' },
  ] },
  { group: 'Sitio', items: [
    { to: '/admin/sitio', label: 'Contenido del sitio', icon: Globe, keywords: 'home enlaces aliados partners' },
    { to: '/admin/accesos', label: 'Accesos', icon: ShieldCheck, keywords: 'permisos administradores usuarios correos' },
  ] },
];

/** Menú filtrado por los permisos del usuario (secciones de la colección isAdmin). */
const useNav = () => {
  const access = useAccess();
  return useMemo(() => NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(access, sectionOfPath(i.to))) }))
    .filter((g) => g.items.length), [access]);
};

const ALL_ITEMS = NAV.flatMap((g) => g.items);
const THEME_KEY = 'admin:theme';
const IS_DEMO = import.meta.env.MODE === 'demo';

function useAdminTheme() {
  const [pref, setPref] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const update = (next) => {
    // Corta transiciones durante el cambio de tema (ver .admin-root[data-theme-switching] en index.css).
    const root = document.querySelector('.admin-root');
    root?.setAttribute('data-theme-switching', '');
    requestAnimationFrame(() => requestAnimationFrame(() => root?.removeAttribute('data-theme-switching')));
    setPref(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* modo privado */ }
  };
  const resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
  return { pref, resolved, setPref: update };
}

function ThemeToggle({ pref, setPref }) {
  const options = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Tema" className="flex rounded-lg border border-adm-border bg-adm-surface p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          title={label}
          onClick={() => setPref(value)}
          className={cn(
            'rounded-md p-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
            pref === value ? 'bg-adm-surface-2 text-adm-text' : 'text-adm-muted hover:text-adm-text',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

function SidebarNav({ onNavigate }) {
  const nav = useNav();
  return (
    <nav aria-label="Secciones del panel" className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
      {nav.map((group) => (
        <div key={group.group}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-adm-muted">{group.group}</p>
          <ul className="space-y-0.5">
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) => cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
                    // Indicador activo: barra de acento a la izquierda (estático: navegar es frecuente).
                    "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-adm-accent before:content-['']",
                    isActive ? 'bg-adm-accent/10 text-adm-accent before:opacity-100' : 'text-adm-muted before:opacity-0 hover:bg-adm-surface-2 hover:text-adm-text',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Paleta de comandos (⌘K / Ctrl+K): ir a cualquier sección o cambiar el tema sin usar el mouse. */
function CommandPalette({ open, onClose, setPref }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const allowedItems = useNav().flatMap((g) => g.items);

  const commands = useMemo(() => [
    ...allowedItems.map((item) => ({ id: item.to, label: `Ir a ${item.label}`, icon: item.icon, keywords: item.keywords, run: () => navigate(item.to) })),
    { id: 'theme-light', label: 'Tema claro', icon: Sun, keywords: 'modo luz', run: () => setPref('light') },
    { id: 'theme-dark', label: 'Tema oscuro', icon: Moon, keywords: 'modo noche', run: () => setPref('dark') },
    { id: 'site', label: 'Abrir sitio público', icon: ExternalLink, keywords: 'web', run: () => window.open('/', '_blank', 'noopener') },
  ], [navigate, setPref, allowedItems]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords || ''}`.toLowerCase().includes(term));
  }, [commands, q]);

  // Se limpia al cerrar (no al abrir): así nunca se ve la búsqueda anterior ni se pisa lo que se teclea tras ⌘K.
  useEffect(() => {
    if (!open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  if (!open) return null;
  const run = (cmd) => { onClose(); cmd.run(); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[active]) run(results[active]);
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="adm-fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Paleta de comandos" className="adm-pop relative w-full max-w-lg overflow-hidden rounded-xl border border-adm-border bg-adm-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-adm-border px-4">
          <Search className="h-4 w-4 text-adm-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Buscar sección o acción…"
            aria-label="Buscar sección o acción"
            className="h-12 w-full bg-transparent text-sm text-adm-text placeholder:text-adm-muted focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-adm-muted">Sin resultados</li>}
          {results.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <li key={cmd.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(cmd)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none', i === active ? 'bg-adm-surface-2 text-adm-text' : 'text-adm-muted')}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {cmd.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { pref, resolved, setPref } = useAdminTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = auth?.currentUser;

  const current = useMemo(
    () => [...ALL_ITEMS].sort((a, b) => b.to.length - a.to.length).find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))),
    [location.pathname],
  );

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);
  // Primera carga sin animación: solo se anima al navegar entre secciones.
  const animateSections = useRef(false);
  useEffect(() => { animateSections.current = true; }, []);

  const logout = async () => {
    try { await signOut(auth); } finally { navigate('/'); }
  };

  return (
    <MotionConfig reducedMotion="user">
    <div data-theme={resolved} className="admin-root min-h-screen bg-adm-bg font-sans text-adm-text antialiased">
      <Helmet>
        <title>{current ? `${current.label} · Admin Boreal Labs` : 'Admin Boreal Labs'}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <ConfirmProvider>
        {/* Sidebar escritorio */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-adm-border bg-adm-surface lg:flex">
          <div className="flex h-16 items-center gap-2 border-b border-adm-border px-5">
            {/* El logo trae texto blanco: en tema claro invert + hue-rotate lo vuelve oscuro conservando el azul. */}
            <img src="/logoBoreal.svg" alt="" className="h-7 w-auto [[data-theme=light]_&]:hue-rotate-180 [[data-theme=light]_&]:invert" />
            <span className="text-sm font-semibold">Admin</span>
          </div>
          <SidebarNav />
        </aside>

        {/* Drawer móvil */}
        <AnimatePresence>
          {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            />
            <motion.aside
              className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-adm-border bg-adm-surface shadow-2xl"
              initial={{ x: '-100%' }}
              animate={{ x: 0, transition: { duration: 0.26, ease: [0.32, 0.72, 0, 1] } }}
              exit={{ x: '-100%', transition: { duration: 0.18, ease: 'easeOut' } }}
            >
              <div className="flex h-16 items-center justify-between border-b border-adm-border px-5">
                <span className="text-sm font-semibold">Boreal Labs · Admin</span>
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menú"><X className="h-4 w-4" /></Button>
              </div>
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </div>
          )}
        </AnimatePresence>

        <div className="lg:pl-64">
          {IS_DEMO && (
            <div className="flex items-center justify-center gap-2 bg-adm-warning/15 px-4 py-1.5 text-xs font-medium text-adm-warning">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Modo de prueba: datos ficticios en este navegador, sin login y sin conexión a Firebase.
            </div>
          )}
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-adm-border/80 bg-adm-bg/80 px-4 backdrop-blur-md backdrop-saturate-150 sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
              <Menu className="h-5 w-5" />
            </Button>
            <p className="truncate text-sm font-medium text-adm-muted">{current?.label || 'Panel'}</p>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden h-9 items-center gap-2 rounded-lg border border-adm-border bg-adm-surface px-3 text-sm text-adm-muted transition-colors duration-150 hover:border-adm-muted/40 hover:text-adm-text sm:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Buscar
                <Kbd>⌘K</Kbd>
              </button>
              <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Buscar">
                <Search className="h-4 w-4" />
              </Button>
              <ThemeToggle pref={pref} setPref={setPref} />
              <div className="hidden items-center gap-2 border-l border-adm-border pl-3 md:flex">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-adm-accent/15 text-xs font-semibold uppercase text-adm-accent" aria-hidden="true">
                  {(user?.displayName || user?.email || '?').slice(0, 1)}
                </div>
                <span className="max-w-[160px] truncate text-xs text-adm-muted">{user?.email}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {/* Fade + 6px al cambiar de sección (CSS: corre fuera del hilo principal mientras carga el chunk). */}
            <div key={current?.to || 'admin'} className={animateSections.current ? 'adm-enter' : undefined}>
              <Outlet />
            </div>
          </div>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} setPref={setPref} />
      </ConfirmProvider>
    </div>
    </MotionConfig>
  );
}
