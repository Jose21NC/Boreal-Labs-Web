// Variantes de plantilla por rol/modalidad: cuáles existen, cuál se usa en su lugar y subida/reemplazo.
import React, { useRef, useState } from 'react';
import { CheckCircle2, CornerDownRight, FileX2, Upload } from 'lucide-react';
import { Button, Card, CardHeader, useConfirm } from '@/admin/ui';
import { useToast } from '@/components/ui/use-toast';
import { logActivity } from '@/admin/lib';
import { cn } from '@/lib/utils';
import { resolveVariants, setLabel, uploadTemplatePdf, validatePdf } from './engine';

/** @param {{set: string, files: string[], rootFiles: string[], active: string, onSelect: (file) => void, onUploaded: () => void}} props */
export default function VariantsPanel({ set, files, rootFiles, active, onSelect, onUploaded }) {
  const variants = resolveVariants(files, set ? rootFiles : []);
  const inputRef = useRef(null);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(null);
  const confirm = useConfirm();
  const { toast } = useToast();

  const pick = (variant) => {
    setTarget(variant);
    inputRef.current.value = '';
    inputRef.current.click();
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !target) return;
    setBusy(target.file);
    try {
      const info = await validatePdf(file);
      const warnings = [
        info.pages > 1 && `Tiene ${info.pages} páginas; solo se usa la primera.`,
        info.width < info.height && 'Está en vertical; los certificados suelen ser horizontales.',
      ].filter(Boolean);
      if (target.exists || warnings.length) {
        const ok = await confirm({
          title: target.exists ? `¿Reemplazar «${target.file}»?` : '¿Subir de todos modos?',
          description: [target.exists && 'Los próximos certificados usarán el nuevo PDF; los ya emitidos no cambian.', ...warnings].filter(Boolean).join(' '),
          confirmLabel: target.exists ? 'Reemplazar' : 'Subir',
          tone: target.exists ? 'danger' : undefined,
        });
        if (!ok) return;
      }
      await uploadTemplatePdf(set, target.file, info.bytes);
      await logActivity('plantillas.pdf_subido', `${target.exists ? 'Reemplazó' : 'Subió'} ${target.file} en la carpeta "${setLabel(set)}"`, { set, file: target.file });
      toast({ title: 'Plantilla subida', description: `${target.label} · ${setLabel(set)}` });
      onSelect(target.file);
      onUploaded();
    } catch (error) {
      toast({ title: 'No se pudo subir', description: error?.message || 'Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Variantes" description="PDF por rol. Si falta uno, se usa el respaldo indicado." />
      <ul className="divide-y divide-adm-border">
        {variants.map((v) => {
          const selected = active === v.file;
          return (
            <li key={v.file} className={cn('px-4 py-3', selected && 'bg-adm-accent/5')}>
              <button
                type="button"
                onClick={() => onSelect(v.file)}
                aria-pressed={selected}
                className="w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-adm-text">
                  {v.uses ? <CheckCircle2 className="h-4 w-4 shrink-0 text-adm-success" aria-hidden="true" />
                    : v.fallback ? <CornerDownRight className="h-4 w-4 shrink-0 text-adm-warning" aria-hidden="true" />
                      : <FileX2 className="h-4 w-4 shrink-0 text-adm-danger" aria-hidden="true" />}
                  {v.label}
                </span>
                <span className="mt-0.5 block pl-6 text-xs text-adm-muted">
                  {v.uses ? (v.uses === v.file ? v.file : `Usa ${v.uses}`)
                    : v.fallback ? `Usa ${v.fallback} de la raíz`
                      : 'Sin PDF: se imprime en blanco'}
                </span>
              </button>
              <div className="mt-2 pl-6">
                <Button size="sm" variant={v.exists ? 'ghost' : 'outline'} loading={busy === v.file} onClick={() => pick(v)}>
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />{v.exists ? 'Reemplazar' : `Subir ${v.file}`}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile} aria-hidden="true" tabIndex={-1} />
    </Card>
  );
}
