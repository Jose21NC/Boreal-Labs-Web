// Imágenes del sitio (portada, talleres, quiénes somos): subida a Storage site_images/ o imagen del build.
import React, { useState } from 'react';
import { RotateCcw, Upload } from 'lucide-react';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { compressImageFile } from '@/lib/image';
import { SITE_IMAGES } from '@/lib/siteDefaults';
import { Badge, Button, Card, CardBody } from '@/admin/ui';
import headerImage from '@/images/headear.webp';
import workshopImage from '@/images/taller.webp';
import quienesImage from '@/images/quienes.webp';

const DEFAULTS = { hero: headerImage, workshop: workshopImage, about: quienesImage };
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 8;
const safeFileName = (name) => String(name || 'imagen').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').slice(-80);

export default function ImagesEditor({ images, onChange }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(null);

  const upload = async (key, e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!TYPES.includes(picked.type)) {
      toast({ title: 'Formato no permitido', description: 'Usa JPG, PNG o WEBP.', variant: 'destructive' });
      return;
    }
    if (picked.size > MAX_MB * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: `La imagen debe pesar menos de ${MAX_MB} MB.`, variant: 'destructive' });
      return;
    }
    setUploading(key);
    try {
      // Se comprime antes de subir: estas imágenes se ven en cada visita (LCP en la portada).
      const file = await compressImageFile(picked);
      const fileRef = storageRef(storage, `site_images/${key}/${Date.now()}_${safeFileName(file.name)}`);
      await uploadBytes(fileRef, file, { contentType: file.type });
      onChange({ ...images, [key]: await getDownloadURL(fileRef) });
      toast({ title: 'Imagen subida', description: 'Recuerda guardar para publicarla.' });
    } catch (error) {
      console.error('Error subiendo imagen del sitio:', error);
      toast({ title: 'No se pudo subir la imagen', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-3">
      {SITE_IMAGES.map(({ key, label, hint }) => {
        const custom = images[key];
        return (
          <Card key={key}>
            <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <img
                src={custom || DEFAULTS[key]}
                alt=""
                className="aspect-video w-full shrink-0 rounded-lg border border-adm-border object-cover sm:w-48"
                loading="lazy"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-adm-text">{label}</p>
                  <Badge tone={custom ? 'accent' : 'neutral'}>{custom ? 'Personalizada' : 'Original del sitio'}</Badge>
                </div>
                <p className="text-xs text-adm-muted">{hint} JPG, PNG o WEBP · máx. {MAX_MB} MB (se comprime al subir).</p>
                <div className="flex flex-wrap gap-2">
                  <label className="relative inline-flex cursor-pointer">
                    <input type="file" accept={TYPES.join(',')} className="peer sr-only" onChange={(e) => upload(key, e)} disabled={uploading !== null} />
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-adm-border bg-adm-surface-2 px-3 text-xs font-medium text-adm-text hover:bg-adm-border/70 peer-focus-visible:ring-2 peer-focus-visible:ring-adm-accent peer-disabled:opacity-50">
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />{uploading === key ? 'Subiendo…' : custom ? 'Reemplazar' : 'Subir imagen'}
                    </span>
                  </label>
                  {custom && (
                    <Button size="sm" variant="ghost" onClick={() => onChange({ ...images, [key]: '' })}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Usar la original
                    </Button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
