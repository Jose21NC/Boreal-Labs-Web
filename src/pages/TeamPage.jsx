import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import TeamMemberCard from '@/components/TeamMemberCard';
import { db } from '@/firebase.jsx';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { normalizeSection, normalizeTag, resolveMemberImage } from '@/lib/team';

const TeamPage = () => {
  const siteUrl = 'https://borealabs.org';
  const canonicalUrl = `${siteUrl}/equipo`;
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      // Sin Firebase configurado no hay equipo que cargar: mostrar el estado vacío.
      if (!db) { setLoading(false); return; }
      try {
        const q = query(collection(db, 'teamMembers'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const rawMembers = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const members = await Promise.all(rawMembers.map(async (member) => ({
          ...member,
          resolvedImageUrl: await resolveMemberImage(member),
          memberSection: normalizeSection(member),
          memberTag: normalizeTag(member),
        })));

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

  const renderMemberCard = (member, index) => <TeamMemberCard key={member.id} member={member} index={index} />;

  const renderTeamSection = (title, members) => (
    <section className="mb-16">
      <div className="mb-6 text-center">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-boreal-aqua">{title}</h2>
      </div>

      {members.length === 0 ? (
        <div className="glass-effect rounded-2xl border border-dashed border-white/15 p-8 text-center text-gray-400 text-sm">
          Todavía no hay integrantes publicados en esta sección.
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
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] mb-6">
              Conoce a Nuestro <span className="text-gradient">Equipo</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              Individuos dedicados que trabajan juntos para crear oportunidades para la juventud nicaragüense.
            </p>
          </motion.div>

          {loading ? (
            <div role="status" aria-label="Cargando equipo" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-effect rounded-2xl border border-white/10 p-6 animate-pulse">
                  <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-white/10" />
                  <div className="h-5 w-2/3 mx-auto mb-2 rounded bg-white/10" />
                  <div className="h-4 w-1/3 mx-auto mb-4 rounded bg-white/10" />
                  <div className="h-3 w-5/6 mx-auto rounded bg-white/5" />
                </div>
              ))}
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
            className="mt-20 text-center glass-effect rounded-3xl border border-white/10 px-6 py-10 md:p-14"
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