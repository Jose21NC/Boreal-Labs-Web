// Rejillas de "Impacto" y "Aliados" del inicio. Las usan HomePage y la vista previa del panel admin.
import React from 'react';
import { Heart, Award, School as University, Zap, Building, Mic, Instagram, Star, Users } from 'lucide-react';

// Nombres guardados en siteConfig/home -> componentes de Lucide.
export const IMPACT_ICONS = { Heart, Award, University, Zap, Building, Mic, Instagram, Star, Users };

export function ImpactGrid({ impacts }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
      {impacts.map((impact, index) => {
        const Icon = IMPACT_ICONS[impact.icon] || Heart;
        return (
          <div key={index} className="glass-effect rounded-2xl p-8 border border-white/10">
            <Icon className="w-12 h-12 mx-auto mb-4 text-boreal-aqua" />
            <div className="text-4xl md:text-5xl font-extrabold tracking-tight tabular-nums text-white">{impact.metric}</div>
            <p className="mt-2 text-gray-400">{impact.description}</p>
          </div>
        );
      })}
    </div>
  );
}

export function PartnerGrid({ partners }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
      {partners.map((partner, index) => (
        <div key={index} className="flex flex-col items-center justify-center text-center gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
          <img
            src={partner.imgSrc}
            alt={partner.alt}
            className="h-14 w-full max-w-[8rem] object-contain"
            width={partner.width || 128}
            height={partner.height || 64}
            loading="lazy"
            decoding="async"
          />
          <span className="text-gray-400 text-xs sm:text-sm font-semibold leading-snug">{partner.name}</span>
        </div>
      ))}
    </div>
  );
}
