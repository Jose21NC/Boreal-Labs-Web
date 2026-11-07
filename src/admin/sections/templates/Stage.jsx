// Lienzo WYSIWYG: la página de la plantilla de fondo y las cajas de campos arrastrables/redimensionables.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

export const FIELDS = [
  { key: 'nombreUsuario', label: 'Nombre', sample: (d) => d.nombreUsuario },
  { key: 'nombreEvento', label: 'Evento', sample: (d) => d.nombreEvento },
  { key: 'ciudadFecha', label: 'Ciudad y fecha', sample: (d) => d.ciudadFecha },
  { key: 'descripcion', label: 'Descripción', sample: (d) => d.descripcion, hint: 'Párrafo del evento ("Descripción para el certificado"); si el evento no tiene, no se imprime.' },
  { key: 'tipoParticipacion', label: 'Modalidad', sample: (d) => d.modalidad, hint: 'Solo se imprime en certificados de participantes.' },
  { key: 'idValidacion', label: 'Código de validación', sample: (d) => d.idValidacion },
  { key: 'qrValidacion', label: 'Código QR', qr: true, hint: 'Enlaza a la página pública de validación.' },
];

const SNAP = 0.0025;
/** Mismo criterio que pickFont() del motor: 'bold' o >= 700. */
export const isBold = (w) => (typeof w === 'string' && /bold/i.test(w)) || Number(w) >= 700;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round4 = (v) => Math.round(v * 10000) / 10000;

/** Texto con el mismo estilo que el PDF, escalado al ancho del lienzo y con auto-ajuste si no cabe. */
function FieldText({ text, style, scale }) {
  const ref = useRef(null);
  const size = (style.fontSizePx || 20) * scale;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.fontSize = `${size}px`;
    const available = el.parentElement.clientWidth;
    if (style.autoFit !== false && el.scrollWidth > available && el.scrollWidth > 0) {
      el.style.fontSize = `${size * (available / el.scrollWidth)}px`;
    }
  });
  const align = (style.textAlign || 'left').toLowerCase();
  return (
    <span
      ref={ref}
      className="block w-full whitespace-nowrap leading-none"
      style={{
        fontFamily: `'${style.fontFamily || 'Libre Franklin'}', Helvetica, Arial, sans-serif`,
        fontWeight: isBold(style.fontWeight) ? 700 : 400,
        fontStyle: style.fontStyle || 'normal',
        color: style.color || '#000000',
        textAlign: align,
        textTransform: (style.transform || '').toLowerCase() === 'uppercase' ? 'uppercase' : 'none',
        letterSpacing: `${(parseFloat(String(style.tracking || 0)) || 0) * scale}px`,
      }}
    >
      {text}
    </span>
  );
}

/**
 * @param {{bgUrl?: string, aspect: number, layout: object, sample: object, selected: string, onSelect, onChange: (key, rel, transient) => void, onCommit}} props
 */
export default function Stage({ bgUrl, aspect, layout, sample, selected, onSelect, onChange, onCommit, loading }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  const [guide, setGuide] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scale = width / (layout.canvas?.widthPx || 2000);

  const startDrag = (event, key, mode) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(key);
    const rect = ref.current.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, rel: { ...layout.elements[key].rel } };
    const move = (ev) => {
      const snap = ev.shiftKey ? (v) => v : (v) => Math.round(v / SNAP) * SNAP; // Mayús = sin imán
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      const r = { ...start.rel };
      if (mode === 'move') {
        r.x = round4(clamp(snap(start.rel.x + dx), 0, 1 - r.width));
        r.y = round4(clamp(snap(start.rel.y + dy), 0, 1 - r.height));
      } else {
        r.width = round4(clamp(snap(start.rel.width + dx), 0.01, 1 - r.x));
        r.height = round4(clamp(snap(start.rel.height + dy), 0.01, 1 - r.y));
      }
      setGuide(Math.abs(r.x + r.width / 2 - 0.5) < 0.002);
      onChange(key, r, true);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setGuide(false);
      onCommit();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Teclado: flechas mueven (Mayús = paso grande), Alt+flechas redimensionan.
  const onKeyDown = (event, key) => {
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!dirs) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.01 : SNAP;
    const r = { ...layout.elements[key].rel };
    if (event.altKey) {
      r.width = round4(clamp(r.width + dirs[0] * step, 0.01, 1 - r.x));
      r.height = round4(clamp(r.height + dirs[1] * step, 0.01, 1 - r.y));
    } else {
      r.x = round4(clamp(r.x + dirs[0] * step, 0, 1 - r.width));
      r.y = round4(clamp(r.y + dirs[1] * step, 0, 1 - r.height));
    }
    onChange(key, r, false);
  };

  return (
    <div
      ref={ref}
      className="relative w-full select-none overflow-hidden rounded-lg border border-adm-border bg-white shadow-sm"
      style={{ aspectRatio: `${1 / aspect}` }}
      onPointerDown={() => onSelect(null)}
    >
      {bgUrl && <img src={bgUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full" draggable={false} />}
      {loading && <div className="absolute inset-0 animate-pulse bg-adm-surface-2" aria-hidden="true" />}
      {guide && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-adm-accent" aria-hidden="true" />}
      {width > 0 && FIELDS.map((f) => {
        const el = layout.elements[f.key];
        if (!el?.rel) return null;
        const active = selected === f.key;
        const { x, y, width: w, height: h } = el.rel;
        return (
          <div
            key={f.key}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={`${f.label}: x ${(x * 100).toFixed(1)}%, y ${(y * 100).toFixed(1)}%. Flechas para mover, Alt+flechas para redimensionar.`}
            onPointerDown={(e) => startDrag(e, f.key, 'move')}
            onFocus={() => onSelect(f.key)}
            onKeyDown={(e) => onKeyDown(e, f.key)}
            className={cn(
              'group absolute flex cursor-move items-center outline-none',
              active ? 'ring-2 ring-adm-accent' : 'ring-1 ring-adm-accent/40 hover:ring-adm-accent/80',
            )}
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, touchAction: 'none' }}
          >
            {f.qr ? (
              <QrCode className="h-full w-full text-black/70" strokeWidth={1.25} aria-hidden="true" />
            ) : (
              <FieldText text={f.sample(sample)} style={el.style || {}} scale={scale} />
            )}
            <span className={cn(
              'pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-adm-accent px-1.5 text-[10px] font-medium leading-4 text-adm-accent-fg',
              active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}>
              {f.label}
            </span>
            {active && (
              <span
                onPointerDown={(e) => startDrag(e, f.key, 'resize')}
                className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-adm-accent-fg bg-adm-accent"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
