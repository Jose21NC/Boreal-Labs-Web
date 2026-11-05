// Actividad del equipo: bitácora de `adminActivity` agrupada por día, con filtros y exportación CSV.
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { Download, History, Info, DatabaseZap, SearchX } from 'lucide-react';
import { db } from '@/firebase';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, PageHeader, SearchInput, Skeleton } from '@/admin/ui';
import { downloadCsv, formatDateTime, normalize, toDate } from '@/admin/lib';
import { AREAS, ActorAvatar, actorLabel, areaOf } from './shared';

const PAGE = 50;
const dayFmt = new Intl.DateTimeFormat('es-NI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('es-NI', { hour: '2-digit', minute: '2-digit' });

function dayLabel(date) {
  if (!date) return 'Sin fecha';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const s = dayFmt.format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
        active ? 'border-adm-accent/50 bg-adm-accent/10 text-adm-accent' : 'border-adm-border bg-adm-surface text-adm-muted hover:text-adm-text',
      )}
    >
      {children}
    </button>
  );
}

export default function Activity() {
  const [max, setMax] = useState(PAGE);
  const [items, setItems] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [actor, setActor] = useState('');
  const [area, setArea] = useState('');
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q); // filtra sin bloquear el tecleo

  useEffect(() => {
    if (!db) return undefined;
    let alive = true;
    setLoadingMore(true);
    // shortcut: "Cargar más" re-lee con un límite mayor (el mock no soporta cursores); pasar a startAfter si la bitácora crece mucho.
    getDocs(query(collection(db, 'adminActivity'), orderBy('at', 'desc'), limit(max)))
      .then((snap) => { if (alive) setItems(snap.docs.map((d) => ({ id: d.id, ...d.data(), date: toDate(d.data().at) }))); })
      .catch((e) => { console.warn('[admin] No se pudo cargar la actividad', e); if (alive) setError(e); })
      .finally(() => { if (alive) setLoadingMore(false); });
    return () => { alive = false; };
  }, [max]);

  const actors = useMemo(() => {
    const map = new Map();
    (items || []).forEach((i) => { if (!map.has(i.actorEmail)) map.set(i.actorEmail, i); });
    return [...map.values()];
  }, [items]);

  const areas = useMemo(() => {
    const found = new Set((items || []).map((i) => areaOf(i.action)));
    return [...new Set([...Object.keys(AREAS), ...found])];
  }, [items]);

  const filtered = useMemo(() => {
    const term = normalize(deferredQ.trim());
    return (items || []).filter((i) => (!actor || i.actorEmail === actor)
      && (!area || areaOf(i.action) === area)
      && (!term || normalize(`${i.summary} ${i.action}`).includes(term)));
  }, [items, actor, area, deferredQ]);

  const groups = useMemo(() => {
    const out = [];
    filtered.forEach((i) => {
      const label = dayLabel(i.date);
      if (out.at(-1)?.label !== label) out.push({ label, items: [] });
      out.at(-1).items.push(i);
    });
    return out;
  }, [filtered]);

  const exportCsv = () => downloadCsv(`actividad-equipo-${new Date().toISOString().slice(0, 10)}`, [
    { key: 'at', label: 'Fecha', value: (r) => r.date },
    { key: 'actorEmail', label: 'Correo' },
    { key: 'actorName', label: 'Nombre' },
    { key: 'area', label: 'Área', value: (r) => AREAS[areaOf(r.action)] || areaOf(r.action) },
    { key: 'action', label: 'Acción' },
    { key: 'summary', label: 'Resumen' },
  ], filtered);

  const hasMore = items && items.length >= max;

  return (
    <>
      <PageHeader
        title="Actividad del equipo"
        description="Quién hizo qué y cuándo en el panel."
        actions={<Button onClick={exportCsv} disabled={!filtered.length}><Download className="h-4 w-4" aria-hidden="true" />Exportar CSV</Button>}
      >
        <div className="flex gap-3 rounded-xl border border-adm-info/30 bg-adm-info/10 p-4 text-sm text-adm-text">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-adm-info" aria-hidden="true" />
          <p>
            Cada cambio que se hace en el panel (crear o editar eventos, generar certificados, aprobar horas, editar el sitio…)
            queda registrado aquí con su autor, para que todo el equipo sepa quién hizo qué sin tener que preguntar.
          </p>
        </div>
      </PageHeader>

      {!db ? (
        <Card><EmptyState icon={DatabaseZap} title="Firebase no configurado" description="Faltan las variables VITE_FIREBASE_* en el .env local." /></Card>
      ) : error && !items ? (
        <Card><EmptyState icon={History} title="No se pudo cargar la actividad" description="Revisa tu conexión o tus permisos de administrador." /></Card>
      ) : !items ? (
        <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <>
          <div className="mb-5 space-y-3">
            <SearchInput value={q} onChange={setQ} placeholder="Buscar en la actividad…" className="max-w-md" />
            {actors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por persona">
                <Chip active={!actor} onClick={() => setActor('')}>Todo el equipo</Chip>
                {actors.map((a) => (
                  <Chip key={a.actorEmail} active={actor === a.actorEmail} onClick={() => setActor(actor === a.actorEmail ? '' : a.actorEmail)}>
                    <ActorAvatar item={a} className="-ml-2 h-6 w-6 text-[10px]" />{actorLabel(a)}
                  </Chip>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por área">
              <Chip active={!area} onClick={() => setArea('')}>Todas las áreas</Chip>
              {areas.map((a) => (
                <Chip key={a} active={area === a} onClick={() => setArea(area === a ? '' : a)}>{AREAS[a] || a}</Chip>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <Card>
              {items.length === 0
                ? <EmptyState icon={History} title="Aún no hay actividad" description="Cuando alguien del equipo haga un cambio en el panel aparecerá aquí." />
                : <EmptyState icon={SearchX} title="Sin resultados" description="Prueba con otros filtros." action={<Button size="sm" onClick={() => { setActor(''); setArea(''); setQ(''); }}>Limpiar filtros</Button>} />}
            </Card>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.label} aria-label={g.label}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-adm-muted">{g.label}</h2>
                  <Card>
                    <ol className="divide-y divide-adm-border">
                      {g.items.map((i) => (
                        <li key={i.id} className="flex gap-3 px-4 py-3 sm:px-5">
                          <ActorAvatar item={i} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-adm-text">{i.summary || i.action}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-adm-muted">
                              <span className="truncate">{actorLabel(i)}</span>
                              <Badge className="py-0">{AREAS[areaOf(i.action)] || areaOf(i.action)}</Badge>
                            </p>
                          </div>
                          <time dateTime={i.date?.toISOString()} title={formatDateTime(i.date)} className="shrink-0 text-xs tabular-nums text-adm-muted">
                            {i.date ? timeFmt.format(i.date) : '—'}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </Card>
                </section>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-adm-muted">Mostrando {filtered.length} de {items.length} acciones cargadas</p>
            {hasMore && <Button onClick={() => setMax((m) => m + PAGE)} loading={loadingMore}>Cargar más</Button>}
          </div>
        </>
      )}
    </>
  );
}
