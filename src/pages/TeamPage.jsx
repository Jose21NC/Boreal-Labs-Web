import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Linkedin, Mail, Instagram, Smartphone, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, storage } from '@/firebase.jsx';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';

const TEAM_TAG_OPTIONS = [
  'Directiva General',
  'Operaciones',
  'Finanzas',
  'Redes',
  'Voluntariado',
  'Secretaria General',
  'Relaciones Institucionales',
];

const TAG_STYLES = {
  'Directiva General': 'border-sky-400/50 bg-sky-500/15 text-sky-200',
  Operaciones: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200',
  Finanzas: 'border-lime-400/50 bg-lime-500/15 text-lime-200',
  Redes: 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200',
  Voluntariado: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
  'Secretaria General': 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200',
  'Relaciones Institucionales': 'border-rose-400/50 bg-rose-500/15 text-rose-200',
};

const normalizeSection = (member) => {
  const raw = String(
    member.teamSection || member.teamType || member.group || member.area || ''
  )
    .toLowerCase()
    .trim();

  if (raw.includes('directiva') || raw.includes('board') || raw.includes('lider')) {
    return 'DIRECTIVA';
  }

  return 'STAFF';
};

const normalizeTag = (member) => {
  const rawTag = String(member.teamTag || member.tag || member.label || '').trim();
  const found = TEAM_TAG_OPTIONS.find((tag) => tag.toLowerCase() === rawTag.toLowerCase());
  if (found) {
    return found;
  }

  if (rawTag) {
    return rawTag;
  }

  return normalizeSection(member) === 'DIRECTIVA' ? 'Directiva General' : 'Operaciones';
};

