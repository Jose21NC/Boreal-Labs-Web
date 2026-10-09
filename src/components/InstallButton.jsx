import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Loader2, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';

export const APK_PATH = 'app-release.apk';
export const APK_URL = `${import.meta.env.BASE_URL}${APK_PATH}`.replace(
  /([^:]\/)\/+/g,
  '$1'
);

// Boton principal de instalacion.
//
// Antes de habilitar la descarga verificamos que el binario este desplegado.
// No es paranoia: `public/.htaccess` y `firebase.json` tienen un rewrite
// `**` -> index.html, asi que un APK ausente responde 200 con el HTML del
// sitio. Sin este chequeo, el usuario descarga index.html creyendo que
// instalo la app, y el fallo es invisible.
export function useApkDownload() {
  const [status, setStatus] = useState('idle'); // idle | checking | ready | missing
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    setStatus('checking');
    setError(null);
    try {
      const res = await fetch(APK_URL, { method: 'HEAD', cache: 'no-store' });
      const type = res.headers.get('content-type') || '';

      if (!res.ok) {
        setStatus('missing');
        setError(`HTTP ${res.status}`);
        return false;
      }
      if (type.includes('text/html')) {
        setStatus('missing');
        setError('el servidor devolvio HTML');
        return false;
      }
      setStatus('ready');
      return true;
    } catch (err) {
      setStatus('missing');
      setError(err?.message || 'sin respuesta');
      return false;
    }
  }, []);

  return { status, error, check };
}

// Variantes: 'hero' para el bloque grande de arriba, 'section' para el CTA final.
export default function InstallButton({ status, error, onCheck, variant = 'hero' }) {
  const label = 'Descargar Voxi App';
  const base =
    'inline-flex items-center justify-center gap-3 font-black rounded-3xl border-4 border-white transition-transform active:translate-y-1.5 disabled:cursor-not-allowed disabled:opacity-70';

  const sizes = {
    hero: 'w-full sm:w-auto px-10 py-6 text-xl sm:text-2xl shadow-[0_10px_0_#921E07]',
    section: 'w-full sm:w-auto px-9 py-5 text-lg sm:text-xl shadow-[0_8px_0_#921E07]',
  };

  const ready = status === 'ready';
  const checking = status === 'checking';
  const missing = status === 'missing';

  return (
    <div className="flex flex-col items-center gap-3">
      {ready && (
        <a
          href={APK_URL}
          download={APK_PATH}
          className={`${base} ${sizes[variant]} bg-[#D94426] hover:bg-[#C8391D] text-white`}
        >
          <Download className="w-7 h-7 shrink-0" />
          {label}
        </a>
      )}

      {!ready && !missing && (
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className={`${base} ${sizes[variant]} bg-[#D94426] hover:bg-[#C8391D] text-white`}
        >
          {checking ? (
            <>
              <Loader2 className="w-7 h-7 shrink-0 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <Download className="w-7 h-7 shrink-0" />
              {label}
            </>
          )}
        </button>
      )}

      {missing && (
        <>
          <div className="flex items-start gap-2 max-w-md text-left text-sm font-bold text-[#8A240E] bg-white/95 border-4 border-[#D94426] rounded-2xl px-5 py-4">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <span>
              La app ya se publico, pero el archivo{' '}
              <code className="font-black">{APK_PATH}</code> todavia no esta en el servidor.
              {error ? <span className="block text-xs opacity-70 mt-1">({error})</span> : null}
            </span>
          </div>
          <button
            type="button"
            onClick={onCheck}
            className={`${base} ${sizes[variant]} bg-white hover:bg-[#FFF7E6] text-[#D94426] shadow-[0_8px_0_#C8391D]`}
          >
            <RefreshCw className="w-6 h-6 shrink-0" />
            Reintentar
          </button>
        </>
      )}

      <p className="flex items-center gap-2 text-sm font-bold text-[#6E2211]">
        <Smartphone className="w-4 h-4 shrink-0" />
        Android 8.0 o superior · Gratis · 53 MB
      </p>
    </div>
  );
}