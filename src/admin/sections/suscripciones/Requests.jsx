// Solicitudes del formulario público /claude: aprobar = crear cliente + registrar su primer pago (dispara la bienvenida).
import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { Check, Inbox, X } from 'lucide-react';
import { auth, db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, logActivity, toDate } from '@/admin/lib';
import { Badge, Button, Card, CardHeader, EmptyState, Modal, TD, TH, THead, TR, Table, useConfirm } from '@/admin/ui';
import { paymentPeriod } from '../../../../functions/billing.js';

const TONE = { pendiente: 'warning', aprobada: 'success', rechazada: 'neutral' };

export function Requests({ config }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  const [zoom, setZoom] = useState(null);
  useEffect(() => onSnapshot(collection(db, 'subsRequests'), (s) => setRows(
    s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)),
  )), []);

  const approve = async (r) => {
    const price = Number(config.defaultPrice) || 0;
    if (!(await confirm({ title: `Aprobar a ${r.name}`, description: `Se crea el cliente a ${price} C$/mes con primer pago hoy y se le envía el correo de bienvenida.`, confirmLabel: 'Aprobar' }))) return;
    setBusy(r.id);
    try {
      const paidAt = new Date();
      const who = auth?.currentUser?.email || 'desconocido';
      const client = { name: r.name, email: r.email, phone: r.whatsapp, price, joinedAt: paidAt, notes: 'Desde el formulario', status: 'activo', createdAt: serverTimestamp(), createdBy: who };
      // El pago va primero en el mismo lote para que la bienvenida ya lo vea.
      const clientRef = doc(collection(db, 'subsClients'));
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'subsPayments')), { clientId: clientRef.id, amount: price, paidAt, cycleKey: paymentPeriod(client, paidAt.getTime()).key, method: 'Transferencia', note: 'Comprobante del formulario', proofUrl: r.proofUrl || '', recordedBy: who, createdAt: serverTimestamp() });
      batch.set(clientRef, client);
      batch.update(doc(db, 'subsRequests', r.id), { status: 'aprobada', clientId: clientRef.id, reviewedBy: who, reviewedAt: serverTimestamp() });
      await batch.commit();
      logActivity('suscripciones.solicitud_aprobada', `Aprobó la solicitud de ${r.name}`, { id: r.id, clientId: clientRef.id });
    } catch (e) { toast({ title: 'No se pudo aprobar', description: e?.message, variant: 'destructive' }); } finally { setBusy(null); }
  };
  const reject = async (r) => {
    if (!(await confirm({ title: `Rechazar a ${r.name}`, description: 'No se le envía ningún correo.', confirmLabel: 'Rechazar' }))) return;
    try {
      await updateDoc(doc(db, 'subsRequests', r.id), { status: 'rechazada', reviewedAt: serverTimestamp() });
      logActivity('suscripciones.solicitud_rechazada', `Rechazó la solicitud de ${r.name}`, { id: r.id });
    } catch (e) { toast({ title: 'No se pudo rechazar', description: e?.message, variant: 'destructive' }); }
  };

  if (!rows) return <p className="text-sm text-adm-muted">Cargando…</p>;
  return (
    <Card>
      <CardHeader title="Solicitudes" description="Llegan desde borealabs.org/claude. Revisa el comprobante antes de aprobar." />
      {rows.length === 0 ? <EmptyState icon={Inbox} title="Sin solicitudes" description="Aún nadie llenó el formulario." /> : (
        <Table>
          <THead><tr><TH>Fecha</TH><TH>Nombre</TH><TH>Contacto</TH><TH>Comprobante</TH><TH>Estado</TH><TH /></tr></THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap">{formatDate(r.createdAt)}</TD>
                <TD className="font-medium">{r.name}</TD>
                <TD className="text-adm-muted">{r.email}<br />{r.whatsapp}</TD>
                <TD>{r.proofUrl ? <button type="button" onClick={() => setZoom(r)} className="rounded-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent" aria-label={`Ver comprobante de ${r.name}`}><img src={r.proofUrl} alt="" className="h-14 w-14 rounded-md border border-adm-border object-cover" /></button> : '—'}</TD>
                <TD><Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge></TD>
                <TD className="whitespace-nowrap text-right">
                  {r.status === 'pendiente' && <>
                    <Button size="sm" variant="primary" loading={busy === r.id} onClick={() => approve(r)}><Check className="h-4 w-4" />Aprobar</Button>
                    <Button size="icon" variant="ghost" aria-label="Rechazar" title="Rechazar" onClick={() => reject(r)}><X className="h-4 w-4" /></Button>
                  </>}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
      <Modal open={!!zoom} onClose={() => setZoom(null)} title={zoom ? `Comprobante de ${zoom.name}` : ''} size="lg"
        footer={zoom?.status === 'pendiente' && <Button variant="primary" onClick={() => { const z = zoom; setZoom(null); approve(z); }}><Check className="h-4 w-4" />Aprobar</Button>}>
        {zoom && <a href={zoom.proofUrl} target="_blank" rel="noreferrer"><img src={zoom.proofUrl} alt={`Comprobante de ${zoom.name}`} className="mx-auto max-h-[70vh] w-auto rounded-lg" /></a>}
      </Modal>
    </Card>
  );
}
