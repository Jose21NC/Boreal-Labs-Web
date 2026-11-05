// Acreditar por evento: suma créditos a los voluntarios inscritos (y presentes) en un evento de voluntariado.
// La asistencia se marca en /admin/eventos; aquí solo se otorgan los créditos.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { Badge, Button, Checkbox, Field, Input, Modal, Select, Skeleton } from '@/admin/ui';
import { formatDate, isPresent, normalize } from '@/admin/lib';
import { creditEventParticipants } from './actions';
import { emailKey, round2 } from './utils';

const isVolunteerEvent = (e) => [e.category, e.categoryName].flat().some((c) => normalize(c).includes('volunt'));

export default function EventCreditsModal({ byEmail, logs, onClose }) {
  const { toast } = useToast();
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState('');
  const [regs, setRegs] = useState(null);
  const [onlyPresent, setOnlyPresent] = useState(true);
  const [credits, setCredits] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'events'))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isVolunteerEvent);
        setEvents(list);
        if (list[0]) setEventId(list[0].id);
      })
      .catch((error) => { console.error(error); setEvents([]); toast({ title: 'No se pudieron cargar los eventos', description: error.message, variant: 'destructive' }); });
  }, [toast]);

  const event = events?.find((e) => e.id === eventId);

  useEffect(() => {
    if (!event) return;
    setRegs(null);
    // Registros nuevos traen eventId; los viejos solo eventName.
    Promise.all([
      getDocs(query(collection(db, 'registrations'), where('eventId', '==', event.id))),
      getDocs(query(collection(db, 'registrations'), where('eventName', '==', event.title))),
    ])
      .then(([a, b]) => {
        const map = new Map();
        [...a.docs, ...b.docs].forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        setRegs([...map.values()]);
      })
      .catch((error) => { console.error(error); setRegs([]); toast({ title: 'No se pudieron cargar los inscritos', description: error.message, variant: 'destructive' }); });
  }, [event, toast]);

  const rows = useMemo(() => {
    if (!regs || !event) return [];
    const already = new Set(logs
      .filter((l) => l.creditsGeneratedFromEvent && (l.sourceEventId === event.id || l.sourceEventName === event.title))
      .map((l) => emailKey(l.email)));
    return regs
      .filter((r) => !onlyPresent || isPresent(r.statusAsistencia))
      .map((r) => {
        const volunteer = byEmail.get(emailKey(r.userEmail));
        const status = !volunteer ? 'missing' : already.has(emailKey(r.userEmail)) ? 'done' : 'ok';
        return { reg: r, volunteer, status };
      })
      .sort((a, b) => a.status.localeCompare(b.status) || String(a.reg.userName).localeCompare(String(b.reg.userName)));
  }, [regs, event, logs, byEmail, onlyPresent]);

  const targets = rows.filter((r) => r.status === 'ok');
  const amount = round2(Number(credits));
  const valid = event && targets.length > 0 && amount > 0;

  const submit = async () => {
    setSaving(true);
    try {
      await creditEventParticipants(event, targets.map((t) => t.volunteer), amount);
      toast({ title: 'Créditos otorgados', description: `${amount} crédito(s) a ${targets.length} voluntario(s) por "${event.title}".` });
      onClose();
    } catch (error) {
      console.error(error);
      toast({ title: 'No se pudieron otorgar los créditos', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Acreditar por evento"
      description="Otorga créditos a los voluntarios que asistieron a un evento de voluntariado."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!valid}>
            Acreditar a {targets.length} voluntario(s)
          </Button>
        </>
      )}
    >
      {events === null ? (
        <Skeleton className="h-40 w-full" />
      ) : events.length === 0 ? (
        <p className="py-6 text-center text-sm text-adm-muted">
          No hay eventos con categoría de voluntariado. Créalos en <Link to="/admin/eventos" className="text-adm-accent hover:underline">Eventos</Link>.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Evento">
              <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {formatDate(e.date)}</option>)}
              </Select>
            </Field>
            <Field label="Créditos c/u" hint={amount > 0 ? `= ${amount * 2} h` : 'Mayor a 0'}>
              <Input type="number" min="0.5" step="0.5" value={credits} onChange={(e) => setCredits(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Checkbox checked={onlyPresent} onChange={(e) => setOnlyPresent(e.target.checked)} label="Solo quienes asistieron" />
            <Link to="/admin/eventos" className="text-xs text-adm-accent hover:underline">Marcar asistencia en Eventos →</Link>
          </div>
          {regs === null ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="rounded-lg bg-adm-surface-2 py-6 text-center text-sm text-adm-muted">
              {onlyPresent ? 'Nadie tiene asistencia marcada en este evento.' : 'Este evento no tiene inscritos.'}
            </p>
          ) : (
            <ul className="divide-y divide-adm-border rounded-lg border border-adm-border">
              {rows.map(({ reg, status }) => (
                <li key={reg.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-adm-text">{reg.userName || '—'}</p>
                    <p className="truncate text-xs text-adm-muted">{reg.userEmail}</p>
                  </div>
                  {status === 'ok' && <Badge tone="success">Se acreditará</Badge>}
                  {status === 'done' && <Badge>Ya acreditado</Badge>}
                  {status === 'missing' && <Badge tone="warning">No es voluntario</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
