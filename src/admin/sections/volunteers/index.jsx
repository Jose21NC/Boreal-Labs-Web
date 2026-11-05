// Sección Voluntariado: voluntarios, aprobación de horas (créditos) y cobertura por turno.
import React, { useMemo, useState } from 'react';
import { Link, Route, Routes, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BadgeDollarSign, CalendarCheck, ClipboardCheck, Clock, Users } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, Tabs } from '@/admin/ui';
import useVolunteerData from './useVolunteerData';
import VolunteersTab from './VolunteersTab';
import ApprovalsTab from './ApprovalsTab';
import AvailabilityTab from './AvailabilityTab';
import VolunteerDetail from './VolunteerDetail';
import EventCreditsModal from './EventCreditsModal';
import { logCredits, logStatus, round2 } from './utils';

function Overview({ volunteers, logs, byEmail, loading }) {
  const [params, setParams] = useSearchParams();
  const [eventCredits, setEventCredits] = useState(false);
  const tab = params.get('tab') || 'voluntarios';
  const setTab = (value) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', value); return n; }, { replace: true });

  const stats = useMemo(() => logs.reduce((acc, l) => {
    const st = logStatus(l);
    if (st === 'pending') { acc.pending += 1; acc.pendingCredits += logCredits(l); }
    if (st === 'approved') acc.hours += Number(l.registeredHours) || 0;
    return acc;
  }, { pending: 0, pendingCredits: 0, hours: 0 }), [logs]);
  const totalCredits = useMemo(() => round2(volunteers.reduce((a, v) => a + (Number(v.creditos) || 0), 0)), [volunteers]);

  const tabs = [
    { value: 'voluntarios', label: 'Voluntarios', count: loading ? undefined : volunteers.length },
    {
      value: 'aprobaciones',
      label: (
        <>
          Aprobaciones de horas
          {stats.pending > 0 && <Badge tone="warning" aria-label={`${stats.pending} pendientes`}>{stats.pending}</Badge>}
        </>
      ),
    },
    { value: 'disponibilidad', label: 'Disponibilidad' },
  ];

  return (
    <div>
      <PageHeader
        title="Voluntariado"
        description="Inscripciones, aprobación de horas y créditos (1 crédito = 2 horas). Los créditos solo los otorga el equipo."
        actions={(
          <>
            <Button variant="outline" onClick={() => setEventCredits(true)}><CalendarCheck className="h-4 w-4" aria-hidden="true" /> Acreditar por evento</Button>
            <Button variant="primary" onClick={() => setTab('aprobaciones')} disabled={!stats.pending}>
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Revisar pendientes
            </Button>
          </>
        )}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Voluntarios" value={loading ? '…' : volunteers.length} icon={Users} onClick={() => setTab('voluntarios')} />
        <StatCard
          label="Horas por aprobar"
          value={loading ? '…' : stats.pending}
          hint={`${round2(stats.pendingCredits)} crédito(s) en espera`}
          icon={ClipboardCheck}
          tone="warning"
          onClick={() => setTab('aprobaciones')}
        />
        <StatCard label="Horas aprobadas" value={loading ? '…' : round2(stats.hours)} icon={Clock} tone="success" />
        <StatCard label="Créditos otorgados" value={loading ? '…' : totalCredits} hint="Suma de todos los voluntarios" icon={BadgeDollarSign} tone="info" />
      </div>
      <Tabs items={tabs} value={tab} onChange={setTab} className="mb-4" />
      {tab === 'aprobaciones' && <ApprovalsTab logs={logs} byEmail={byEmail} loading={loading} />}
      {tab === 'disponibilidad' && (
        <AvailabilityTab
          volunteers={volunteers}
          loading={loading}
          onPick={(turno) => setParams({ tab: 'voluntarios', turno }, { replace: true })}
        />
      )}
      {tab !== 'aprobaciones' && tab !== 'disponibilidad' && <VolunteersTab volunteers={volunteers} loading={loading} />}
      <p className="mt-6 text-xs text-adm-muted">
        ¿Certificados para voluntarios? Genéralos en <Link to="/admin/certificados" className="text-adm-accent hover:underline">Certificados</Link>.
        Los eventos de voluntariado se crean en <Link to="/admin/eventos" className="text-adm-accent hover:underline">Eventos</Link>.
      </p>
      {eventCredits && <EventCreditsModal byEmail={byEmail} logs={logs} onClose={() => setEventCredits(false)} />}
    </div>
  );
}

export default function VolunteersSection() {
  const data = useVolunteerData();
  if (data.error) {
    return (
      <Card>
        <EmptyState icon={AlertTriangle} title="No se pudieron cargar los datos de voluntariado" description={data.error.message} />
      </Card>
    );
  }
  return (
    <Routes>
      <Route index element={<Overview {...data} />} />
      <Route path=":id" element={<VolunteerDetail {...data} />} />
    </Routes>
  );
}
