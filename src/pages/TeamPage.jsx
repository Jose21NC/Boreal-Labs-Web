import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
// --- MODIFICACIÓN 1: Importar nuevos iconos ---
import { Linkedin, Mail, Instagram, Smartphone, Link as LinkIcon } from 'lucide-react';
// --- FIN MODIFICACIÓN ---
import { Button } from '@/components/ui/button';
import { db, storage } from '@/firebase.jsx'; 
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';

const TeamPage = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Componente auxiliar para mostrar la imagen con fallback
  const MemberAvatar = ({ member }) => {
    // ... (Código del MemberAvatar sin cambios) ...
    const [imgError, setImgError] = useState(false);
    const [imgLoading, setImgLoading] = useState(true);

    const initials = member.name
      ? member.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()
      : '';

    const imageSrc = member.resolvedImageUrl || member.imageUrl || null;
    if (!imageSrc) {
      return (
        <div className="mb-6 overflow-hidden rounded-full w-40 h-40 mx-auto border-4 border-boreal-blue/50 flex items-center justify-center bg-white/5 text-white text-2xl font-bold">
          {initials}
        </div>
      );
    }

    return (
      <div className="mb-6 overflow-hidden rounded-full w-40 h-40 mx-auto border-4 border-boreal-blue/50 bg-white/5 flex items-center justify-center">
        {imgLoading && (
          <div className="animate-pulse w-full h-full flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/10" />
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
          <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
            {initials}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const q = query(collection(db, "teamMembers"), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);
        const rawMembers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const members = await Promise.all(rawMembers.map(async (m) => {
          const out = { ...m };
          try {
            if (Array.isArray(m.imageUrl) && m.imageUrl.length > 0) {
              const first = m.imageUrl[0];
              if (first.downloadURL) {
                out.resolvedImageUrl = first.downloadURL;
              } else if (first.ref) {
                out.resolvedImageUrl = await getDownloadURL(storageRef(storage, first.ref));
              }
            } else if (m.imageUrl && typeof m.imageUrl === 'string') {
              out.resolvedImageUrl = m.imageUrl;
            } else if (m.imageUrl && m.imageUrl.ref) {
              out.resolvedImageUrl = await getDownloadURL(storageRef(storage, m.imageUrl.ref));
            }
          } catch (e) {
            console.warn('No se pudo resolver imageUrl para', m.id, e);
            out.resolvedImageUrl = null;
          }
          return out;
        }));
        
        console.log("Miembros cargados desde Firestore (resueltas):", members);
        setTeamMembers(members);
      } catch (error) {
        console.error("Error al cargar miembros del equipo: ", error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchTeam();
    }, 1000); 

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Helmet>
        <title>Nuestro Equipo - Boreal Labs</title>
        <meta name="description" content="Conoce al apasionado equipo detrás de Boreal Labs, dedicado a empoderar a la juventud nicaragüense." />
      </Helmet>

      <div className="pt-32 pb-20 bg-boreal-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl md:text-6xl font-black mb-6">
              Conoce a Nuestro <span className="text-gradient">Equipo</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Individuos dedicados que trabajan juntos para crear oportunidades para la juventud nicaragüense.
            </p>
          </motion.div>

          {loading ? (
            <div className="text-center text-boreal-aqua text-xl">
              Cargando equipo...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="glass-effect rounded-2xl p-6 text-center hover:bg-white/10 transition-all group transform hover:-translate-y-2"
                >
                  <MemberAvatar member={member} />

                  <h3 className="text-2xl font-bold text-white mb-1">{member.name}</h3>
                  <div className="text-boreal-aqua font-semibold mb-3">{member.role}</div>
                  <p className="text-gray-400 mb-6 text-sm">{member.description}</p>

                  {/* --- MODIFICACIÓN 2: Añadir iconos condicionales --- */}
                  <div className="flex space-x-3 justify-center">
                    {/* LinkedIn (si existe) */}
                    {member.linkedinUrl && (
                      <motion.a
                        href={member.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                        aria-label="LinkedIn"
                      >
                        <Linkedin className="w-5 h-5 text-boreal-aqua" />
                      </motion.a>
                    )}

                    {/* Email (si existe) */}
                    {member.email && (
                      <motion.a
                        href={`mailto:${member.email}`}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                        aria-label="Email"
                      >
                        <Mail className="w-5 h-5 text-boreal-aqua" />
                      </motion.a>
                    )}

                    {/* Instagram (si existe) */}
                    {member.instagramUrl && (
                      <motion.a
                        href={member.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                        aria-label="Instagram"
                      >
                        <Instagram className="w-5 h-5 text-boreal-aqua" />
                      </motion.a>
                    )}
                    
                    {/* WhatsApp (si existe) - Asume que whatsappUrl es una URL wa.me/... */}
                    {member.whatsappUrl && (
                      <motion.a
                        href={member.whatsappUrl} // ej: "https://wa.me/50512345678"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                        aria-label="WhatsApp"
                      >
                        <Smartphone className="w-5 h-5 text-boreal-aqua" />
                      </motion.a>
                    )}

                    {/* Enlace Externo Genérico (si existe) */}
                    {member.externalUrl && (
                      <motion.a
                        href={member.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                        aria-label="Enlace externo"
                      >
                        <LinkIcon className="w-5 h-5 text-boreal-aqua" />
                      </motion.a>
                    )}
                  </div>
                  {/* --- FIN MODIFICACIÓN --- */}
                </motion.div>
              ))}
            </div>
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
              {/* ¡IMPORTANTE! Reemplaza '#' con el enlace a tu formulario de Rowy */}
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