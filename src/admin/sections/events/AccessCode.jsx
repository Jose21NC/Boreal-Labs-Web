// Código secreto de inscripción: el evento guarda solo `requiresCode`; el código vive en eventSecrets/{id}.
import React, { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { Button, Field, Input, Switch } from '@/admin/ui';
import { useToast } from '@/components/ui/use-toast';
import { generateCode, normalizeCode } from '@/lib/eventForms';

export default function AccessCode({ enabled, code, loading, onChange }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'No se pudo copiar', variant: 'destructive' });
    }
  };
  return (
    <div className="space-y-3 rounded-lg border border-adm-border p-3">
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onChange={(v) => onChange({ requiresCode: v, accessCode: v && !code ? generateCode() : code })} label="Requiere código para inscribirse" />
        <span className="text-sm text-adm-text">Requiere código para inscribirse</span>
      </div>
      {enabled && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Código de acceso" hint="Mínimo 4 caracteres. Se guarda en mayúsculas; quien se inscribe puede escribirlo en minúsculas." className="min-w-[200px] flex-1">
            <Input
              value={loading ? '' : code}
              placeholder={loading ? 'Cargando…' : undefined}
              disabled={loading}
              onChange={(e) => onChange({ accessCode: normalizeCode(e.target.value).replace(/\s+/g, '') })}
              maxLength={40}
              autoComplete="off"
              className="font-mono uppercase tracking-widest"
            />
          </Field>
          <Button variant="outline" onClick={copy} disabled={!code}><Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copiado' : 'Copiar'}</Button>
          <Button variant="outline" onClick={() => onChange({ accessCode: generateCode() })}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Generar</Button>
        </div>
      )}
    </div>
  );
}
