// Aliados e instituciones: nombre, alt y logo (URL o subida a Storage partner_logos/).
import React, { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { Button, Card, CardBody, Field, Input } from '@/admin/ui';
import ItemControls, { moveItem } from './ItemControls';

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_MB = 2;
const safeFileName = (name) => String(name || 'logo').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').slice(-80);

// Dimensiones reales del logo para width/height del <img> (evita saltos de layout).
const imageSize = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { resolve({ width: img.naturalWidth || 128, height: img.naturalHeight || 64 }); URL.revokeObjectURL(url); };
  img.onerror = () => { resolve({ width: 128, height: 64 }); URL.revokeObjectURL(url); };
  img.src = url;
});

export default function PartnersEditor({ partners, onChange, errors }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(null);
  const update = (i, patch) => onChange(partners.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const upload = async (i, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast({ title: 'Formato no permitido', description: 'Usa PNG, JPG, WEBP o SVG.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: `El logo debe pesar menos de ${MAX_LOGO_MB} MB.`, variant: 'destructive' });
      return;
    }
    setUploading(i);
    try {
      const fileRef = storageRef(storage, `partner_logos/${Date.now()}_${safeFileName(file.name)}`);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const [url, size] = await Promise.all([getDownloadURL(fileRef), imageSize(file)]);
      update(i, { imgSrc: url, ...size });
      toast({ title: 'Logo subido', description: 'Recuerda guardar para publicarlo.' });
    } catch (error) {
      console.error('Error subiendo logo:', error);
      toast({ title: 'No se pudo subir el logo', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-3">
      {partners.map((partner, i) => (
        <Card key={i}>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-lg border border-adm-border bg-boreal-dark p-2 sm:w-32">
              {partner.imgSrc
                ? <img src={partner.imgSrc} alt="" className="max-h-full max-w-full object-contain" />
                : <span className="text-xs text-adm-muted">Sin logo</span>}
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <Field label="Nombre de la institución" error={errors[`partners.${i}.name`]}>
                <Input value={partner.name || ''} onChange={(e) => update(i, { name: e.target.value })} />
              </Field>
              <Field label="Texto alternativo" hint="Para lectores de pantalla.">
                <Input value={partner.alt || ''} onChange={(e) => update(i, { alt: e.target.value })} placeholder={`Logo ${partner.name || ''}`} />
              </Field>
              <Field label="URL del logo" className="sm:col-span-2" error={errors[`partners.${i}.imgSrc`]}>
                <Input
                  value={partner.imgSrc || ''}
                  onChange={(e) => update(i, { imgSrc: e.target.value, width: undefined, height: undefined })}
                  placeholder="https://…"
                />
              </Field>
              <div className="sm:col-span-2">
                <label className="inline-flex">
                  <input type="file" accept={LOGO_TYPES.join(',')} className="peer sr-only" onChange={(e) => upload(i, e)} disabled={uploading !== null} />
                  <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-adm-border bg-adm-surface-2 px-3 text-xs font-medium text-adm-text hover:bg-adm-border/70 peer-focus-visible:ring-2 peer-focus-visible:ring-adm-accent peer-disabled:opacity-50">
                    <Upload className="h-3.5 w-3.5" />{uploading === i ? 'Subiendo…' : 'Subir logo'}
                  </span>
                </label>
                <span className="ml-2 text-xs text-adm-muted">PNG, JPG, WEBP o SVG · máx. {MAX_LOGO_MB} MB</span>
              </div>
            </div>
            <ItemControls
              index={i}
              total={partners.length}
              label={partner.name || `aliado ${i + 1}`}
              onMove={(from, to) => onChange(moveItem(partners, from, to))}
              onRemove={(idx) => onChange(partners.filter((_, k) => k !== idx))}
            />
          </CardBody>
        </Card>
      ))}
      <Button className="w-full" onClick={() => onChange([...partners, { name: '', alt: '', imgSrc: '' }])}>
        <Plus className="h-4 w-4" />Agregar aliado
      </Button>
    </div>
  );
}
