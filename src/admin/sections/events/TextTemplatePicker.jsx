// Selector de plantillas de texto (integradas + del equipo) con vista previa y "Guardar como plantilla".
import React, { useEffect, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { Button, Field, Input, Modal, useConfirm } from '@/admin/ui';
import { logActivity } from '@/admin/lib';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { newFieldId } from '@/lib/eventForms';
import { BUILTIN_TEMPLATES, PLACEHOLDERS, fillTemplate } from './textTemplates';
import { loadTextTemplates, updateTextTemplates } from './actions';

const TITLES = { description: 'Plantillas de descripción', confirmation: 'Plantillas de mensaje de confirmación' };

export default function TextTemplatePicker({ kind, form, value, onInsert }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTeam(null);
    loadTextTemplates().then((t) => setTeam(t[kind])).catch((e) => { console.error(e); setTeam([]); });
  }, [open, kind]);

  const all = [...BUILTIN_TEMPLATES[kind].map((t) => ({ ...t, builtin: true })), ...(team || [])];
  const selected = all.find((t) => t.id === selectedId) || all[0];
  const preview = selected ? fillTemplate(selected.text, form) : '';

  const insert = async () => {
    if (value.trim() && !(await confirm({ title: '¿Reemplazar el texto actual?', description: 'La plantilla sustituye lo que ya escribiste.', confirmLabel: 'Reemplazar' }))) return;
    onInsert(preview);
    setOpen(false);
  };

  const mutate = async (fn, action, summary, success) => {
    setBusy(true);
    try {
      setTeam(await updateTextTemplates(kind, fn));
      await logActivity(action, summary, { kind });
      toast({ title: success });
      return true;
    } catch (e) {
      console.error(e);
      toast({ title: 'No se pudo guardar la plantilla', description: e?.message, variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveCurrent = async () => {
    const clean = name.trim();
    if (!clean || !value.trim()) return;
    // Se guarda el texto tal cual (con sus marcadores si los tiene).
    const ok = await mutate((list) => [...list, { id: newFieldId(), name: clean.slice(0, 80), text: value.trim() }],
      'eventos.plantilla_texto_guardada', `Guardó la plantilla de texto "${clean}"`, 'Plantilla guardada');
    if (ok) setName('');
  };

  const remove = async (t) => {
    if (!(await confirm({ title: `¿Eliminar la plantilla "${t.name}"?`, confirmLabel: 'Eliminar', tone: 'danger' }))) return;
    if (await mutate((list) => list.filter((x) => x.id !== t.id), 'eventos.plantilla_texto_eliminada', `Eliminó la plantilla de texto "${t.name}"`, 'Plantilla eliminada')) {
      setSelectedId(null);
    }
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-7 px-2 text-xs">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Plantillas
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={TITLES[kind]}
        description={`Marcadores: ${PLACEHOLDERS.join(' ')} se reemplazan con los datos del formulario.`}
        size="lg"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={insert} disabled={!selected}>Insertar</Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
          <ul className="space-y-1" aria-label="Plantillas">
            {all.map((t) => (
              <li key={t.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  aria-pressed={selected?.id === t.id}
                  className={cn(
                    'min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
                    selected?.id === t.id ? 'bg-adm-accent/10 font-medium text-adm-accent' : 'text-adm-text hover:bg-adm-surface-2',
                  )}
                >
                  {t.name}{!t.builtin && <span className="ml-1 text-xs text-adm-muted">· equipo</span>}
                </button>
                {!t.builtin && (
                  <Button size="icon" variant="danger-ghost" className="h-7 w-7" onClick={() => remove(t)} disabled={busy} aria-label={`Eliminar plantilla ${t.name}`}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
            {team === null && <li className="px-2 text-xs text-adm-muted">Cargando plantillas del equipo…</li>}
          </ul>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-adm-muted">Vista previa</p>
            <p className="min-h-[8rem] whitespace-pre-wrap rounded-lg border border-adm-border bg-adm-surface-2/50 p-3 text-sm text-adm-text">{preview}</p>
          </div>
        </div>
        {/* div, no form: este modal se renderiza dentro del <form> del evento (sin portal) y Enter lo enviaría. */}
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-adm-border pt-4">
          <Field label="Guardar el texto actual como plantilla" hint={value.trim() ? undefined : 'Escribe un texto en el campo para poder guardarlo.'} className="min-w-[200px] flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCurrent(); } }} placeholder="Nombre de la plantilla" maxLength={80} disabled={!value.trim()} />
          </Field>
          <Button variant="secondary" onClick={saveCurrent} loading={busy} disabled={!name.trim() || !value.trim()}>Guardar como plantilla</Button>
        </div>
      </Modal>
    </>
  );
}