const TeamPage = () => {
  const siteUrl = 'https://borealabs.org';
  const canonicalUrl = `${siteUrl}/equipo`;
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const MemberAvatar = ({ member }) => {
    const [imgError, setImgError] = useState(false);
    const [imgLoading, setImgLoading] = useState(true);

    const initials = member.name
      ? member.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
      : '';

    const imageSrc = member.resolvedImageUrl || member.imageUrl || null;
    if (!imageSrc) {
      return (
        <div className="mb-4 overflow-hidden rounded-full w-32 h-32 mx-auto border-2 border-boreal-blue/50 flex items-center justify-center bg-white/5 text-white text-xl font-bold">
          {initials}
        </div>
      );
    }

    return (
      <div className="mb-4 overflow-hidden rounded-full w-32 h-32 mx-auto border-2 border-boreal-blue/50 bg-white/5 flex items-center justify-center">
        {imgLoading && (
          <div className="animate-pulse w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white/10" />
          </div>
        )}
        {!imgError ? (
          <img
            alt={`${member.name} - ${member.role}`}
            className={`w-full h-full object-cover ${imgLoading ? 'hidden' : 'block'}`}
            src={imageSrc}
            onLoad={() => setImgLoading(false)}
            onError={() => { setImgError(true); setImgLoading(false); }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
            {initials}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const q = query(collection(db, 'teamMembers'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const rawMembers = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const members = await Promise.all(rawMembers.map(async (member) => {
          const out = { ...member };
          try {
            if (Array.isArray(member.imageUrl) && member.imageUrl.length > 0) {
              const first = member.imageUrl[0];
              if (first.downloadURL) {
                out.resolvedImageUrl = first.downloadURL;
              } else if (first.ref) {
                out.resolvedImageUrl = await getDownloadURL(storageRef(storage, first.ref));
              }
            } else if (member.imageUrl && typeof member.imageUrl === 'string') {
              out.resolvedImageUrl = member.imageUrl;
            } else if (member.imageUrl && member.imageUrl.ref) {
              out.resolvedImageUrl = await getDownloadURL(storageRef(storage, member.imageUrl.ref));
            }
          } catch (e) {
            console.warn('No se pudo resolver imageUrl para', member.id, e);
            out.resolvedImageUrl = null;
          }

          out.memberSection = normalizeSection(member);
          out.memberTag = normalizeTag(member);

          return out;
        }));

        setTeamMembers(members);
      } catch (error) {
        console.error('Error al cargar miembros del equipo: ', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchTeam();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const tagPriority = useMemo(() => {
    const counts = teamMembers.reduce((acc, member) => {
      const tag = String(member.memberTag || '').trim();
      if (!tag) return acc;
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});

    const directivaTag = 'Directiva General';
    const sortedTags = Object.keys(counts).sort((a, b) => {
      if (a === directivaTag && b !== directivaTag) return -1;
      if (b === directivaTag && a !== directivaTag) return 1;

      const diff = counts[b] - counts[a];
      if (diff !== 0) return diff;
      return a.localeCompare(b, 'es');
    });

    return new Map(sortedTags.map((tag, index) => [tag, index]));
  }, [teamMembers]);

  const sortMembersByTag = (members) => (
    [...members].sort((a, b) => {
      const aTag = String(a.memberTag || '').trim();
      const bTag = String(b.memberTag || '').trim();
      const aPriority = tagPriority.has(aTag) ? tagPriority.get(aTag) : Number.MAX_SAFE_INTEGER;
      const bPriority = tagPriority.has(bTag) ? tagPriority.get(bTag) : Number.MAX_SAFE_INTEGER;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      const aName = String(a.name || '').trim();
      const bName = String(b.name || '').trim();
      return aName.localeCompare(bName, 'es');
    })
  );

  const directivaMembers = useMemo(
    () => sortMembersByTag(teamMembers.filter((member) => member.memberSection === 'DIRECTIVA')),
    [teamMembers, tagPriority]
  );

  const staffMembers = useMemo(
    () => sortMembersByTag(teamMembers.filter((member) => member.memberSection !== 'DIRECTIVA')),
    [teamMembers, tagPriority]
  );

  const staffStructuredData = useMemo(() => {
    const itemListElement = staffMembers.map((member, index) => {
      const sameAs = [
        member.linkedinUrl,
        member.instagramUrl,
        member.whatsappUrl,
        member.externalUrl,
      ].filter(Boolean);

      const person = {
        '@type': 'Person',
        name: member.name,
      };

      if (member.role) person.jobTitle = member.role;
      if (member.description) person.description = member.description;
      if (sameAs.length > 0) person.sameAs = sameAs;

      return {
        '@type': 'ListItem',
        position: index + 1,
        item: person,
      };
    });

    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Miembros de STAFF - Boreal Labs',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: staffMembers.length,
      itemListElement,
    };
  }, [staffMembers]);

  const renderMemberCard = (member, index) => (
    <motion.div
      key={member.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      className="glass-effect rounded-2xl p-4 text-center hover:bg-white/10 transition-all group transform hover:-translate-y-1"
    >
      <MemberAvatar member={member} />

      <h3 className="text-xl font-bold text-white mb-1">{member.name}</h3>
      <div className="text-boreal-aqua font-medium mb-2 text-sm">{member.role}</div>

      {member.memberTag && (
        <div className="mb-3">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${TAG_STYLES[member.memberTag] || 'border-boreal-aqua/50 bg-boreal-aqua/10 text-boreal-aqua'}`}>
            {member.memberTag}
          </span>
        </div>
      )}

      <p className="text-gray-400 mb-4 text-xs">{member.description}</p>

      <div className="flex space-x-2 justify-center">
        {member.linkedinUrl && (
          <motion.a
            href={member.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
            aria-label="LinkedIn"
          >
            <Linkedin className="w-4 h-4 text-boreal-aqua" />
          </motion.a>
        )}

        {member.email && (
          <motion.a
            href={`mailto:${member.email}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
            aria-label="Email"
          >
            <Mail className="w-4 h-4 text-boreal-aqua" />
          </motion.a>
        )}

        {member.instagramUrl && (
          <motion.a
            href={member.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
            aria-label="Instagram"
          >
            <Instagram className="w-4 h-4 text-boreal-aqua" />
          </motion.a>
        )}

        {member.whatsappUrl && (
          <motion.a
            href={member.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
            aria-label="WhatsApp"
          >
            <Smartphone className="w-4 h-4 text-boreal-aqua" />
          </motion.a>
        )}

        {member.externalUrl && (
          <motion.a
            href={member.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors"
            aria-label="Enlace externo"
          >
            <LinkIcon className="w-4 h-4 text-boreal-aqua" />
          </motion.a>
        )}
      </div>
    </motion.div>
  );

  const renderTeamSection = (title, members) => (
    <section className="mb-16">
      <div className="mb-6 text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{title}</h2>
      </div>

      {members.length === 0 ? (
        <div className="glass-effect rounded-2xl p-6 text-gray-300 text-sm">
          No hay integrantes registrados en esta seccion.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member, index) => renderMemberCard(member, index))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <Helmet>
        <title>Nuestro Equipo - Boreal Labs</title>
        <meta name="description" content="Conoce al apasionado equipo detrás de Boreal Labs, dedicado a empoderar a la juventud nicaragüense." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content="Nuestro Equipo - Boreal Labs" />
        <meta property="og:description" content="Conoce al equipo y miembros de STAFF de Boreal Labs." />
        <meta property="og:url" content={canonicalUrl} />
        <script type="application/ld+json">
          {JSON.stringify(staffStructuredData)}
        </script>
      </Helmet>

      <div className="pt-32 pb-20 bg-boreal-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h1 className="text-4xl md:text-5xl font-black mb-6">
              Conoce a Nuestro <span className="text-gradient">Equipo</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              Individuos dedicados que trabajan juntos para crear oportunidades para la juventud nicaragüense.
            </p>
          </motion.div>

          {loading ? (
            <div className="text-center text-boreal-aqua text-xl">
              Cargando equipo...
            </div>
          ) : (
            <>
              {renderTeamSection('DIRECTIVA', directivaMembers)}
              {renderTeamSection('STAFF', staffMembers)}
            </>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-20 text-center glass-effect rounded-2xl p-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-gradient">Únete a Nuestro Equipo</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              ¿Eres una persona apasionada que quiere marcar la diferencia? ¡Aplica para unirte a nuestro equipo!
            </p>
            <Button
              size="lg"
              asChild
              className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white px-8 py-4 font-semibold text-lg"
            >
              <a href="https://wa.me/50557200949/?text=Hola!%20Estoy!%20interesado/a%20en%20formar%20parte%20del%20STAFF%20de%20Boreal%20Labs" target="_blank" rel="noopener noreferrer">
                Aplicar Ahora
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TeamPage;