import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// --- MODIFICACIÓN 1: Objeto de traducción para las categorías ---
// Esto traduce los valores internos (ej. 'workshop') a texto visible en español
const categoryDisplayNames = {
  'workshop': 'Taller',
  'conference': 'Conferencia',
  'networking': 'Networking',
  'competition': 'Competencia',
};
// --- FIN DE LA MODIFICACIÓN ---

const EventsPage = () => {
  const [filter, setFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleRegistrationSubmit = (eventTitle) => {
    toast({
      title: "🚧 Formulario en construcción",
      description: `El registro para "${eventTitle}" aún no está implementado.`,
    });
    setSelectedEvent(null);
  };

  // Los datos de tus eventos (eventualmente vendrán de tu admin panel)
  const events = [
    {
      id: 1,
      title: 'Startup Bootcamp 2025',
      date: 'Marzo 15-17, 2025',
      time: '9:00 AM - 5:00 PM',
      location: 'Universidad Nacional de Ingeniería',
      category: 'workshop', // El valor interno sigue igual para el filtro
      capacity: '50 participantes',
      description: 'Programa intensivo de tres días que cubre ideación, modelado de negocios, pitching y relaciones con inversores. Perfecto para futuros emprendedores.',
    },
    {
      id: 2,
      title: 'Tech Innovation Summit',
      date: 'Abril 22, 2025',
      time: '8:00 AM - 6:00 PM',
      location: 'Centro de Innovación Managua',
      category: 'conference', // El valor interno sigue igual para el filtro
      capacity: '200 participantes',
      description: 'Encuentro anual con ponentes principales, paneles de discusión y oportunidades de networking con líderes tecnológicos e innovadores de Centroamérica.',
    },
    // ... (etc.)
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
                  className="glass-effect rounded-2xl p-8 hover:bg-white/10 transition-all group flex flex-col"
                >
                  <div className="flex-grow">
                    <div className="flex items-start justify-between mb-4">
                      {/* --- MODIFICACIÓN 2: Usar el objeto de traducción --- */}
                      <div className="bg-gradient-to-br from-boreal-blue to-boreal-purple text-white text-xs font-bold px-3 py-1 rounded-lg uppercase">
                        {categoryDisplayNames[event.category] || event.category}
                      </div>
                      {/* --- FIN DE LA MODIFICACIÓN --- */}
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
                  </div>
                  
                  <Button
                    onClick={() => setSelectedEvent(event)}
                    className="w-full bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white font-bold mt-auto"
                  >
                    Ver Detalles y Registrarse
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

        {/* El modal ya estaba completamente en español */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="bg-boreal-dark border-boreal-blue/50 text-white">
            {selectedEvent && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-gradient mb-4">{selectedEvent.title}</DialogTitle>
                  <DialogDescription className="text-gray-300">
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center">
                        <Calendar className="w-5 h-5 mr-3 text-boreal-aqua" />
                        <span>{selectedEvent.date}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-5 h-5 mr-3 text-boreal-aqua" />
                        <span>{selectedEvent.time}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-5 h-5 mr-3 text-boreal-aqua" />
                        <span>{selectedEvent.location}</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="w-5 h-5 mr-3 text-boreal-aqua" />
                        <span>{selectedEvent.capacity}</span>
                      </div>
                    </div>
                    <p className="text-gray-300 mb-6">{selectedEvent.description}</p>
                  </DialogDescription>
                </DialogHeader>
                
                <div className="my-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Formulario de Registro</h4>
                  
                  <div className="text-center p-4 border border-dashed border-gray-600 rounded-lg">
                    <p className="text-gray-400">El formulario de registro para este evento irá aquí.</p>
                  </div>
                  
                </div>

                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedEvent(null)}
                    className="border-gray-500 text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Cerrar
                  </Button>
                  <Button
                    onClick={() => handleRegistrationSubmit(selectedEvent.title)}
                    className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white font-bold"
                  >
                    Enviar Registro (Prueba)
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default EventsPage;