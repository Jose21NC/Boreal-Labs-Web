import React from 'react';
import { Download, Smartphone } from 'lucide-react';

// Botón de descarga de Voxi App. El enlace es externo (Play Store u otro hosting) y se edita en
// /admin/sitio → Enlaces ("Descarga de Voxlab"); sin enlace se muestra "Próximamente".
export default function InstallButton({ href, variant = 'hero' }) {
  const base =
    'inline-flex items-center justify-center gap-3 font-black rounded-3xl border-4 border-white transition-transform active:translate-y-1.5';
  const sizes = {
    hero: 'w-full sm:w-auto px-10 py-6 text-xl sm:text-2xl shadow-[0_10px_0_#921E07]',
    section: 'w-full sm:w-auto px-9 py-5 text-lg sm:text-xl shadow-[0_8px_0_#921E07]',
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={`${base} ${sizes[variant]} bg-[#D94426] hover:bg-[#C8391D] text-white`}>
          <Download className="w-7 h-7 shrink-0" aria-hidden="true" />
          Descargar Voxi App
        </a>
      ) : (
        <button type="button" disabled className={`${base} ${sizes[variant]} bg-[#D94426] text-white opacity-70 cursor-not-allowed`}>
          <Download className="w-7 h-7 shrink-0" aria-hidden="true" />
          Próximamente
        </button>
      )}
      <p className="flex items-center gap-2 text-sm font-bold text-[#6E2211]">
        <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
        Android 8.0 o superior · Gratis
      </p>
    </div>
  );
}
