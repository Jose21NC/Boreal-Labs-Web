import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { storage } from '@/firebase';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Editor visual para layout.json: permite cargar una imagen base y mover/redimensionar recuadros
// Dev-only: protegido tras /admin/layout via AdminGate

const DEFAULT_CANVAS = { widthPx: 2000, heightPx: 1414, orientation: 'landscape', paperHint: '≈ A4' };
const DEFAULT_ELEMENTS = {
  nombreUsuario: { rel: { x: 0.10, y: 0.297, width: 0.80, height: 0.078 }, style: { fontFamily: 'Libre Franklin', fontSizePx: 64, fontWeight: 800, fontStyle: 'normal', color: '#373737', textAlign: 'center', transform: 'uppercase' } },
  nombreEvento:  { rel: { x: 0.15, y: 0.431, width: 0.70, height: 0.056 }, style: { fontFamily: 'Libre Franklin', fontSizePx: 42, fontWeight: 700, fontStyle: 'normal', color: '#373737', textAlign: 'center' } },
  ciudadFecha:   { rel: { x: 0.125, y: 0.622, width: 0.75, height: 0.035 }, style: { fontFamily: 'Libre Franklin', fontSizePx: 26, fontWeight: 700, fontStyle: 'italic', color: '#373737', textAlign: 'center' } },
  tipoParticipacion: { rel: { x: 0.15, y: 0.75, width: 0.70, height: 0.035 }, style: { fontFamily: 'Libre Franklin', fontSizePx: 22, fontWeight: 600, fontStyle: 'normal', color: '#373737', textAlign: 'center' } },
  qrValidacion:  { rel: { x: 0.865, y: 0.78, width: 0.10, height: 0.141 } },
  idValidacion:  { rel: { x: 0.865, y: 0.938, width: 0.10, height: 0.022 }, style: { fontFamily: 'Libre Franklin', fontSizePx: 16, fontWeight: 400, fontStyle: 'normal', color: '#373737', textAlign: 'center' } },
};

