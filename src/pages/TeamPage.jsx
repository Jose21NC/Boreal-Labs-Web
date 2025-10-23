import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Linkedin, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Importamos la conexión a la base de datos
import { db } from '@/firebase.jsx'; 
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const TeamPage = () => {
  // Estado para guardar los miembros del equipo y el estado de carga
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Este 'useEffect' se ejecuta una vez cuando la página carga
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        // 1. Prepara la consulta: "Obtener la colección 'teamMembers' y ordenarla por 'name'"
        const q = query(collection(db, "teamMembers"), orderBy("name", "asc"));
        
        // 2. Ejecuta la consulta
        const querySnapshot = await getDocs(q);
        
        // 3. Convierte los documentos de Firebase en un array que React entienda
        const members = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // 4. Guarda los miembros en el estado
        setTeamMembers(members);
      } catch (error) {
        console.error("Error al cargar miembros del equipo: ", error);
      } finally {
        // 5. Quita el mensaje de "Cargando..."
        setLoading(false);
      }
    };

    fetchTeam();
  }, []); // El array vacío [] asegura que esto se ejecute solo una vez

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

          {/* Si está cargando, muestra un mensaje */}
          {loading ? (
            <div className="text-center text-boreal-aqua text-xl">
              Cargando equipo...
            </div>
          ) : (
            // Si ya cargó, muestra la cuadrícula de miembros
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.id} // Usa el ID de Firestore
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="glass-effect rounded-2xl p-6 text-center hover:bg-white/10 transition-all group transform hover:-translate-y-2"
                >
                  <div className="mb-6 overflow-hidden rounded-full w-40 h-40 mx-auto border-4 border-boreal-blue/50">
                    <img alt={`${member.name} - ${member.role}`} className="w-full h-full object-cover" src={member.imageUrl} />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-1">{member.name}</h3>
                  <div className="text-boreal-aqua font-semibold mb-3">{member.role}</div>
                  <p className="text-gray-400 mb-6 text-sm">{member.description}</p>

                  <div className="flex space-x-3 justify-center">
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
                    <motion.a
                      href={`mailto:${member.email}`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                      aria-label="Email"
                    >
                      <Mail className="w-5 h-5 text-boreal-aqua" />
                    </motion.a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          
          {/* Sección "Únete" (no cambia) */}
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
              Siempre estamos buscando personas apasionadas que quieran marcar la diferencia en la vida de los jóvenes de Nicaragua.
            </p>
            <Button
              size="lg"
              asChild
              className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white px-8 py-4 font-semibold text-lg"
            >
              <a href="mailto:info@boreallabs.org">
                Contáctanos
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TeamPage;