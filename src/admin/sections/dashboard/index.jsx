// Resumen: inicio del panel con KPIs, pendientes calculados a partir de los datos y actividad reciente.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  CalendarDays, UserPlus, Gauge, CheckCircle2, Clock, Award, Plus, ListChecks, ArrowRight, DatabaseZap, History, PartyPopper,
} from 'lucide-react';
import { auth, db } from '@/firebase';
import { cn } from '@/lib/utils';
import { Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Skeleton, StatCard } from '@/admin/ui';
import { formatDate, formatRelative, isPresent, normalize, toDate } from '@/admin/lib';
import { ActorAvatar, actorLabel } from '../activity/shared';

const DAY = 24 * 60 * 60 * 1000;
// `in` no admite "truthy": se listan las formas de "presente" que usa isPresent.
const PRESENT_VALUES = [true, 'presente', 'Presente', 'PRESENTE', 'present', 'Present'];

// Un fallo en una consulta (permisos, índice) no debe tumbar todo el resumen.
const safe = (promise, label) => promise.catch((error) => { console.warn(`[admin] Resumen: falló ${label}`, error); return null; });
const docsOf = (snap) => snap?.docs.map((d) => ({ id: d.id, ...d.data() })) || [];

async function loadDashboard() {
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const [eventsSnap, recentRegs, presentSnap, logsSnap, certsSnap, activitySnap] = await Promise.all([
    safe(getDocs(collection(db, 'events')), 'events'),
    safe(getCountFromServer(query(collection(db, 'registrations'), where('registrationDate', '>=', weekAgo))), 'inscritos 7 días'),
    safe(getDocs(query(collection(db, 'registrations'), where('statusAsistencia', 'in', PRESENT_VALUES))), 'presentes'),
    safe(getDocs(query(collection(db, 'volunteerAttendanceLogs'), where('creditsProcessed', '==', false))), 'horas pendientes'),
    safe(getDocs(collection(db, 'certificados')), 'certificados'),
    safe(getDocs(query(collection(db, 'adminActivity'), orderBy('at', 'desc'), limit(10))), 'actividad'),
  ]);

  const events = docsOf(eventsSnap).map((e) => ({ ...e, when: toDate(e.date) }));
  const lastPast = events.filter((e) => e.when && e.when < new Date()).sort((a, b) => b.when - a.when)[0] || null;
  const lastPastTotal = lastPast
    ? await safe(getCountFromServer(query(collection(db, 'registrations'), where('eventId', '==', lastPast.id))), 'inscritos último evento')
    : null;

  return {
    events,
    lastPast,
    lastPastTotal: lastPastTotal?.data().count ?? null,
    recentRegs: recentRegs?.data().count ?? null,
    present: docsOf(presentSnap).filter((r) => isPresent(r.statusAsistencia)),
    pendingLogs: docsOf(logsSnap).filter((l) => !l.rejected && l.creditStatus !== 'rejected'),
    certs: certsSnap ? docsOf(certsSnap) : null,
    activity: activitySnap ? docsOf(activitySnap) : null,
  };
}