const FIELDS = [
  { key: 'nombreUsuario', label: 'Nombre Usuario' },
  { key: 'nombreEvento', label: 'Nombre Evento' },
  { key: 'ciudadFecha', label: 'Ciudad y Fecha' },
  { key: 'tipoParticipacion', label: 'Tipo de Participación' },
  { key: 'qrValidacion', label: 'QR Validación' },
  { key: 'idValidacion', label: 'ID Validación' },
];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export default function LayoutEditor() {
  const [bgUrl, setBgUrl] = useState('');
  const [canvas, setCanvas] = useState(DEFAULT_CANVAS);
  const [safeMarginPx, setSafeMarginPx] = useState(35);
  const [elements, setElements] = useState(structuredClone(DEFAULT_ELEMENTS));
  const [activeKey, setActiveKey] = useState('nombreUsuario');
  const [showPreview, setShowPreview] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [snapStep, setSnapStep] = useState(0.005);

  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    function onResize() {
      const el = containerRef.current;
      if (!el) return;
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const aspect = canvas.widthPx / canvas.heightPx;
  // Altura estimada de la navbar (ajusta si tu navbar es más grande)
  const NAVBAR_HEIGHT = 64;
  const stageSize = useMemo(() => {
    const maxW = Math.min(1200, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 360);
    const maxH = typeof window !== 'undefined' ? window.innerHeight - NAVBAR_HEIGHT - 48 : 800;
    let baseW = Math.max(480, maxW) * zoom;
    let baseH = baseW / aspect;
    // Si el alto excede el área visible, ajusta el ancho
    if (baseH > maxH) {
      baseH = maxH;
      baseW = baseH * aspect;
    }
    return { w: baseW, h: baseH };
  }, [aspect, zoom]);

  useEffect(() => {
    setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    }, 0);
  }, [stageSize.w, stageSize.h]);

  const onBgSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgUrl(url);
    const img = new Image();
    img.onload = () => {
      setCanvas(c => ({ ...c, widthPx: img.naturalWidth, heightPx: img.naturalHeight }));
    };
    img.src = url;
  };

  const onImportLayout = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (json.canvas) setCanvas(json.canvas);
        if (typeof json.safeMarginPx === 'number') setSafeMarginPx(json.safeMarginPx);
        if (json.elements) {
          const next = { ...elements };
          for (const k of Object.keys(json.elements)) {
            const v = json.elements[k];
            if (v?.rel) next[k] = { ...(next[k] || {}), ...v };
          }
          setElements(next);
        }
      } catch (err) {
        alert('JSON inválido');
      }
    };
    reader.readAsText(file);
  };

  const updateRel = (key, updater) => {
    setElements((prev) => {
      const cur = prev[key] || { rel: { x: 0, y: 0, width: 0.2, height: 0.05 } };
      const rel = { ...cur.rel };
      updater(rel);
      return { ...prev, [key]: { ...cur, rel } };
    });
  };

  const snapVal = (v) => (snap ? Math.round(v / snapStep) * snapStep : v);

  const onDrag = (key, dx, dy) => {
    setElements(prev => {
      const cur = prev[key];
      if (!cur) return prev;
      const rel = { ...cur.rel };
      const xpx = rel.x * containerSize.w + dx;
      const ypx = rel.y * containerSize.h + dy;
      rel.x = clamp(snapVal(xpx / containerSize.w), 0, 1 - rel.width);
      rel.y = clamp(snapVal(ypx / containerSize.h), 0, 1 - rel.height);
      return { ...prev, [key]: { ...cur, rel } };
    });
  };

  const onResizeHandle = (key, dw, dh) => {
    setElements(prev => {
      const cur = prev[key];
      if (!cur) return prev;
      const rel = { ...cur.rel };
      const wpx = rel.width * containerSize.w + dw;
      const hpx = rel.height * containerSize.h + dh;
      rel.width = clamp(snapVal(wpx / containerSize.w), 0.02, 1 - rel.x);
      rel.height = clamp(snapVal(hpx / containerSize.h), 0.02, 1 - rel.y);
      return { ...prev, [key]: { ...cur, rel } };
    });
  };

  const buildJson = () => {
    const elems = {};
    for (const k of Object.keys(elements)) {
      const e = elements[k];
      const rel = e.rel;
      const absPx = {
        x: Math.round(rel.x * canvas.widthPx),
        y: Math.round(rel.y * canvas.heightPx),
        width: Math.round(rel.width * canvas.widthPx),
        height: Math.round(rel.height * canvas.heightPx),
      };
      elems[k] = { absPx, rel, style: e.style };
    }
    const out = {
      canvas,
      safeMarginPx,
      elements: elems,
    };
    return out;
  };

  const downloadJson = () => {
    const out = buildJson();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'layout.json';
    a.click();
  };

  const uploadToStorage = async () => {
    try {
      const out = buildJson();
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const path = 'cert-templates/layout.json';
      const ref = storageRef(storage, path);
      await uploadBytes(ref, blob, { contentType: 'application/json' });
      alert('layout.json subido a Storage en ' + path);
    } catch (e) {
      alert('Error subiendo a Storage: ' + (e?.message || e));
    }
  };

  const Box = ({ k, label }) => {
    const e = elements[k];
    if (!e) return null;
    const left = e.rel.x * containerSize.w;
    const top = e.rel.y * containerSize.h;
    const width = e.rel.width * containerSize.w;
    const height = e.rel.height * containerSize.h;

    const isActive = activeKey === k;
    let dragStart = null;
    let resizeStart = null;

    const onMouseDown = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setActiveKey(k);
      dragStart = { x: ev.clientX, y: ev.clientY };
      const move = (e2) => {
        if (!dragStart) return;
        onDrag(k, e2.clientX - dragStart.x, e2.clientY - dragStart.y);
        dragStart = { x: e2.clientX, y: e2.clientY };
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    };

    const onResizeMouseDown = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      resizeStart = { x: ev.clientX, y: ev.clientY };
      const move = (e2) => {
        if (!resizeStart) return;
        onResizeHandle(k, e2.clientX - resizeStart.x, e2.clientY - resizeStart.y);
        resizeStart = { x: e2.clientX, y: e2.clientY };
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    };

  const labelBg = isActive ? 'rgba(59,130,246,0.9)' : 'rgba(0,0,0,0.6)';

    return (
      <div
        className="absolute border-2 border-blue-500/70 hover:border-blue-500 cursor-move rounded-md backdrop-blur-[1px]"
        style={{ left, top, width, height, boxShadow: isActive ? '0 0 0 2px rgba(59,130,246,0.6) inset, 0 8px 20px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.2)' }}
        onMouseDown={onMouseDown}
        title={label}
      >
        <div style={{ position: 'absolute', left: 0, top: -26, color: '#fff', background: labelBg, padding: '2px 8px', fontSize: 12, borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
          {label}
        </div>
        {/* Handler de resize en esquina inferior derecha */}
        <div
          onMouseDown={onResizeMouseDown}
          style={{ position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, background: '#3b82f6', borderRadius: 4, cursor: 'nwse-resize', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
        />
        {/* Vista previa de texto */}
        {showPreview && e.style && (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: e.style.textAlign || 'left',
            color: e.style.color || '#373737', fontWeight: e.style.fontWeight || 400, fontStyle: e.style.fontStyle || 'normal',
            fontFamily: e.style.fontFamily || 'Libre Franklin', fontSize: Math.max(10, (e.style.fontSizePx || 20) * (containerSize.w / canvas.widthPx)),
            textTransform: e.style.transform || 'none', padding: 6,
            letterSpacing: `${((e.style.tracking || 0) * (containerSize.w / canvas.widthPx)).toFixed(2)}px`
          }}>
            {k}
          </div>
        )}
      </div>
    );
  };

  const activeStyle = elements[activeKey]?.style || {};

  return (
    <div
      className="mx-auto max-w-[1400px] px-4 pt-[96px] pb-6 text-white min-h-screen"
      style={{ paddingTop: `${NAVBAR_HEIGHT + 32}px`, boxSizing: 'border-box', overflow: 'auto' }}
    >
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight text-gradient">Editor visual de layout.json</h1>
          <p className="text-neutral-300 text-base">Arrastra y redimensiona los recuadros sobre tu plantilla. Activa el grid y el snap para precisión.</p>
        </div>
        <div>
          <Link to="/admin" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all border border-boreal-aqua/60 bg-white/5 hover:bg-white/10 shadow-[0_0_18px_rgba(45,212,191,0.25)]">
            ← Volver al panel
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6">
        {/* Lienzo */}
        <div>
          <div className="flex items-center gap-4 mb-3 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input id="chkPreview" type="checkbox" checked={showPreview} onChange={e => setShowPreview(e.target.checked)} className="accent-boreal-aqua w-4 h-4 rounded focus:ring-2 focus:ring-boreal-aqua" />
                <span className="text-neutral-200 text-base">Vista previa</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input id="chkGrid" type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-boreal-aqua w-4 h-4 rounded focus:ring-2 focus:ring-boreal-aqua" />
                <span className="text-neutral-200 text-base">Grid</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input id="chkSnap" type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} className="accent-boreal-aqua w-4 h-4 rounded focus:ring-2 focus:ring-boreal-aqua" />
                <span className="text-neutral-200 text-base">Snap</span>
              </label>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-neutral-200 text-base">Zoom</span>
                <input className="accent-boreal-aqua" type="range" min="0.5" max="2" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                <span className="text-neutral-300 text-sm">{Math.round(zoom * 100)}%</span>
              </div>
            </div>
          </div>
          <div
            ref={containerRef}
            className="relative bg-neutral-900/60 border border-neutral-700 rounded-xl overflow-hidden shadow-xl"
            style={{ width: stageSize.w, height: stageSize.h, backgroundImage: bgUrl ? `url(${bgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
          >
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            )}
            {/* Margen seguro visual */}
            <div className="absolute border-2 border-yellow-400/60 rounded" style={{ left: (safeMarginPx / canvas.widthPx) * containerSize.w, top: (safeMarginPx / canvas.heightPx) * containerSize.h, width: containerSize.w - 2 * (safeMarginPx / canvas.widthPx) * containerSize.w, height: containerSize.h - 2 * (safeMarginPx / canvas.heightPx) * containerSize.h, boxShadow: 'inset 0 0 0 2px rgba(234,179,8,0.2)' }} />

            {FIELDS.map(f => (
              <Box key={f.key} k={f.key} label={f.label} />
            ))}
          </div>
          <div className="mt-3" />
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          <div className="bg-white/5 p-4 rounded-xl border border-white/10 shadow-lg">
            <div className="font-semibold mb-3">Lienzo y base</div>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <Label className="block text-sm text-neutral-300">Ancho (px)</Label>
                <Input type="number" value={canvas.widthPx} onChange={e => setCanvas(c => ({ ...c, widthPx: Number(e.target.value) || 1 }))} />
              </div>
              <div className="flex-1">
                <Label className="block text-sm text-neutral-300">Alto (px)</Label>
                <Input type="number" value={canvas.heightPx} onChange={e => setCanvas(c => ({ ...c, heightPx: Number(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="mb-2">
              <Label className="block text-sm text-neutral-300">Margen seguro (px)</Label>
              <Input type="number" value={safeMarginPx} onChange={e => setSafeMarginPx(Number(e.target.value) || 0)} />
            </div>
            <div className="mb-2">
              <Label className="block text-sm text-neutral-300 mb-1">Imagen base (PNG/JPG)</Label>
              <Input type="file" accept="image/*" onChange={onBgSelect} />
            </div>
            <div className="mb-2">
              <Label className="block text-sm text-neutral-300 mb-1">Importar layout.json</Label>
              <Input type="file" accept="application/json" onChange={onImportLayout} />
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" onClick={downloadJson}>Descargar layout.json</Button>
              <Button variant="default" onClick={uploadToStorage}>Subir a Storage</Button>
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/10 shadow-lg">
            <div className="font-semibold mb-3">Campos</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {FIELDS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveKey(f.key)}
                  className={`px-3 py-2 rounded-lg border font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${activeKey === f.key ? 'border-blue-500 text-blue-500 bg-blue-500/10 ring-2 ring-blue-400' : 'border-neutral-600 text-neutral-300 bg-neutral-900 hover:border-blue-400 hover:text-blue-400'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {activeKey && (
              <>
                {elements[activeKey]?.rel ? (
                  <div className="space-y-2">
                    <div className="text-sm text-neutral-300">Rel (x,y,w,h)</div>
                    <div className="grid grid-cols-4 gap-2">
                      <Input type="number" step="0.001" value={elements[activeKey].rel.x} onChange={e => updateRel(activeKey, r => r.x = clamp(Number(e.target.value) || 0, 0, 1))} />
                      <Input type="number" step="0.001" value={elements[activeKey].rel.y} onChange={e => updateRel(activeKey, r => r.y = clamp(Number(e.target.value) || 0, 0, 1))} />
                      <Input type="number" step="0.001" value={elements[activeKey].rel.width} onChange={e => updateRel(activeKey, r => r.width = clamp(Number(e.target.value) || 0, 0, 1))} />
                      <Input type="number" step="0.001" value={elements[activeKey].rel.height} onChange={e => updateRel(activeKey, r => r.height = clamp(Number(e.target.value) || 0, 0, 1))} />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-400">Este campo no tiene configuración de posición.</div>
                )}
                {elements[activeKey]?.style && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="block text-sm text-neutral-300">Font Size (px)</Label>
                        <Input type="number" value={elements[activeKey].style.fontSizePx || 20} onChange={e => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, fontSizePx: Number(e.target.value) || 1 } } }))} />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="w-full">
                          <Label className="block text-sm text-neutral-300">Peso</Label>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, fontWeight: 400 } } }))} className={`flex-1 px-2 py-1 rounded-md border text-sm ${((elements[activeKey].style.fontWeight || 400) < 700) ? 'border-boreal-aqua text-boreal-aqua bg-boreal-aqua/10' : 'border-white/10 text-neutral-300 hover:border-boreal-aqua/60'}`}>Normal</button>
                            <button type="button" onClick={() => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, fontWeight: 700 } } }))} className={`flex-1 px-2 py-1 rounded-md border text-sm ${((elements[activeKey].style.fontWeight || 400) >= 700) ? 'border-boreal-aqua text-boreal-aqua bg-boreal-aqua/10' : 'border-white/10 text-neutral-300 hover:border-boreal-aqua/60'}`}>Bold</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="block text-sm text-neutral-300">Alineación</Label>
                        <select className="w-full bg-neutral-900 border border-neutral-700 rounded p-2" value={elements[activeKey].style.textAlign || 'left'} onChange={e => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, textAlign: e.target.value } } }))}>
                          <option value="left">left</option>
                          <option value="center">center</option>
                          <option value="right">right</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-4">
                        <label className="inline-flex items-center gap-2"><input className="accent-boreal-aqua" type="checkbox" checked={(elements[activeKey].style.fontStyle || 'normal').toLowerCase().includes('italic')} onChange={e => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, fontStyle: e.target.checked ? 'italic' : 'normal' } } }))} /> Italic</label>
                        <label className="inline-flex items-center gap-2"><input className="accent-boreal-aqua" type="checkbox" checked={(elements[activeKey].style.transform || 'none') === 'uppercase'} onChange={e => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, transform: e.target.checked ? 'uppercase' : 'none' } } }))} /> Uppercase</label>
                      </div>
                    </div>
                    <div>
                      <Label className="block text-sm text-neutral-300">Color</Label>
                      <Input type="text" value={elements[activeKey].style.color || '#373737'} onChange={e => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, color: e.target.value } } }))} />
                    </div>
                    <div>
                      <Label className="block text-sm text-neutral-300">Fuente</Label>
                      <Input type="text" value={elements[activeKey].style.fontFamily || 'Libre Franklin'} onChange={e => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, fontFamily: e.target.value } } }))} />
                    </div>
                    <div>
                      <Label className="block text-sm text-neutral-300">Tracking (px)</Label>
                      <Input type="number" step="0.1" value={elements[activeKey].style.tracking || 0} onChange={e => setElements(s => ({ ...s, [activeKey]: { ...s[activeKey], style: { ...s[activeKey].style, tracking: Number(e.target.value) || 0 } } }))} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-neutral-400 mt-4">Consejo: carga la imagen del certificado como fondo, ajusta los recuadros y descarga el JSON. Luego súbelo a Storage en <code>cert-templates/layout.json</code>.</p>
    </div>
  );
}
