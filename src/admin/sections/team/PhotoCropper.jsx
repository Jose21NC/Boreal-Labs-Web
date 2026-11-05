// Recorte circular de la foto de perfil antes de subirla.
import React, { useState } from 'react';
import Cropper from 'react-easy-crop';
import { Button, Field, Modal } from '@/admin/ui';
import { cropToFile } from './utils';

export default function PhotoCropper({ source, onCancel, onDone, onError }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!pixels) return;
    setBusy(true);
    try {
      onDone(await cropToFile(source.url, pixels, source.file.name));
    } catch (error) {
      console.error('Error recortando imagen de perfil:', error);
      onError('No se pudo recortar la imagen. Intenta con otra foto en JPG, PNG o WEBP.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!source}
      onClose={onCancel}
      title="Recortar foto de perfil"
      description="Arrastra para encuadrar; se publicará en formato circular."
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" loading={busy} disabled={!pixels} onClick={apply}>Aplicar recorte</Button>
        </>
      )}
    >
      <div className="relative h-72 overflow-hidden rounded-xl bg-adm-surface-2 sm:h-80">
        {source && (
          <Cropper
            image={source.url}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, p) => setPixels(p)}
          />
        )}
      </div>
      <Field label="Zoom" className="mt-4">
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[rgb(var(--adm-accent))]" />
      </Field>
    </Modal>
  );
}
