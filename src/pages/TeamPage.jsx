import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Linkedin, Mail } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

const TeamPage = () => {
  const handleContactClick = () => {
    toast({
      title: "🚧 Funcionalidad en Construcción",
      description: "¡Esta función aún no está implementada, pero no te preocupes! ¡Puedes solicitarla en tu próximo mensaje! 🚀",
    });
  };

  const teamMembers = [
    {
      name: 'María González',
      role: 'Directora Ejecutiva',
      description: 'Apasionada por el empoderamiento juvenil y la innovación social.',
    },
    {
      name: 'Carlos Mendoza',
      role: 'Coordinador de Programas',
      description: 'Experto en educación empresarial y facilitación de talleres.',
    },
    {
      name: 'Ana Rodríguez',
      role: 'Gerente de Alianzas',
      description: 'Construyendo puentes entre universidades y centros de innovación.',
    },
    {
      name: 'Diego Martínez',
      role: 'Líder de Comunidad',
      description: 'Conectando con jóvenes en toda Nicaragua para expandir nuestro alcance.',
    },
    {
      name: 'Sofia Hernández',
      role: 'Coordinadora de Eventos',
      description: 'Creando experiencias memorables que inspiran y educan.',
    },
    {
      name: 'Luis Pérez',
      role: 'Asesor Tecnológico',
      description: 'Guiando nuestra transformación digital e iniciativas de innovación.',
    },
  ];

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="glass-effect rounded-2xl p-6 text-center hover:bg-white/10 transition-all group transform hover:-translate-y-2"
              >
                <div className="mb-6 overflow-hidden rounded-full w-40 h-40 mx-auto border-4 border-boreal-blue/50">
                  <img alt={`${member.name} - ${member.role}`} className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1575383596664-30f4489f9786" />
                </div>

                <h3 className="text-2xl font-bold text-white mb-1">{member.name}</h3>
                <div className="text-boreal-aqua font-semibold mb-3">{member.role}</div>
                <p className="text-gray-400 mb-6 text-sm">{member.description}</p>

                <div className="flex space-x-3 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleContactClick}
                    className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="w-5 h-5 text-boreal-aqua" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleContactClick}
                    className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
                    aria-label="Email"
                  >
                    <Mail className="w-5 h-5 text-boreal-aqua" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>

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
              onClick={handleContactClick}
              className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white px-8 py-4 font-semibold text-lg"
            >
              Contáctanos
            </Button>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TeamPage;