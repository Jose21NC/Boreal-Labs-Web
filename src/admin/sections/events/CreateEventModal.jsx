// Alta de evento: público (aparece en /eventos con inscripción) o interno (solo para registro manual).
import React, { useState } from 'react';
import { Globe, Lock } from 'lucide-react';
import { Modal } from '@/admin/ui';
import { logActivity } from '@/admin/lib';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useEventsStore } from './store';
import { routeKey } from './data';
import { saveManualEvent, savePublicEvent } from './actions';
import { ManualEventForm, PublicEventForm } from './EventForm';

const KINDS = [
  { value: 'public', label: 'Evento público', hint: 'Se publica en /eventos con formulario de inscripción.', icon: Globe },
  { value: 'manual', label: 'Evento interno', hint: 'Solo para registrar asistencia y certificados a mano.', icon: Lock },
];

export default function CreateEventModal({ open, onClose, onCreated }) {
  const { reload } = useEventsStore();
  const { toast } = useToast();
  const [kind, setKind] = useState('public');
  const [saving, setSaving] = useState(false);

  const run = async (fn, name) => {
    setSaving(true);
    try {
      const id = await fn();
      await reload();
      await logActivity('eventos.creado', `Creó el evento "${name}"${kind === 'manual' ? ' (interno)' : ''}`, { id, kind });
      toast({ title: 'Evento creado', description: name });
      onClose();
      onCreated(routeKey(kind, id));
    } catch (e) {
      console.error(e);
      toast({ title: 'No se pudo crear el evento', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo evento" size="xl">
      <div role="radiogroup" aria-label="Tipo de evento" className="mb-5 grid gap-2 sm:grid-cols-2">
        {KINDS.map(({ value, label, hint, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
              kind === value ? 'border-adm-accent bg-adm-accent/10' : 'border-adm-border hover:bg-adm-surface-2',
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', kind === value ? 'text-adm-accent' : 'text-adm-muted')} aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-adm-text">{label}</span>
              <span className="block text-xs text-adm-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>
      {kind === 'public' ? (
        <PublicEventForm submitLabel="Crear evento" submitting={saving} onCancel={onClose} onSubmit={(form, file) => run(() => savePublicEvent(null, form, file), form.title.trim())} />
      ) : (
        <ManualEventForm submitLabel="Crear evento" submitting={saving} onCancel={onClose} onSubmit={(form) => run(() => saveManualEvent(null, form), form.name.trim())} />
      )}
    </Modal>
  );
}
