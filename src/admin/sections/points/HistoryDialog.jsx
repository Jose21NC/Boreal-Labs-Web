// Historial de una persona: une adminGrants, redemptions (códigos) y purchases (tienda) de todos sus docs de userPoints.
import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { Badge, Button, EmptyState, Modal, Skeleton } from '@/admin/ui';
import { downloadCsv, formatDateTime, toDate } from '@/admin/lib';

const TYPE_LABELS = {
  'manual-adjustment': 'Ajuste manual', 'manual-adjust': 'Ajuste manual', 'manual-award': 'Asignación por evento',
  'certificate-award': 'Certificado', redemption: 'Canje de código', purchase: 'Compra',
};

// Cada subcolección guarda la fecha y el monto con nombres distintos; se normalizan a un solo formato.
const SOURCES = {
  adminGrants: (g) => ({ ...g, at: g.grantedAt }),
  redemptions: (r) => ({ ...r, at: r.redeemedAt, type: 'redemption', note: r.code ? `Código ${r.code}` : '', grantedBy: r.userEmail }),
  purchases: (p) => ({ ...p, at: p.purchasedAt, amount: -(Number(p.total) || 0), type: 'purchase', note: `${p.quantity || 1}× ${p.name || 'producto'}`, grantedBy: p.userEmail }),
};

export default function HistoryDialog({ user, onClose, onAdjust }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !db) return undefined;
    let alive = true;
    setItems(null);
    setError('');
    const reads = user.docs.flatMap((u) => Object.entries(SOURCES).map(([sub, map]) => getDocs(collection(db, 'userPoints', u.id, sub))
      .then((snap) => snap.docs.map((d) => map({ id: `${u.id}/${sub}/${d.id}`, ...d.data() })))));
    Promise.all(reads)
      .then((lists) => alive && setItems(lists.flat().sort((a, b) => (toDate(b.at)?.getTime() || 0) - (toDate(a.at)?.getTime() || 0))))
      .catch((e) => { console.error('Error cargando historial:', e); if (alive) { setError(e.message); setItems([]); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar solo al cambiar de usuario
  }, [user?.id]);

  const exportCsv = () => downloadCsv(`puntos-${user.email}`, [
    { key: 'at', label: 'Fecha', value: (r) => formatDateTime(r.at) },
    { key: 'amount', label: 'Puntos' },
    { key: 'type', label: 'Tipo', value: (r) => TYPE_LABELS[r.type] || r.type },
    { key: 'note', label: 'Nota' },
    { key: 'grantedBy', label: 'Por' },
  ], items || []);

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Historial de puntos"
      description={user ? `${user.email} · saldo ${user.balance ?? 0}${user.duplicate ? ` (suma de ${user.docs.length} registros)` : ''}` : ''}
      size="lg"
      footer={(
        <>
          <Button onClick={exportCsv} disabled={!items?.length}>Exportar CSV</Button>
          <Button variant="primary" onClick={() => onAdjust(user)}>Ajustar puntos</Button>
        </>
      )}
    >
      {items === null ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title={error ? 'No se pudo cargar el historial' : 'Sin movimientos registrados'}
          description={error || 'Los puntos asignados antes del registro de historial no aparecen aquí.'}
        />
      ) : (
        <ol className="divide-y divide-adm-border">
          {items.map((g) => {
            const amount = Number(g.amount) || 0;
            return (
              <li key={g.id} className="flex items-start gap-3 py-3">
                <span className={`w-14 shrink-0 text-right font-semibold tabular-nums ${amount < 0 ? 'text-adm-danger' : 'text-adm-success'}`}>
                  {amount > 0 ? `+${amount}` : amount}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm text-adm-text">{g.note || 'Sin nota'}</p>
                  <p className="mt-0.5 text-xs text-adm-muted">
                    {formatDateTime(g.at)} · {g.grantedBy || 'desconocido'}
                  </p>
                </div>
                <Badge tone={{ 'manual-adjustment': 'warning', 'manual-adjust': 'warning', redemption: 'success', purchase: 'neutral' }[g.type] || 'info'}>{TYPE_LABELS[g.type] || g.type || 'Otro'}</Badge>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
