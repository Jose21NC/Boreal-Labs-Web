// Editor visual de una carpeta de plantillas: fondo = PDF real, cajas = campos de layout.json.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye, FileUp, Redo2, RotateCcw, Save, Undo2, FolderX } from 'lucide-react';
import { Badge, Button, EmptyState, Kbd, PageHeader, Skeleton, useConfirm } from '@/admin/ui';
import { useToast } from '@/components/ui/use-toast';
import { logActivity } from '@/admin/lib';
import { cn } from '@/lib/utils';
import {
  DEFAULT_LAYOUT, VARIANTS, listFiles, loadLayout, loadTemplate, mergeLayout, normalizeTemplateSet, sampleData, saveLayout, setLabel, setPath,
} from './engine';
import { renderFirstPage } from './pdfImage';
import { useHistory } from './useHistory';
import Stage, { FIELDS } from './Stage';
import PropertiesPanel from './PropertiesPanel';
import VariantsPanel from './VariantsPanel';
import PreviewModal from './PreviewModal';

const A4_ASPECT = 595 / 842;
const SAMPLE = sampleData();

/** Copia editable: sin absPx (se recalcula al guardar) y con 'modalidad' renombrado a 'tipoParticipacion'. */
function toEditable(layout) {
  const copy = JSON.parse(JSON.stringify(layout));
  if (copy.elements.modalidad) {
    copy.elements.tipoParticipacion = copy.elements.modalidad; // el motor prioriza 'modalidad'
    delete copy.elements.modalidad;
  }
  Object.values(copy.elements).forEach((el) => { delete el.absPx; });
  return { canvas: copy.canvas, safeMarginPx: copy.safeMarginPx, elements: copy.elements };
}

const isTyping = (el) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName) || el?.isContentEditable;

