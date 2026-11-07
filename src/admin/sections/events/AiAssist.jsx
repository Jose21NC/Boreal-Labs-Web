// "Generar con IA": redacta descripción, mensaje de confirmación o texto del certificado con Claude
// (Cloud Function generateText; la clave de la API nunca llega al navegador).
import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, Field, Modal, Textarea, useConfirm } from '@/admin/ui';
import { logActivity } from '@/admin/lib';
import { useToast } from '@/components/ui/use-toast';
import { callFunction, getCallableErrorMessage } from '../certificates/api';

const TITLES = {
  description: 'Generar descripción con IA',
  confirmation: 'Generar mensaje de confirmación con IA',
  certificate: 'Generar descripción del certificado con IA',
};

/** `form` = estado del editor de eventos (título, fecha, lugar…); `value` = texto actual del campo. */
export default function AiAssist({ kind, form, value, onInsert }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const { text } = await callFunction('generateText', {
        kind,
        instructions,
        context: {
          title: form.title, category: form.categoryName || form.category, date: form.date, time: form.time,
          location: form.location, modality: (form.attendanceOptions || []).join(' y '), capacity: form.capacity,
          description: kind === 'description' ? '' : form.description,
        },
      });
      setResult(text);
    } catch (e) {
      toast({ title: 'No se pudo generar el texto', description: getCallableErrorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const insert = async () => {
    if (value?.trim() && !(await confirm({ title: '¿Reemplazar el texto actual?', confirmLabel: 'Reemplazar' }))) return;
    onInsert(result.trim());
    logActivity('eventos.texto_ia', `Generó con IA: ${TITLES[kind].replace(' con IA', '').replace('Generar ', '')} de "${form.title || 'evento sin título'}"`, { kind });
    setOpen(false);
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => { setResult(''); setOpen(true); }} className="h-7 px-2 text-xs">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> IA
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={TITLES[kind]}
        description="Usa los datos del evento que ya completaste. Revisa el texto antes de publicarlo."
        size="lg"
        footer={(
          <>
            <Button key="cancel" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            {result
              ? <Button key="insert" variant="primary" onClick={insert} disabled={!result.trim()}>Insertar</Button>
              : <Button key="generate" variant="primary" onClick={generate} loading={busy}><Sparkles className="h-4 w-4" aria-hidden="true" /> Generar</Button>}
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Indicaciones (opcional)" hint="Tono, público, datos a destacar… p. ej. «más formal», «para estudiantes de secundaria».">
            <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1000} />
          </Field>
          {result && (
            <>
              <Field label="Texto generado" hint="Puedes editarlo antes de insertarlo.">
                <Textarea rows={kind === 'certificate' ? 3 : 7} value={result} onChange={(e) => setResult(e.target.value)} />
              </Field>
              <Button size="sm" variant="secondary" onClick={generate} loading={busy}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Generar otra versión</Button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
