// Asistente de generación: evento → elegibles → plantilla → vista previa → puntos → confirmar → resultados.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, FileStack, LayoutTemplate, Sparkles, Users } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, Skeleton, StatCard, Switch, useConfirm,
} from '@/admin/ui';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, logActivity } from '@/admin/lib';
import { DEFAULT_SETS, loadTemplateSets, normalizeTemplateSet, resolveVariants } from '../templates/engine';
import PreviewModal from '../templates/PreviewModal';
import { editorPath } from '../templates/Gallery';
import { callFunction, eligibility, getCallableErrorMessage, loadWizardData, saveTemplateForEvent } from './api';
import { mergeAndOpen } from './List';
import PointsCell from './PointsCell';

const MAX_POINTS = 1000;
const AUTO = '__auto__';

function Step({ n, title, description, children, disabled }) {
  return (
    <Card className={disabled ? 'opacity-60' : undefined} aria-disabled={disabled || undefined}>
      <CardHeader title={<span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-adm-accent/10 text-xs font-semibold text-adm-accent">{n}</span>{title}</span>} description={description} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function Results({ result, eventName, onMerge, merging }) {
  const { created = 0, skipped = 0, errors = [], pointsApplied = 0, pointsErrors = [], pointsPending = [], addPoints } = result;
  const ok = !errors.length && !pointsErrors.length;
  return (
    <Card className={ok ? 'border-adm-success/40' : 'border-adm-warning/40'} role="status">
      <CardHeader
        title={<span className="flex items-center gap-2">{ok ? <CheckCircle2 className="h-4 w-4 text-adm-success" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-adm-warning" aria-hidden="true" />}Resultado de la generación</span>}
        description={eventName}
        actions={(
          <>
            <Button size="sm" variant="outline" loading={merging} onClick={onMerge} disabled={!created && !skipped}><FileStack className="h-3.5 w-3.5" aria-hidden="true" />PDF combinado</Button>
            <Link to={`/admin/certificados?evento=${encodeURIComponent(eventName)}`} className="inline-flex h-8 items-center rounded-lg bg-adm-accent px-3 text-xs font-medium text-adm-accent-fg hover:bg-adm-accent/90">Ver certificados</Link>
          </>
        )}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Creados" value={created} tone="success" />
          <StatCard label="Omitidos" value={skipped} hint="Ya tenían o sin correo" tone="neutral" />
          <StatCard label="Errores" value={errors.length} tone={errors.length ? 'danger' : 'neutral'} />
          <StatCard label="Puntos aplicados" value={addPoints ? pointsApplied : '—'} hint={addPoints ? `${pointsErrors.length} errores` : 'Sin puntos'} tone="info" />
        </div>
        {pointsPending.length > 0 && (
          <div className="rounded-lg border border-adm-warning/30 bg-adm-warning/5 p-3 text-sm">
            <p className="text-adm-text"><strong>{pointsPending.length} sin cuenta en la Wallet.</strong> Sus puntos quedaron guardados, pero no los verán hasta que inicien sesión en la Boreal Wallet con este correo:</p>
            <p className="mt-1 break-words text-xs text-adm-muted">{pointsPending.join(', ')}</p>
          </div>
        )}
        {created === 0 && skipped > 0 && !errors.length && <p className="text-sm text-adm-warning">Todos los certificados fueron omitidos: ya estaban emitidos.</p>}
        {[...errors.map((e) => ({ ...e, kind: 'Certificado' })), ...pointsErrors.map((e) => ({ ...e, kind: 'Puntos' }))].length > 0 && (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-adm-danger/30 bg-adm-danger/5 p-3 text-xs">
            {[...errors.map((e) => ({ ...e, kind: 'Certificado' })), ...pointsErrors.map((e) => ({ ...e, kind: 'Puntos' }))].map((e, i) => (
              <li key={i} className="text-adm-text"><strong>{e.kind}</strong> · {e.email || '—'}: <span className="text-adm-danger">{e.message}</span></li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/** Mensaje de progreso con tiempo transcurrido: la Function no informa avance y en eventos grandes tarda minutos. */
function GeneratingStatus({ count }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  return (
    <>
      Generando <span className="tabular-nums">{count}</span> certificados… esto puede tardar unos minutos en eventos grandes.
      {' '}<span className="tabular-nums text-adm-text">{elapsed}</span>. No cierres esta pestaña.
    </>
  );
}

export default function Wizard() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const eventName = params.get('evento') || '';
  const [data, setData] = useState(null);
  const [sets, setSets] = useState(null);
  const [templateSet, setTemplateSet] = useState('');
  const [addPoints, setAddPoints] = useState(false);
  const [points, setPoints] = useState('10');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([loadWizardData(), loadTemplateSets()]);
    setData(d);
    setSets(s);
  }, []);
  useEffect(() => { load(); }, [load]);

  const event = data?.events.find((e) => e.name === eventName) || null;
  const stats = useMemo(() => (event ? eligibility(event, data.certificados) : null), [event, data]);

  // Plantilla: la asignada al evento o, como antes, la primera carpeta conocida.
  useEffect(() => {
    if (!data || !eventName) return;
    setTemplateSet(data.byEvent[eventName] || DEFAULT_SETS[0] || AUTO);
  }, [data, eventName]);
  // Solo al cambiar de evento: recargar `data` tras generar no debe ocultar el resultado.
  useEffect(() => { setResult(null); }, [eventName]);

  const setEvent = (name) => setParams(name ? { evento: name } : {}, { replace: true });

  const chooseSet = async (value) => {
    setTemplateSet(value);
    if (!eventName || value === AUTO) return;
    try {
      await saveTemplateForEvent(eventName, value);
      setData((d) => ({ ...d, byEvent: { ...d.byEvent, [eventName]: value } }));
      await logActivity('certificados.plantilla_asignada', `Asignó la plantilla "${value}" al evento "${eventName}"`, { eventName, templateSet: value });
      toast({ title: 'Plantilla recordada', description: `«${value}» para ${eventName}` });
    } catch (error) {
      toast({ title: 'No se pudo guardar la plantilla del evento', description: error?.message, variant: 'destructive' });
    }
  };

  const pointsValue = Number.parseInt(points, 10);
  const pointsInvalid = addPoints && (!Number.isFinite(pointsValue) || pointsValue <= 0 || pointsValue > MAX_POINTS);
  const setInfo = sets?.sets.find((s) => s.name === templateSet);
  const variants = templateSet !== AUTO ? resolveVariants(setInfo?.files || [], sets?.rootFiles || []) : [];
  const sample = stats?.eligible[0];
  // Memo: PreviewModal vuelve a dibujar el PDF cuando cambia `data`.
  const previewData = useMemo(
    () => (sample ? { nombreUsuario: sample.userName || '', nombreEvento: sample.title } : { nombreEvento: eventName }),
    [sample, eventName],
  );
  const slug = eventName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

  const generate = async () => {
    if (pointsInvalid) return;
    const tplLabel = templateSet === AUTO ? 'automática' : `«${templateSet}»`;
    const ok = await confirm({
      title: `¿Generar ${stats.eligible.length} certificados?`,
      description: `Evento «${eventName}», plantilla ${tplLabel}.${addPoints ? ` Se otorgarán ${pointsValue} puntos por certificado.` : ''} Los ya emitidos se omiten.`,
      confirmLabel: 'Generar',
    });
    if (!ok) return;
    setGenerating(true);
    try {
      const res = await callFunction('generateCertificates', {
        eventName,
        templateSet: templateSet === AUTO ? null : (templateSet || '').trim() || null,
        addPoints,
        points: addPoints ? pointsValue : null,
      });
      const r = { created: 0, skipped: 0, errors: [], pointsApplied: 0, pointsErrors: [], pointsPending: [], ...res, addPoints };
      setResult(r);
      await logActivity('certificados.generados', `Generó ${r.created} certificados para "${eventName}"`, {
        eventName, templateSet: templateSet === AUTO ? null : templateSet, created: r.created, skipped: r.skipped, errors: r.errors.length, pointsApplied: r.pointsApplied, pointsPending: r.pointsPending.length,
      });
      toast({ title: 'Certificados generados', description: `${r.created} creados · ${r.skipped} omitidos` });
      setData(await loadWizardData());
    } catch (error) {
      toast({ title: 'Error generando certificados', description: getCallableErrorMessage(error), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const knownSets = sets ? [...new Set([...sets.sets.map((s) => s.name), ...(templateSet && templateSet !== AUTO ? [templateSet] : [])])] : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Generar certificados"
        description="Crea los PDF de los asistentes presentes con la plantilla del evento. Nunca duplica certificados ya emitidos."
        actions={<Button variant="ghost" onClick={() => navigate('/admin/certificados')}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Certificados</Button>}
      />

      <Step n={1} title="Evento" description="Solo cuentan las inscripciones marcadas como presentes.">
        {!data ? <Skeleton className="h-10 w-full max-w-md" /> : (
          <Field label="Evento">
            <Select value={eventName} onChange={(e) => setEvent(e.target.value)} className="max-w-xl">
              <option value="">Elige un evento…</option>
              {eventName && !event && <option value={eventName}>{eventName} (sin inscripciones)</option>}
              {data.events.map((e) => (
                <option key={e.name} value={e.name}>{e.name}{e.date ? ` · ${formatDate(e.date)}` : ''} · {e.present} presentes</option>
              ))}
            </Select>
          </Field>
        )}
        {stats && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Inscritos" value={stats.total} icon={Users} tone="neutral" />
              <StatCard label="Presentes" value={stats.present} tone="info" />
              <StatCard label="Ya emitidos" value={stats.issued} tone="neutral" />
              <StatCard label="Por emitir" value={stats.eligible.length} tone={stats.eligible.length ? 'success' : 'warning'} />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(stats.byRole).map(([rol, n]) => <Badge key={rol} tone="accent">{n} {rol}</Badge>)}
              {stats.noEmail > 0 && <Badge tone="warning">{stats.noEmail} presentes sin correo (se omiten)</Badge>}
            </div>
            {stats.eligible.length > 0 && (
              <details className="rounded-lg border border-adm-border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-adm-text">Ver {stats.eligible.length} personas por emitir y su saldo de puntos</summary>
                <ul className="max-h-72 divide-y divide-adm-border overflow-y-auto border-t border-adm-border text-sm">
                  {stats.eligible.map((r) => (
                    <li key={`${r.userEmail}|${r.rol}`} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-adm-text">{r.userName || r.userEmail}</span>
                        <span className="block truncate text-xs text-adm-muted">{r.userEmail} · {r.rol}</span>
                      </span>
                      <PointsCell person={data.points.get(String(r.userEmail || '').toLowerCase())} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!stats.eligible.length && (
              <p className="text-sm text-adm-muted">
                No hay certificados pendientes. {stats.present ? 'Todos los presentes ya tienen el suyo.' : 'Marca la asistencia en Eventos primero.'}
              </p>
            )}
          </div>
        )}
        {data && !eventName && !data.events.length && (
          <EmptyState icon={Users} title="No hay eventos con inscripciones" description="Crea un evento y registra la asistencia para poder emitir certificados." />
        )}
      </Step>

      <Step n={2} title="Plantilla" description="Se recuerda por evento. Si falta una variante se usa el respaldo de la raíz." disabled={!event}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Carpeta" className="min-w-[240px] flex-1">
            <Select value={templateSet} onChange={(e) => chooseSet(e.target.value)} disabled={!event || !sets}>
              <option value={AUTO}>Automática (raíz, o VOLUNTARIADO en eventos de voluntariado)</option>
              {knownSets.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Button variant="outline" disabled={!event} onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4" aria-hidden="true" />Vista previa</Button>
          <Button
            variant="ghost"
            disabled={!event}
            onClick={() => navigate(editorPath(templateSet !== AUTO && templateSet ? templateSet : normalizeTemplateSet(`eventos-admin/${slug || 'evento'}`)))}
          >
            <LayoutTemplate className="h-4 w-4" aria-hidden="true" />{templateSet !== AUTO ? 'Editar diseño' : 'Crear plantilla propia'}
          </Button>
        </div>
        {templateSet !== AUTO && event && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {variants.map((v) => (
              <Badge key={v.file} tone={v.uses ? 'success' : v.fallback ? 'warning' : 'danger'}>
                {v.label}: {v.uses || (v.fallback ? `${v.fallback} (raíz)` : 'sin PDF')}
              </Badge>
            ))}
          </div>
        )}
      </Step>

      <Step n={3} title="Puntos" description="Opcional: suma puntos a cada persona por certificado nuevo." disabled={!event}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-3">
            <Switch label="Otorgar puntos" checked={addPoints} onChange={setAddPoints} disabled={!event} />
            <span className="text-sm text-adm-text">Otorgar puntos</span>
          </div>
          <Field label="Puntos por certificado" error={pointsInvalid ? `Entre 1 y ${MAX_POINTS}.` : undefined} className="w-48">
            <Input type="number" min={1} max={MAX_POINTS} value={points} onChange={(e) => setPoints(e.target.value)} disabled={!addPoints} />
          </Field>
        </div>
      </Step>

      {/* Barra de acción fija abajo: el botón queda a mano aunque los pasos sean largos. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-adm-border bg-adm-bg/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <p role="status" aria-live="polite" className="mr-auto min-w-0 text-sm text-adm-muted">
          {generating ? <GeneratingStatus count={stats?.eligible.length || 0} /> : stats && <><span className="tabular-nums">{stats.eligible.length}</span> certificados por emitir</>}
        </p>
        <Button variant="primary" size="lg" loading={generating} disabled={!stats?.eligible.length || pointsInvalid} onClick={generate}>
          {!generating && <Sparkles className="h-4 w-4" aria-hidden="true" />}{generating ? 'Generando…' : 'Generar certificados'}
        </Button>
      </div>

      {result && (
        <Results result={result} eventName={eventName} merging={merging} onMerge={async () => { setMerging(true); await mergeAndOpen(eventName, toast); setMerging(false); }} />
      )}

      {event && (
        <PreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          set={templateSet === AUTO ? (/voluntariado/i.test(eventName) ? 'VOLUNTARIADO' : '') : templateSet}
          data={previewData}
          initialRole={sample?.rol || 'participante'}
          initialModality={String(sample?.tipoAsistencia || '').toLowerCase() === 'virtual' ? 'virtual' : 'presencial'}
        />
      )}
    </div>
  );
}
