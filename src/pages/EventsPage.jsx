import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const EventsPage = () => {
  const [filter, setFilter] = useState('all');

  const handleRegister = (eventTitle) => {
    toast({
      title: "🚧 Funcionalidad de Registro",
      description: "¡Esta función aún no está implementada, pero no te preocupes! ¡Puedes solicitarla en tu próximo mensaje! 🚀",
    });
  };

  const events = [
    {
      id: 1,
      title: 'Startup Bootcamp 2025',
      date: 'Marzo 15-17, 2025',
      time: '9:00 AM - 5:00 PM',
      location: 'Universidad Nacional de Ingeniería',
      category: 'workshop',
      capacity: '50 participantes',
      description: 'Programa intensivo de tres días que cubre ideación, modelado de negocios, pitching y relaciones con inversores. Perfecto para futuros emprendedores.',
    },
    {
      id: 2,
      title: 'Tech Innovation Summit',
      date: 'Abril 22, 2025',
      time: '8:00 AM - 6:00 PM',
      location: 'Centro de Innovación Managua',
      category: 'conference',
      capacity: '200 participantes',
      description: 'Encuentro anual con ponentes principales, paneles de discusión y oportunidades de networking con líderes tecnológicos e innovadores de Centroamérica.',
    },
    {
      id: 3,
      title: 'Taller de Liderazgo Juvenil',
      date: 'Mayo 10, 2025',
      time: '2:00 PM - 6:00 PM',
      location: 'Universidad Centroamericana',
      category: 'workshop',
      capacity: '40 participantes',
      description: 'Desarrolla habilidades de liderazgo esenciales como comunicación, trabajo en equipo, toma de decisiones y pensamiento estratégico.',
    },
    {
      id: 4,
      title: 'Masterclass de Marketing Digital',
      date: 'Junio 5, 2025',
      time: '10:00 AM - 4:00 PM',
      location: 'Evento en Línea',
      category: 'workshop',
      capacity: '100 participantes',
      description: 'Aprende estrategias de marketing digital de vanguardia, gestión de redes sociales, creación de contenido y análisis para hacer crecer tu negocio.',
    },
    {
      id: 5,
      title: 'Noche de Networking: Conecta y Colabora',
      date: 'Junio 20, 2025',
      time: '6:00 PM - 9:00 PM',
      location: 'Hub de Boreal Labs',
      category: 'networking',
      capacity: '80 participantes',
      description: 'Evento nocturno casual diseñado para fomentar conexiones entre emprendedores, estudiantes, mentores y profesionales de la industria.',
    },
    {
      id: 6,
      title: 'Desafío de Innovación 2025',
      date: 'Julio 12-14, 2025',
      time: 'Todo el día',
      location: 'Múltiples Sedes',
      category: 'competition',
      capacity: '30 equipos',
      description: 'Competencia estilo hackathon donde los equipos desarrollan soluciones innovadoras a problemas del mundo real. Premios y mentoría disponibles.',
    },
  ];

  const categories = [
    { value: 'all', label: 'Todos los Eventos' },
    { value: 'workshop', label: 'Talleres' },
    { value: 'conference', label: 'Conferencias' },
    { value: 'networking', label: 'Networking' },
    { value: 'competition', label: 'Competencias' },
  ];

  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(event => event.category === filter);

  return (
    <>
      <Helmet>
        <title>Actividades - Boreal Labs</title>
        <meta name="description" content="Descubre los próximos talleres, conferencias y eventos de networking en Boreal Labs. Únete para aprender y crecer." />
      </Helmet>

      <div className="pt-32 pb-20 bg-boreal-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl md:text-6xl font-black mb-6">
              Nuestras <span className="text-gradient">Actividades</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Únete a nosotros para tener oportunidades emocionantes de aprender, conectar y hacer crecer tu viaje emprendedor.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {categories.map((category) => (
              <Button
                key={category.value}
                onClick={() => setFilter(category.value)}
                variant={filter === category.value ? 'default' : 'outline'}
                className={filter === category.value 
                  ? 'bg-gradient-to-r from-boreal-blue to-boreal-purple text-white' 
                  : 'border-boreal-aqua text-boreal-aqua hover:bg-boreal-aqua/10 hover:text-boreal-aqua'
                }
              >
                {category.label}
              </Button>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AnimatePresence>
              {filteredEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="glass-effect rounded-2xl p-8 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-gradient-to-br from-boreal-blue to-boreal-purple text-white text-xs font-bold px-3 py-1 rounded-lg uppercase">
                      {event.category}
                    </div>
                    <div className="flex items-center text-gray-400 text-sm">
                      <Users className="w-4 h-4 mr-1" />
                      {event.capacity}
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-gradient transition-all">
                    {event.title}
                  </h3>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-gray-300">
                      <Calendar className="w-5 h-5 mr-3 text-boreal-aqua" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <Clock className="w-5 h-5 mr-3 text-boreal-aqua" />
                      <span>{event.time}</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <MapPin className="w-5 h-5 mr-3 text-boreal-aqua" />
                      <span>{event.location}</span>
                    </div>
                  </div>

                  <p className="text-gray-400 mb-6">
                    {event.description}
                  </p>

                  <Button
                    onClick={() => handleRegister(event.title)}
                    className="w-full bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white font-bold"
                  >
                    Registrarse Ahora
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredEvents.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <p className="text-xl text-gray-400">No se encontraron eventos en esta categoría.</p>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
};

export default EventsPage;