const pct = (n) => `${Math.round(n * 100)}%`;
const hoursOf = (logs) => logs.reduce((sum, l) => sum + (Number(l.registeredHours) || 0), 0);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!db) return undefined;
    let alive = true;
    loadDashboard().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const upcoming = data.events.filter((e) => e.when && e.when >= startToday).sort((a, b) => a.when - b.when);
    const withCapacity = upcoming.filter((e) => Number(e.capacity) > 0);
    const occupancy = withCapacity.length
      ? withCapacity.reduce((sum, e) => sum + Math.min((Number(e.registeredCount) || 0) / Number(e.capacity), 1), 0) / withCapacity.length
      : null;

    const lastPastPresent = data.lastPast ? data.present.filter((r) => r.eventId === data.lastPast.id).length : 0;

    // Pendientes: presentes sin certificado (por evento, comparando correo + nombre del evento).
    const certKeys = new Set((data.certs || []).map((c) => `${normalize(c.nombreEvento)}|${normalize(c.correoUsuario)}`));
    const pastById = new Map(data.events.filter((e) => e.when && e.when < startToday).map((e) => [e.id, e]));
    const missingByEvent = new Map();
    if (data.certs) {
      data.present.forEach((r) => {
        const ev = pastById.get(r.eventId);
        if (!ev) return;
        const email = normalize(r.userEmail || r.email);
        // La función de certificados guarda el título del evento o el eventName de la inscripción.
        if (![ev.title, r.eventName].some((n) => n && certKeys.has(`${normalize(n)}|${email}`))) {
          missingByEvent.set(ev.id, { ev, count: (missingByEvent.get(ev.id)?.count || 0) + 1 });
        }
      });
    }

    const pending = [];
    if (data.pendingLogs.length) {
      pending.push({
        id: 'logs', tone: 'warning',
        text: `${data.pendingLogs.length} registro${data.pendingLogs.length === 1 ? '' : 's'} de horas de voluntariado por aprobar (${hoursOf(data.pendingLogs)} h)`,
        to: '/admin/voluntariado?tab=aprobaciones', cta: 'Revisar',
      });
    }
    [...missingByEvent.values()].forEach(({ ev, count }) => pending.push({
      id: `cert-${ev.id}`, tone: 'accent',
      text: `“${ev.title || 'Evento sin título'}”: ${count} asistente${count === 1 ? '' : 's'} sin certificado`,
      to: '/admin/certificados', cta: 'Generar',
    }));
    upcoming.filter((e) => !('registeredCount' in e)).forEach((ev) => pending.push({
      id: `cupo-${ev.id}`, tone: 'info',
      text: `“${ev.title || 'Evento sin título'}” no tiene contador de cupo: usa “Recalcular cupo”`,
      to: '/admin/eventos', cta: 'Abrir',
    }));
    withCapacity.filter((e) => (Number(e.registeredCount) || 0) / Number(e.capacity) >= 0.9).forEach((ev) => pending.push({
      id: `lleno-${ev.id}`, tone: 'danger',
      text: `“${ev.title || 'Evento sin título'}” está al ${pct(Math.min((Number(ev.registeredCount) || 0) / Number(ev.capacity), 1))} de su cupo`,
      to: '/admin/eventos', cta: 'Ver',
    }));

    return { upcoming, occupancy, lastPastPresent, pending };
  }, [data]);

  const user = auth?.currentUser;
  const name = user?.displayName || user?.email || 'equipo';
  const todayRaw = new Intl.DateTimeFormat('es-NI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  const header = (
    <PageHeader
      title={`${greeting()}, ${name.split(' ')[0]}`}
      description={today}
      actions={(
        <>
          <Button variant="primary" onClick={() => navigate('/admin/eventos?nuevo=1')}><Plus className="h-4 w-4" aria-hidden="true" />Crear evento</Button>
          <Button onClick={() => navigate('/admin/certificados')}><Award className="h-4 w-4" aria-hidden="true" />Generar certificados</Button>
          <Button onClick={() => navigate('/admin/voluntariado?tab=aprobaciones')}><Clock className="h-4 w-4" aria-hidden="true" />Aprobar horas</Button>
        </>
      )}
    />
  );

  if (!db) {
    return (
      <>
        {header}
        <Card><EmptyState icon={DatabaseZap} title="Firebase no configurado" description="Faltan las variables VITE_FIREBASE_* en el .env local, así que no hay datos que mostrar." /></Card>
      </>
    );
  }

  const loading = !stats;
  const next = stats?.upcoming[0];
  const lastPast = data?.lastPast;
  const attendance = lastPast && data.lastPastTotal ? stats.lastPastPresent / data.lastPastTotal : null;

  return (
    <>
      {header}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {loading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />) : (
          <>
            <StatCard
              label="Próximos eventos" icon={CalendarDays} value={stats.upcoming.length}
              hint={next ? `${next.title || 'Sin título'} · ${formatDate(next.when)}` : 'Ninguno programado'}
              onClick={() => navigate('/admin/eventos')}
            />
            <StatCard
              label="Inscritos (7 días)" icon={UserPlus} tone="info" value={data.recentRegs ?? '—'}
              hint="Nuevas inscripciones" onClick={() => navigate('/admin/eventos')}
            />
            <StatCard
              label="Ocupación promedio" icon={Gauge} tone={stats.occupancy >= 0.9 ? 'danger' : 'accent'}
              value={stats.occupancy == null ? '—' : pct(stats.occupancy)}
              hint="Próximos eventos con cupo" onClick={() => navigate('/admin/eventos')}
            />
            <StatCard
              label="Asistencia último evento" icon={CheckCircle2} tone="success" value={attendance == null ? '—' : pct(attendance)}
              hint={lastPast ? `${stats.lastPastPresent}/${data.lastPastTotal ?? '—'} · ${lastPast.title || 'Sin título'}` : 'Sin eventos pasados'}
              onClick={() => navigate('/admin/eventos')}
            />
            <StatCard
              label="Horas por aprobar" icon={Clock} tone={data.pendingLogs.length ? 'warning' : 'neutral'} value={hoursOf(data.pendingLogs)}
              hint={`${data.pendingLogs.length} registro${data.pendingLogs.length === 1 ? '' : 's'}`}
              onClick={() => navigate('/admin/voluntariado?tab=aprobaciones')}
            />
            <StatCard
              label="Certificados emitidos" icon={Award} tone="success" value={data.certs ? data.certs.length : '—'}
              hint="En total" onClick={() => navigate('/admin/certificados')}
            />
          </>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Pendientes del equipo" description="Se calculan a partir de los datos; desaparecen al resolverse." />
            {loading ? <CardBody className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></CardBody>
              : stats.pending.length === 0 ? (
                <EmptyState icon={PartyPopper} title="Todo al día" description="No hay horas por aprobar, certificados faltantes ni eventos llenos." className="py-10" />
              ) : (
                <ul className="divide-y divide-adm-border">
                  {stats.pending.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <ListChecks className={cn('h-4 w-4 shrink-0', TONE[p.tone])} aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-sm text-adm-text">{p.text}</span>
                      <Link to={p.to} className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-semibold text-adm-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
                        {p.cta}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Card>

          <Card>
            <CardHeader
              title="Próximos eventos"
              actions={<Link to="/admin/eventos" className="text-xs font-semibold text-adm-accent hover:underline">Ver todos</Link>}
            />
            {loading ? <CardBody className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody>
              : stats.upcoming.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No hay eventos próximos" action={<Button variant="primary" size="sm" onClick={() => navigate('/admin/eventos?nuevo=1')}>Crear evento</Button>} className="py-10" />
              ) : (
                <ul className="divide-y divide-adm-border">
                  {stats.upcoming.slice(0, 5).map((ev) => <UpcomingRow key={ev.id} ev={ev} />)}
                </ul>
              )}
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader
            title="Actividad reciente"
            actions={<Link to="/admin/actividad" className="text-xs font-semibold text-adm-accent hover:underline">Ver todo</Link>}
          />
          {loading ? <CardBody className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</CardBody>
            : !data.activity?.length ? (
              <EmptyState icon={History} title="Sin actividad registrada" description="Aquí aparecerá cada cambio que haga el equipo en el panel." className="py-10" />
            ) : (
              <ul className="space-y-4 p-5">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <ActorAvatar item={a} />
                    <div className="min-w-0 text-sm">
                      <p className="text-adm-text">{a.summary || a.action}</p>
                      <p className="mt-0.5 truncate text-xs text-adm-muted">{actorLabel(a)} · {formatRelative(a.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>
    </>
  );
}

const TONE = { warning: 'text-adm-warning', accent: 'text-adm-accent', info: 'text-adm-info', danger: 'text-adm-danger' };

function UpcomingRow({ ev }) {
  const capacity = Number(ev.capacity) || 0;
  const count = Number(ev.registeredCount) || 0;
  const ratio = capacity ? Math.min(count / capacity, 1) : 0;
  const bar = ratio >= 0.9 ? 'bg-adm-danger' : ratio >= 0.7 ? 'bg-adm-warning' : 'bg-adm-accent';
  return (
    <li className="px-5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-adm-text">{ev.title || 'Sin título'}</p>
        <span className="shrink-0 text-xs tabular-nums text-adm-muted">
          {'registeredCount' in ev ? count : '—'}{capacity ? ` / ${capacity}` : ' inscritos'}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-adm-muted">{formatDate(ev.when)}{ev.location ? ` · ${ev.location}` : ''}</p>
      {capacity > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-adm-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={count} aria-label={`Cupo de ${ev.title || 'evento'}`}>
          <div className={cn('h-full rounded-full', bar)} style={{ width: `${ratio * 100}%` }} />
        </div>
      )}
    </li>
  );
}
