// Tarjeta pública de un integrante. La usan /equipo y la previsualización del panel admin.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Linkedin, Mail, Instagram, Smartphone, Link as LinkIcon } from 'lucide-react';
import { TAG_STYLES, safeUrl } from '@/lib/team';

const initialsOf = (name) => (name ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '');

function MemberAvatar({ member }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const initials = initialsOf(member.name);
  const imageSrc = member.resolvedImageUrl || (typeof member.imageUrl === 'string' ? member.imageUrl : null);

  if (!imageSrc) {
    return (
      <div className="mb-4 overflow-hidden rounded-full w-32 h-32 mx-auto border-2 border-boreal-blue/50 flex items-center justify-center bg-white/5 text-white text-xl font-bold">
        {initials}
      </div>
    );
  }

  return (
    <div className="relative mb-4 overflow-hidden rounded-full w-32 h-32 mx-auto border-2 border-boreal-blue/50 bg-white/5 flex items-center justify-center">
      {imgLoading && (
        <div className="absolute inset-0 animate-pulse flex items-center justify-center bg-white/5 z-10">
          <div className="w-8 h-8 rounded-full bg-white/10" />
        </div>
      )}
      {!imgError ? (
        <img
          alt={`${member.name} - ${member.role}`}
          className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
          src={imageSrc}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoading(false)}
          onError={() => { setImgError(true); setImgLoading(false); }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">{initials}</div>
      )}
    </div>
  );
}

const linkClass = 'inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors';
const hover = { whileHover: { scale: 1.1 }, whileTap: { scale: 0.95 } };

export default function TeamMemberCard({ member, index = 0 }) {
  const links = [
    ['LinkedIn', safeUrl(member.linkedinUrl), Linkedin],
    ['Email', member.email ? `mailto:${member.email}` : null, Mail],
    ['Instagram', safeUrl(member.instagramUrl), Instagram],
    ['WhatsApp', safeUrl(member.whatsappUrl), Smartphone],
    ['Enlace externo', safeUrl(member.externalUrl), LinkIcon],
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: Math.min(index, 15) * 0.05 }}
      className="glass-effect rounded-2xl border border-white/10 p-6 text-center transition-[transform,background-color,border-color] duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-boreal-aqua/30 group"
    >
      <MemberAvatar key={member.resolvedImageUrl || member.imageUrl || ''} member={member} />

      <h3 className="text-xl font-bold text-white mb-1">{member.name}</h3>
      <div className="text-boreal-aqua font-medium mb-2 text-sm">{member.role}</div>

      {member.memberTag && (
        <div className="mb-3">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${TAG_STYLES[member.memberTag] || 'border-boreal-aqua/50 bg-boreal-aqua/10 text-boreal-aqua'}`}>
            {member.memberTag}
          </span>
        </div>
      )}

      <p className="text-gray-400 mb-4 text-sm leading-relaxed">{member.description}</p>

      <div className="flex space-x-2 justify-center">
        {links.map(([label, href, Icon]) => href && (
          <motion.a
            key={label}
            href={href}
            {...(label === 'Email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            {...hover}
            className={linkClass}
            aria-label={label}
          >
            <Icon className="w-4 h-4 text-boreal-aqua" />
          </motion.a>
        ))}
      </div>
    </motion.div>
  );
}
