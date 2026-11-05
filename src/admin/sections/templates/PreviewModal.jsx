// Vista previa REAL: dibuja el certificado con el mismo motor que la Cloud Function y lo muestra como imagen.
// No usa <iframe>: Chrome en Android y varios WebViews no muestran PDFs embebidos.
import React, { useEffect, useRef, useState } from 'react';
import { Download, FileWarning } from 'lucide-react';
import { Button, Field, Input, Modal, Skeleton, Badge } from '@/admin/ui';
import { cn } from '@/lib/utils';
import { pdfBlobUrl, renderPreview, setLabel } from './engine';
import { renderFirstPage } from './pdfImage';

const ROLES = [
  { value: 'participante', label: 'Participante' },
  { value: 'ponente', label: 'Ponente' },
  { value: 'staff', label: 'Staff' },
];
const MODALITIES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
];

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-adm-border bg-adm-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
            value === o.value ? 'bg-adm-surface text-adm-text shadow-sm' : 'text-adm-muted hover:text-adm-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * @param {{open, onClose, set: string, layout?: object, data?: object, initialRole?: string, initialModality?: string}} props
 * `layout` permite previsualizar cambios sin guardar; `data` sobreescribe los datos de ejemplo.
 */
export default function PreviewModal({ open, onClose, set, layout, data, initialRole = 'participante', initialModality = 'presencial' }) {
  const [role, setRole] = useState(initialRole);
  const [modality, setModality] = useState(initialModality);
  const [name, setName] = useState(data?.nombreUsuario || 'María Fernanda López');
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!open) return undefined;
    setRole(initialRole);
    setModality(initialModality);
    setName(data?.nombreUsuario || 'María Fernanda López');
  }, [open, initialRole, initialModality, data?.nombreUsuario]);

  // URLs blob: vigentes (PDF para descargar + imagen de la página); se revocan al reemplazarlas.
  const urlsRef = useRef([]);
  const swapUrls = (next) => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = next;
  };
  useEffect(() => () => swapUrls([]), []);

  useEffect(() => {
    if (!open) { swapUrls([]); setState({ loading: true }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(async () => {
      try {
        const res = await renderPreview({ set, role, modality, layout, data: { ...data, nombreUsuario: name } });
        if (cancelled) return;
        const page = await renderFirstPage(res.bytes, 1600);
        if (cancelled) { URL.revokeObjectURL(page.url); return; }
        const url = pdfBlobUrl(res.bytes);
        swapUrls([url, page.url]);
        setState({ loading: false, url, imageUrl: page.url, templatePath: res.templatePath, layoutSource: res.layoutSource });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error?.message || 'No se pudo generar la vista previa.' });
      }
    }, 250); // espera a que termine de escribir el nombre
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, set, role, modality, layout, data, name]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title="Vista previa del certificado"
      description={`Carpeta: ${setLabel(set)} · Se dibuja con el mismo motor que la generación real.`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          {state.url && (
            <Button variant="primary" onClick={() => { const a = document.createElement('a'); a.href = state.url; a.download = 'vista-previa.pdf'; a.click(); }}>
              <Download className="h-4 w-4" aria-hidden="true" />Descargar PDF
            </Button>
          )}
        </>
      )}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Segmented label="Rol" options={ROLES} value={role} onChange={setRole} />
        <Segmented label="Modalidad" options={MODALITIES} value={modality} onChange={setModality} />
        <Field label="Nombre de prueba" className="min-w-[220px] flex-1" hint="Prueba un nombre largo para ver el auto-ajuste.">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {state.templatePath !== undefined && (
          state.templatePath
            ? <Badge tone="info">Plantilla: {state.templatePath.replace(/^cert-templates\/?/, '') || 'raíz'}</Badge>
            : <Badge tone="warning"><FileWarning className="h-3 w-3" aria-hidden="true" />Sin plantilla: lienzo en blanco</Badge>
        )}
        {state.layoutSource !== undefined && (
          <Badge tone="neutral">Layout: {state.layoutSource === 'editor' ? 'cambios del editor (sin guardar)' : state.layoutSource || 'predeterminado'}</Badge>
        )}
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-adm-danger/30 bg-adm-danger/10 p-4 text-sm text-adm-danger">{state.error}</p>
      ) : state.loading && !state.url ? (
        <Skeleton className="aspect-[1.414] w-full" />
      ) : (
        <img
          src={state.imageUrl}
          alt="Certificado de ejemplo"
          className={cn('mx-auto max-h-[65vh] w-auto max-w-full rounded-lg border border-adm-border bg-white shadow-sm transition-opacity', state.loading && 'opacity-60')}
        />
      )}
    </Modal>
  );
}
