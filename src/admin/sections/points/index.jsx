// Puntos: saldos de userPoints agrupados por correo, ajustes manuales, historial, ranking y códigos QR de la Wallet.
import React, { useDeferredValue, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Coins, Download, History, Plus, QrCode, SlidersHorizontal, Trophy, Users } from 'lucide-react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, SearchInput, Skeleton, StatCard, TD, TH, THead, TR, Table, Tabs,
} from '@/admin/ui';
import { downloadCsv, formatDateTime, formatRelative, normalize, toDate } from '@/admin/lib';
import AdjustDialog from './AdjustDialog';
import HistoryDialog from './HistoryDialog';
import Codes from './Codes';
import { codeUses, groupByEmail } from './wallet';

const PAGE = 500; // "Mostrar más" solo aparece con más de 500 personas
const SORTERS = {
  email: (u) => normalize(u.name || u.email),
  balance: (u) => Number(u.balance) || 0,
  updated: (u) => toDate(u.updatedAt)?.getTime() || 0,
};

export default function PointsSection() {
  const { toast } = useToast();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search); // filtra sin bloquear el tecleo
  const [sort, setSort] = useState({ key: 'balance', dir: 'desc' });
  const [limit, setLimit] = useState(PAGE);
  const [adjustId, setAdjustId] = useState(undefined); // undefined = cerrado, null = nuevo
  const [historyId, setHistoryId] = useState(null);
  const [names, setNames] = useState(new Map());
  const [codes, setCodes] = useState(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'codigos' ? 'codigos' : 'saldos';

  useEffect(() => {
    if (!db) { setUsers([]); return undefined; }
    return onSnapshot(collection(db, 'userPoints'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error cargando userPoints:', error);
      toast({ title: 'No se pudieron cargar los puntos', description: error.message, variant: 'destructive' });
      setUsers([]);
    });
  }, [toast]);

  useEffect(() => {
    if (!db) { setCodes([]); return undefined; }
    return onSnapshot(collection(db, 'pointCodes'), (snap) => setCodes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (error) => {
      console.error('Error cargando pointCodes:', error);
      setCodes([]);
    });
  }, []);

  // Nombre visible: el del certificado o la inscripción con ese correo (si no hay, se muestra el correo).
  useEffect(() => {
    if (!db) return;
    Promise.all(['registrations', 'certificados'].map((c) => getDocs(collection(db, c)).catch(() => ({ docs: [] }))))
      .then(([regs, certs]) => {
        const m = new Map();
        regs.docs.forEach((d) => { const r = d.data(); if (r.userEmail && r.userName) m.set(r.userEmail.toLowerCase(), r.userName); });
        certs.docs.forEach((d) => { const c = d.data(); if (c.correoUsuario && c.nombreUsuario) m.set(c.correoUsuario.toLowerCase(), c.nombreUsuario); });
        setNames(m);
      });
  }, []);

  const list = useMemo(() => groupByEmail(users || []).map((p) => ({ ...p, name: names.get(p.email) || '' })), [users, names]);
  const stats = useMemo(() => {
    const total = list.reduce((acc, u) => acc + u.balance, 0);
    return { count: list.length, total, redeemed: (codes || []).reduce((acc, c) => acc + codeUses(c), 0) };
  }, [list, codes]);

  const top = useMemo(() => [...list].sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0)).slice(0, 10), [list]);

  const rows = useMemo(() => {
    const q = normalize(deferredSearch);
    const get = SORTERS[sort.key];
    return list
      .filter((u) => !q || normalize(`${u.name} ${u.email} ${u.lastEvent}`).includes(q))
      .sort((a, b) => {
        const [x, y] = [get(a), get(b)];
        const r = x < y ? -1 : x > y ? 1 : 0;
        return sort.dir === 'asc' ? r : -r;
      });
  }, [list, deferredSearch, sort]);

  const sortBy = (key) => ({
    sort: sort.key === key ? sort.dir : undefined,
    onSort: () => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' })),
  });

  const closeAdjust = useCallback(() => setAdjustId(undefined), []);
  const closeHistory = useCallback(() => setHistoryId(null), []);
  const byId = (id) => list.find((u) => u.id === id) || null;

  const exportCsv = () => downloadCsv(`puntos-${new Date().toISOString().slice(0, 10)}`, [
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Email' },
    { key: 'balance', label: 'Saldo' },
    { key: 'walletBalance', label: 'Saldo en Wallet' },
    { key: 'estado', label: 'Estado', value: statusLabel },
    { key: 'lastEvent', label: 'Último evento' },
    { key: 'updatedAt', label: 'Actualizado', value: (u) => toDate(u.updatedAt) },
  ], rows);

  const header = (
    <PageHeader
      title="Puntos"
      description="Saldos de la comunidad en la Boreal Wallet y códigos QR canjeables. Cada ajuste manual exige una nota."
      actions={tab === 'saldos' && (
        <>
          <Button onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" />CSV</Button>
          <Button variant="primary" onClick={() => setAdjustId(null)}><Plus className="h-4 w-4" />Ajustar puntos</Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Personas con puntos" value={users ? stats.count : '—'} icon={Users} />
        <StatCard label="Puntos en circulación" value={users ? stats.total.toLocaleString('es-NI') : '—'} icon={Coins} tone="success" />
        <StatCard label="Canjes de códigos" value={codes ? stats.redeemed : '—'} icon={QrCode} tone="info" />
      </div>
      <Tabs
        className="mt-4"
        value={tab}
        onChange={(v) => setParams(v === 'codigos' ? { tab: v } : {}, { replace: true })}
        items={[{ value: 'saldos', label: 'Saldos', count: users ? list.length : null }, { value: 'codigos', label: 'Códigos QR', count: codes ? codes.length : null }]}
      />
    </PageHeader>
  );

  if (tab === 'codigos') return <>{header}<Codes codes={codes} /></>;

  return (
    <>
      {header}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <div className="border-b border-adm-border p-3">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setLimit(PAGE); }} placeholder="Buscar por nombre, correo o evento…" className="sm:max-w-sm" />
          </div>
          {users === null ? (
            <div className="space-y-3 p-5" aria-busy="true">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Coins}
              title={list.length ? 'Sin resultados' : 'Nadie tiene puntos todavía'}
              description={list.length ? 'Prueba con otro nombre o correo.' : 'Los puntos se asignan al generar certificados, con un ajuste manual o con códigos QR.'}
              action={!list.length && <Button variant="primary" onClick={() => setAdjustId(null)}><Plus className="h-4 w-4" />Ajustar puntos</Button>}
            />
          ) : (
            <>
              <Table sticky>
                <THead>
                  <tr>
                    <TH {...sortBy('email')}>Persona</TH>
                    <TH {...sortBy('balance')} className="text-right">Saldo</TH>
                    <TH className="hidden md:table-cell">Último evento</TH>
                    <TH {...sortBy('updated')} className="hidden lg:table-cell">Actualizado</TH>
                    <TH className="hidden sm:table-cell">Estado</TH>
                    <TH className="text-right"><span className="sr-only">Acciones</span></TH>
                  </tr>
                </THead>
                <tbody>
                  {rows.slice(0, limit).map((u) => (
                    <TR key={u.id}>
                      <TD className="max-w-[10rem] sm:max-w-none">
                        <span className="block truncate font-medium">{u.name || u.email || <em className="text-adm-muted">sin correo</em>}</span>
                        {u.name && <span className="block truncate text-xs text-adm-muted">{u.email}</span>}
                        <span className="mt-1 flex flex-wrap gap-1 sm:hidden"><StatusBadges u={u} /></span>
                      </TD>
                      <TD className="text-right font-semibold tabular-nums" title={u.duplicate ? `Suma de ${u.docs.length} registros` : undefined}>{u.balance}</TD>
                      <TD className="hidden max-w-[14rem] truncate text-adm-muted md:table-cell">{u.lastEvent || '—'}</TD>
                      <TD className="hidden whitespace-nowrap text-xs text-adm-muted lg:table-cell" title={formatDateTime(u.updatedAt)}>{formatRelative(u.updatedAt)}</TD>
                      <TD className="hidden sm:table-cell"><span className="flex flex-wrap gap-1"><StatusBadges u={u} /></span></TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setHistoryId(u.id)} aria-label={`Historial de ${u.email}`} title="Historial"><History className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setAdjustId(u.id)} aria-label={`Ajustar puntos de ${u.email}`} title="Ajustar puntos"><SlidersHorizontal className="h-4 w-4" /></Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
              {rows.length > limit && (
                <div className="border-t border-adm-border p-3 text-center">
                  <Button size="sm" onClick={() => setLimit((n) => n + PAGE)}>Mostrar más ({rows.length - limit} restantes)</Button>
                </div>
              )}
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Top 10" description="Mayores saldos de la comunidad." actions={<Trophy className="h-4 w-4 text-adm-warning" aria-hidden="true" />} />
          <CardBody className="p-2">
            {users === null ? (
              <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : top.length === 0 ? (
              <p className="p-3 text-sm text-adm-muted">Sin datos todavía.</p>
            ) : (
              <ol>
                {top.map((u, i) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setHistoryId(u.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-adm-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent"
                    >
                      <span className={`w-6 shrink-0 text-center font-semibold tabular-nums ${i < 3 ? 'text-adm-warning' : 'text-adm-muted'}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-adm-text">{u.name || u.email}</span>
                      <span className="font-semibold tabular-nums text-adm-text">{u.balance}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Los ajustes van al doc de la Wallet (userPoints/{uid}) si existe; si no, al registro más reciente del correo. */}
      <AdjustDialog open={adjustId !== undefined} user={adjustId ? byId(adjustId)?.target || null : null} users={list.map((p) => p.target)} onClose={closeAdjust} />
      <HistoryDialog
        user={historyId ? byId(historyId) : null}
        onClose={closeHistory}
        onAdjust={(u) => { setHistoryId(null); setAdjustId(u.id); }}
      />
    </>
  );
}

const statusLabel = (u) => [u.noWallet && 'Sin cuenta Wallet', u.duplicate && 'Duplicado'].filter(Boolean).join(' · ') || 'Wallet';

function StatusBadges({ u }) {
  if (!u.noWallet && !u.duplicate) return <Badge tone="success">Wallet</Badge>;
  return (
    <>
      {u.noWallet && <Badge tone="warning" title="Ningún registro usa el id de su cuenta: la Wallet no muestra estos puntos hasta que inicie sesión y se fusionen.">Sin cuenta Wallet</Badge>}
      {u.duplicate && <Badge tone="danger" title={`${u.docs.length} registros con este correo; el saldo mostrado es la suma.`}>Duplicado</Badge>}
    </>
  );
}
