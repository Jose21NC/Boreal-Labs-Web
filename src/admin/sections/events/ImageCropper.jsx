// Recorte 16:9 de la imagen del evento (mismo formato que la tarjeta pública).
import React, { useState } from 'react';
import Cropper from 'react-easy-crop';
import { Button, Field } from '@/admin/ui';

async function cropToFile(src, px, originalName) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = px.width;
  canvas.height = px.height;
  canvas.getContext('2d').drawImage(img, px.x, px.y, px.width, px.height, 0, 0, px.width, px.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  return new File([blob], `${(originalName || 'evento').replace(/\.[^/.]+$/, '')}-16x9.jpg`, { type: 'image/jpeg' });
}

/** Recortador en línea (no modal: un modal anidado se cerraría junto con el formulario al pulsar Escape). */
export default function ImageCropper({ source, onCancel, onDone }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!pixels) return;
    setBusy(true);
    try {
      onDone(await cropToFile(source.url, pixels, source.file.name));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-adm-border bg-adm-surface-2/50 p-3">
      <div className="relative h-56 overflow-hidden rounded-lg bg-adm-surface-2 sm:h-72">
        <Cropper
          image={source.url}
          crop={crop}
          zoom={zoom}
          aspect={16 / 9}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, px) => setPixels(px)}
          objectFit="cover"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Zoom" className="min-w-[160px] flex-1">
          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[rgb(var(--adm-accent))]" />
        </Field>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={apply} loading={busy} disabled={!pixels}>Aplicar recorte 16:9</Button>
      </div>
    </div>
  );
}