export default function Editor() {
  const { '*': splat = '' } = useParams();
  const set = splat === '~' ? '' : splat;
  const valid = set === '' || normalizeTemplateSet(set) === set;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();
  const history = useHistory(null);
  const layout = history.state;
  const [meta, setMeta] = useState({ loading: true, files: [], rootFiles: [] });
  const [saved, setSaved] = useState('');
  const [selected, setSelected] = useState('nombreUsuario');
  const [variant, setVariant] = useState(VARIANTS[0].file);
  const [bg, setBg] = useState({ loading: true, aspect: A4_ASPECT });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const importRef = useRef(null);
  const dirty = !!layout && JSON.stringify(layout) !== saved;
  const label = setLabel(set);

  useEffect(() => {
    if (!valid) return undefined;
    let alive = true;
    (async () => {
      try {
        const [info, files, rootFiles] = await Promise.all([loadLayout(set), listFiles(set), listFiles('')]);
        if (!alive) return;
        const editable = toEditable(info.layout);
        history.reset(editable);
        setSaved(JSON.stringify(editable));
        setMeta({ loading: false, files, rootFiles, source: info.source });
      } catch (error) {
        if (alive) setMeta({ loading: false, files: [], rootFiles: [], error: error?.message || 'No se pudo cargar el layout.' });
      }
    })();
    return () => { alive = false; };
  }, [set, valid, history.reset]);

  const refreshFiles = useCallback(async () => {
    const [files, rootFiles] = await Promise.all([listFiles(set), listFiles('')]);
    setMeta((m) => ({ ...m, files, rootFiles }));
  }, [set]);

  // Fondo: la plantilla que usaría la Function para la variante elegida.
  useEffect(() => {
    if (!valid) return undefined;
    let alive = true;
    let url = null;
    const v = VARIANTS.find((x) => x.file === variant);
    setBg((b) => ({ ...b, loading: true }));
    (async () => {
      try {
        const t = await loadTemplate(set, v.role, v.modality);
        if (!t) { if (alive) setBg({ loading: false, url: null, aspect: A4_ASPECT, path: null }); return; }
        const img = await renderFirstPage(t.buf, 1600);
        url = img.url;
        if (alive) setBg({ loading: false, url, aspect: img.height / img.width, path: t.path });
        else URL.revokeObjectURL(url);
      } catch (error) {
        if (alive) setBg({ loading: false, url: null, aspect: A4_ASPECT, error: error?.message });
      }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [set, valid, variant, meta.files]);

  const updateRel = useCallback((key, rel, transient) => history.set((l) => ({
    ...l, elements: { ...l.elements, [key]: { ...l.elements[key], rel } },
  }), transient), [history.set]);
  const updateStyle = (key, style) => history.set((l) => ({
    ...l, elements: { ...l.elements, [key]: { ...l.elements[key], style } },
  }));

  const save = useCallback(async () => {
    if (!layout || saving) return;
    setSaving(true);
    try {
      await saveLayout(set, layout);
      setSaved(JSON.stringify(layout));
      setMeta((m) => ({ ...m, source: `${setPath(set)}/layout.json`, files: m.files.includes('layout.json') ? m.files : [...m.files, 'layout.json'] }));
      await logActivity('plantillas.layout_guardado', `Guardó el diseño de la carpeta "${label}"`, { set });
      toast({ title: 'Diseño guardado', description: `${setPath(set)}/layout.json` });
    } catch (error) {
      toast({ title: 'No se pudo guardar', description: error?.message || 'Revisa tu conexión y permisos.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [layout, saving, set, label, toast]);

  // Atajos: Ctrl/Cmd+Z, Ctrl/Cmd+Mayús+Z o Ctrl+Y, Ctrl/Cmd+S.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); if (dirty) save(); return; }
      if (isTyping(document.activeElement)) return;
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); history.undo(); }
      if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); history.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, save, history.undo, history.redo]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const goBack = async () => {
    if (dirty && !(await confirm({ title: '¿Salir sin guardar?', description: 'Perderás los cambios del diseño.', confirmLabel: 'Salir', tone: 'danger' }))) return;
    navigate('/admin/plantillas');
  };

  const resetDefaults = async () => {
    if (await confirm({ title: '¿Restablecer posiciones?', description: 'Se aplican las posiciones y estilos predeterminados. Puedes deshacerlo y no se guarda hasta que pulses Guardar.', confirmLabel: 'Restablecer' })) {
      history.set(toEditable(DEFAULT_LAYOUT));
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'layout.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!json || typeof json.elements !== 'object') throw new Error('El archivo no tiene "elements".');
      history.set(toEditable(mergeLayout(json)));
      toast({ title: 'layout.json importado', description: 'Revisa y pulsa Guardar para aplicarlo.' });
    } catch (error) {
      toast({ title: 'JSON inválido', description: error?.message, variant: 'destructive' });
    }
  };

  if (!valid) {
    return <EmptyState icon={FolderX} title="Carpeta inválida" description="El nombre no puede contener '..'." action={<Button onClick={() => navigate('/admin/plantillas')}>Volver a plantillas</Button>} />;
  }

  const sourceBadge = meta.source === `${setPath(set)}/layout.json`
    ? <Badge tone="success">Diseño propio</Badge>
    : meta.source ? <Badge tone="warning">Usa el diseño general; al guardar se crea uno propio</Badge>
      : <Badge tone="neutral">Diseño predeterminado</Badge>;

  return (
    <div>
      <PageHeader
        title={label}
        description={`Carpeta en Storage: ${setPath(set)}/`}
        actions={(
          <>
            <Button variant="ghost" onClick={goBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Plantillas</Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!layout}><Eye className="h-4 w-4" aria-hidden="true" />Vista previa</Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}><Save className="h-4 w-4" aria-hidden="true" />Guardar</Button>
          </>
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {!meta.loading && sourceBadge}
          {dirty && <Badge tone="accent">Cambios sin guardar</Badge>}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button size="icon" variant="ghost" onClick={history.undo} disabled={!history.canUndo} aria-label="Deshacer (Ctrl+Z)" title="Deshacer (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={history.redo} disabled={!history.canRedo} aria-label="Rehacer (Ctrl+Mayús+Z)" title="Rehacer (Ctrl+Mayús+Z)"><Redo2 className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => importRef.current.click()} disabled={!layout}><FileUp className="h-3.5 w-3.5" aria-hidden="true" />Importar</Button>
            <Button size="sm" variant="ghost" onClick={exportJson} disabled={!layout}><Download className="h-3.5 w-3.5" aria-hidden="true" />Exportar</Button>
            <Button size="sm" variant="ghost" onClick={resetDefaults} disabled={!layout}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Predeterminado</Button>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={importJson} tabIndex={-1} aria-hidden="true" />
          </div>
        </div>
      </PageHeader>

      {meta.error && <p role="alert" className="mb-4 rounded-lg border border-adm-danger/30 bg-adm-danger/10 p-3 text-sm text-adm-danger">{meta.error}</p>}

      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_290px]">
        <div className="order-2 lg:order-1">
          {meta.loading ? <Skeleton className="h-80 w-full" /> : (
            <VariantsPanel set={set} files={meta.files} rootFiles={meta.rootFiles} active={variant} onSelect={setVariant} onUploaded={refreshFiles} />
          )}
        </div>

        <div className="order-1 min-w-0 space-y-3 lg:order-2">
          <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Campos">
            {FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setSelected(f.key)}
                aria-pressed={selected === f.key}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
                  selected === f.key ? 'border-adm-accent bg-adm-accent/10 text-adm-accent' : 'border-adm-border text-adm-muted hover:text-adm-text',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {layout ? (
            <Stage
              bgUrl={bg.url}
              aspect={bg.aspect}
              loading={bg.loading}
              layout={layout}
              sample={SAMPLE}
              selected={selected}
              onSelect={setSelected}
              onChange={updateRel}
              onCommit={history.commit}
            />
          ) : <Skeleton className="aspect-[1.414] w-full" />}
          <p className="text-xs text-adm-muted">
            {bg.path ? `Fondo: ${bg.path.replace(/^cert-templates\/?/, '')}` : !bg.loading && 'Sin PDF para esta variante: el certificado se imprime sobre una hoja en blanco.'}
            {bg.error && ` · No se pudo dibujar el PDF (${bg.error}).`}
            {' '}Arrastra para mover, esquina para redimensionar, <Kbd>Mayús</Kbd> desactiva el imán. Los textos son de ejemplo.
          </p>
        </div>

        <div className="order-3 lg:col-span-2 xl:col-span-1">
          {layout && (
            <PropertiesPanel
              fieldKey={selected}
              element={layout.elements[selected]}
              onRel={(rel) => updateRel(selected, rel, false)}
              onStyle={(style) => updateStyle(selected, style)}
            />
          )}
        </div>
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        set={set}
        layout={layout}
        initialRole={VARIANTS.find((v) => v.file === variant)?.role}
        initialModality={VARIANTS.find((v) => v.file === variant)?.modality}
      />
    </div>
  );
}
