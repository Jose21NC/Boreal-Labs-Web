// Galería de carpetas de plantillas (cert-templates/<carpeta>/) con miniatura del certificado real.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FolderPlus, LayoutTemplate, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Skeleton, useDangerConfirm } from '@/admin/ui';
import { useToast } from '@/components/ui/use-toast';
import { logActivity, normalize } from '@/admin/lib';
import { deleteTemplateSet, loadTemplateSets, normalizeTemplateSet, rememberSet, renderPreview, resolveVariants, setLabel } from './engine';
import { renderFirstPage } from './pdfImage';

export const editorPath = (set) => `/admin/plantillas/editar/${set ? set.split('/').map(encodeURIComponent).join('/') : '~'}`;

function Thumb({ set }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    let url = null;
    (async () => {
      try {
        const { bytes, templatePath } = await renderPreview({ set, role: 'participante', modality: 'presencial' });
        if (!templatePath) { if (alive) setState({}); return; }
        const img = await renderFirstPage(bytes, 480);
        url = img.url;
        if (alive) setState({ url, aspect: img.width / img.height });
        else URL.revokeObjectURL(url);
      } catch {
        if (alive) setState({});
      }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [set]);

  if (state.loading) return <Skeleton className="aspect-[1.414] w-full rounded-none" />;
  if (!state.url) {
    return (
      <div className="flex aspect-[1.414] w-full flex-col items-center justify-center gap-1 bg-adm-surface-2 text-adm-muted">
        <FileText className="h-6 w-6" aria-hidden="true" />
        <span className="text-xs">Sin PDF todavía</span>
      </div>
    );
  }
  return <img src={state.url} alt={`Ejemplo de certificado de ${setLabel(set)}`} className="aspect-[1.414] w-full bg-white object-contain" />;
}

function SetCard({ set, files, rootFiles, events, onOpen, onDelete }) {
  const variants = resolveVariants(files, set ? rootFiles : []);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left transition-colors hover:bg-adm-surface-2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-adm-accent"
      >
        <div className="border-b border-adm-border"><Thumb set={set} /></div>
        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-adm-text" title={setLabel(set)}>{setLabel(set)}</p>
            {files.includes('layout.json') ? <Badge tone="success">Diseño propio</Badge> : <Badge>Diseño general</Badge>}
          </div>
          <div className="flex flex-wrap gap-1" aria-label="Variantes">
            {variants.map((v) => (
              <Badge
                key={v.file}
                tone={v.uses ? 'success' : v.fallback ? 'warning' : 'neutral'}
                title={v.uses ? `Usa ${v.uses}` : v.fallback ? `Respaldo: ${v.fallback} de la raíz` : 'Sin PDF'}
              >
                {v.short}{v.uses ? '' : v.fallback ? ' ↩' : ' —'}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-adm-muted" title={events.join(', ')}>
            {set === '' ? 'Respaldo de todas las carpetas' : events.length ? `Asignada a ${events.length} evento${events.length === 1 ? '' : 's'}` : 'Sin eventos asignados'}
          </p>
        </div>
      </button>
      {onDelete && (
        <div className="flex justify-end border-t border-adm-border px-3 py-2">
          <Button size="sm" variant="danger-ghost" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Eliminar carpeta</Button>
        </div>
      )}
    </Card>
  );
}

export default function Gallery() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState('');
  const confirmDanger = useDangerConfirm();
  const { toast } = useToast();

  const load = useCallback(async () => setData(await loadTemplateSets()), []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = normalize(search);
    return data.sets.filter((s) => !q || normalize(s.name).includes(q) || s.events.some((e) => normalize(e).includes(q)));
  }, [data, search]);

  const removeSet = async (s) => {
    const ok = await confirmDanger({
      title: `¿Eliminar la carpeta "${s.name}"?`,
      description: `Se borran sus ${s.files.length} archivo(s) (PDFs y diseño) de Storage.${s.events.length ? ` ${s.events.length} evento(s) que la usan pasarán a la plantilla automática.` : ''} Los certificados ya emitidos no cambian.`,
      phrase: s.name,
      confirmLabel: 'Eliminar carpeta',
    });
    if (!ok) return;
    try {
      const res = await deleteTemplateSet(s.name, s.events);
      await logActivity('plantillas.eliminada', `Eliminó la carpeta de plantillas "${s.name}" (${res.files} archivos)`, { set: s.name, events: res.events });
      toast({ title: 'Carpeta eliminada', description: s.name });
      load();
    } catch (error) {
      toast({ title: 'No se pudo eliminar', description: error?.message, variant: 'destructive' });
    }
  };

  const createSet = () => {
    const cleaned = normalizeTemplateSet(newName);
    if (!cleaned) { setNewError('Escribe un nombre válido (sin "..").'); return; }
    if (data?.sets.some((s) => s.name === cleaned)) { setNewError('Ya existe una carpeta con ese nombre.'); return; }
    rememberSet(cleaned);
    setNewOpen(false);
    navigate(editorPath(cleaned));
  };

  return (
    <div>
      <PageHeader
        title="Plantillas"
        description="Diseña cómo se imprimen los certificados: un PDF base por rol y la posición de cada dato."
        actions={<Button variant="primary" onClick={() => { setNewName(''); setNewError(''); setNewOpen(true); }}><FolderPlus className="h-4 w-4" aria-hidden="true" />Nueva carpeta</Button>}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar carpeta o evento…" className="max-w-sm" />
      </PageHeader>

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {!search && (
            <SetCard set="" files={data.rootFiles} rootFiles={data.rootFiles} events={[]} onOpen={() => navigate(editorPath(''))} />
          )}
          {visible.map((s) => (
            <SetCard key={s.name} set={s.name} files={s.files} rootFiles={data.rootFiles} events={s.events} onOpen={() => navigate(editorPath(s.name))} onDelete={() => removeSet(s)} />
          ))}
          {search && !visible.length && (
            <Card className="sm:col-span-2 xl:col-span-3">
              <EmptyState icon={LayoutTemplate} title="Sin resultados" description={`Ninguna carpeta coincide con «${search}».`} />
            </Card>
          )}
        </div>
      )}

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nueva carpeta de plantillas"
        description="Se crea en Storage al subir su primer PDF."
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={createSet}>Crear y diseñar</Button>
          </>
        )}
      >
        <form onSubmit={(e) => { e.preventDefault(); createSet(); }}>
          <Field label="Nombre" error={newError} hint="Ej.: Hackathon 2026. Puedes usar «/» para subcarpetas.">
            <Input value={newName} onChange={(e) => { setNewName(e.target.value); setNewError(''); }} autoFocus />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

