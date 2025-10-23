import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, Clock, Share2, Copy, X as XIcon } from 'lucide-react'; // Icono Share2 añadido
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose // Para cerrar el modal
} from '@/components/ui/dialog';
import { Input } from "@/components/ui/input"; // Inputs del formulario
import { Label } from "@/components/ui/label"; // Labels del formulario
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Selector para la pregunta
import { useToast } from '@/components/ui/use-toast';
// --- MODIFICACIÓN 1: Imports de Firebase ---
import { db, storage } from '@/firebase.jsx'; // Asegúrate que la ruta sea correcta
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';

// Objeto para traducir las categorías
const categoryDisplayNames = {
  'workshop': 'Taller',
  'conference': 'Conferencia',
  'networking': 'Networking',
  'competition': 'Competencia',
};

// Componente del formulario (ahora dentro de EventsPage)
const EventRegistrationForm = ({ event, onSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [university, setUniversity] = useState('');
  const [country, setCountry] = useState('');
  const [department, setDepartment] = useState('');
  const [isMember, setIsMember] = useState(''); // Estado para el select
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !whatsapp || !university || !country || !department || !isMember) {
      toast({
        title: "Campos incompletos",
        description: "Por favor, completa todos los campos del formulario.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'registrations'), {
        eventName: event.title,
        eventId: event.id, // Guardamos el ID del evento
        userName: name,
        userEmail: email,
        userWhatsapp: whatsapp,
        userUniversity: university,
        userCountry: country,
        userDepartment: department,
        isCommunityMember: isMember === 'yes', // Guardamos true/false
        registrationDate: serverTimestamp(),
      });

      toast({
        title: "¡Registro Exitoso!",
        description: `Te has registrado correctamente para ${event.title}.`,
      });
      
      onSuccess(); // Llama a la función onSuccess para cerrar el modal

    } catch (error) {
      console.error("Error al registrar: ", error);
      toast({
        title: "Error en el registro",
        description: "Hubo un problema al enviar tu registro. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pr-2"> {/* El contenedor modal controla el scroll */}
      <div className="space-y-2">
        <Label htmlFor="reg-name" className="text-gray-300">Nombre Completo</Label>
        <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} className="bg-gray-800 border-gray-700 text-white"/>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email" className="text-gray-300">Correo Electrónico</Label>
        <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="bg-gray-800 border-gray-700 text-white"/>
      </div>
       <div className="space-y-2">
        <Label htmlFor="reg-whatsapp" className="text-gray-300">Número de WhatsApp</Label>
        <Input id="reg-whatsapp" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+505 1234 5678" disabled={loading} className="bg-gray-800 border-gray-700 text-white"/>
      </div>
       <div className="space-y-2">
        <Label htmlFor="reg-university" className="text-gray-300">Universidad/Centro de Procedencia</Label>
        <Input id="reg-university" value={university} onChange={(e) => setUniversity(e.target.value)} disabled={loading} className="bg-gray-800 border-gray-700 text-white"/>
      </div>
       <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reg-country" className="text-gray-300">País</Label>
            <Input id="reg-country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={loading} className="bg-gray-800 border-gray-700 text-white"/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-department" className="text-gray-300">Departamento/Estado</Label>
            <Input id="reg-department" value={department} onChange={(e) => setDepartment(e.target.value)} disabled={loading} className="bg-gray-800 border-gray-700 text-white"/>
          </div>
       </div>
       <div className="space-y-2">
          <Label htmlFor="reg-member" className="text-gray-300">¿Ya perteneces a la comunidad Boreal Labs?</Label>
          <select
            id="reg-member"
            value={isMember}
            onChange={(e) => setIsMember(e.target.value)}
            disabled={loading}
            className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-md"
          >
            <option value="">Selecciona una opción</option>
            <option value="yes">Sí</option>
            <option value="no">No</option>
          </select>
       </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white font-bold"
      >
        {loading ? "Registrando..." : "Confirmar Registro"}
      </Button>
    </form>
  );
};


const EventsPage = () => {
  const [filter, setFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  // --- MODIFICACIÓN 2: Estado para eventos y carga ---
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast(); // Toast para el botón de compartir

  // --- MODIFICACIÓN 3: Cargar eventos desde Firestore ---
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "events"), orderBy("date", "asc")); // Ordenar por fecha
        const querySnapshot = await getDocs(q);
      const rawEvents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Resolver posibles imageUrl almacenados en distintos formatos
      const fetchedEvents = await Promise.all(rawEvents.map(async (ev) => {
        const out = { ...ev };
        // asegurar date como Date
        try {
          out.date = ev.date?.toDate ? ev.date.toDate() : ev.date || null;
        } catch (e) {
          out.date = null;
        }

        // Resolución de imagen: puede venir como `image` (string|array|obj), `imageUrl` string|array|obj
        try {
          // Prioridad: out.image (ya procesada por admin) -> imageUrl field
          if (out.image) {
            const img = out.image;
            if (typeof img === 'string') {
              out.resolvedImage = img;
            } else if (Array.isArray(img) && img.length > 0) {
              const first = img[0];
              if (first?.downloadURL) out.resolvedImage = first.downloadURL;
              else if (first?.ref) out.resolvedImage = await getDownloadURL(storageRef(storage, first.ref));
            } else if (img && typeof img === 'object') {
              if (img.downloadURL) out.resolvedImage = img.downloadURL;
              else if (img.ref) out.resolvedImage = await getDownloadURL(storageRef(storage, img.ref));
            }
          } else if (out.imageUrl) {
            const iv = out.imageUrl;
            if (typeof iv === 'string') {
              out.resolvedImage = iv;
            } else if (Array.isArray(iv) && iv.length > 0) {
              const first = iv[0];
              if (first?.downloadURL) out.resolvedImage = first.downloadURL;
              else if (first?.ref) out.resolvedImage = await getDownloadURL(storageRef(storage, first.ref));
            } else if (iv && typeof iv === 'object') {
              if (iv.downloadURL) out.resolvedImage = iv.downloadURL;
              else if (iv.ref) out.resolvedImage = await getDownloadURL(storageRef(storage, iv.ref));
            }
          }
        } catch (e) {
          console.warn('No se pudo resolver imagen para evento', ev.id, e);
          out.resolvedImage = out.resolvedImage || null;
        }

        return out;
      }));
        
        console.log("Eventos cargados:", fetchedEvents);
        setEvents(fetchedEvents);

      } catch (error) {
        console.error("Error al cargar eventos: ", error);
        toast({ title: "Error", description: "No se pudieron cargar los eventos.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []); // Cargar solo una vez al montar

  const categories = [
    { value: 'all', label: 'Todos los Eventos' },
    { value: 'workshop', label: 'Talleres' },
    { value: 'conference', label: 'Conferencias' },
    { value: 'networking', label: 'Networking' },
    { value: 'competition', label: 'Competencias' },
  ];

  // --- MODIFICACIÓN 4: Filtrar eventos cargados ---
  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(event => event.category === filter);

  // Función para cerrar el modal
  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  // --- MODIFICACIÓN 5: Función para compartir ---
  const handleShare = async (event) => {
  const eventUrl = `${window.location.origin}/events/${event.id}/register`;
    const shareData = {
      title: event.title,
      text: `¡Mira este evento de Boreal Labs: ${event.title}!`,
      url: eventUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        console.log('Evento compartido exitosamente');
      } else {
        // Fallback para escritorio: copiar enlace
        await navigator.clipboard.writeText(shareData.url);
        toast({ title: "Enlace Copiado", description: `URL del evento copiada: ${eventUrl}` });
      }
    } catch (err) {
      console.error('Error al compartir:', err);
      // Fallback si navigator.share falla
      await navigator.clipboard.writeText(shareData.url);
      toast({ title: "Enlace Copiado", description: `URL del evento copiada: ${eventUrl}` });
    }
  };


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
          
          {/* Mensaje de carga */}
          {loading && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-boreal-aqua text-xl">
               Cargando eventos...
             </motion.div>
          )}

          {/* Grid de eventos (solo si no está cargando) */}
          {!loading && (
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
                      {/* Imagen Opcional del Evento */}
                        {(event.resolvedImage || event.image) && (
                         <div className="mb-4 overflow-hidden rounded-lg aspect-video">
                           <img src={event.resolvedImage || event.image} alt={`Imagen de ${event.title}`} className="w-full h-full object-cover"/>
                         </div>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <div className="bg-gradient-to-br from-boreal-blue to-boreal-purple text-white text-xs font-bold px-3 py-1 rounded-lg uppercase">
                          {categoryDisplayNames[event.category] || event.category}
                        </div>
                        {event.capacity && (
                          <div className="flex items-center text-gray-400 text-sm">
                            <Users className="w-4 h-4 mr-1" />
                            {event.capacity}
                          </div>
                        )}
                      </div>

                      <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-gradient transition-all">
                        {event.title}
                      </h3>

                      <div className="space-y-3 mb-6">
                        {event.date && (
                          <div className="flex items-center text-gray-300">
                            <Calendar className="w-5 h-5 mr-3 text-boreal-aqua" />
                            {/* Formatear la fecha */}
                            <span>{event.date.toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        )}
                        {event.time && (
                          <div className="flex items-center text-gray-300">
                            <Clock className="w-5 h-5 mr-3 text-boreal-aqua" />
                            <span>{event.time}</span>
                          </div>
                        )}
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
          )}

          {/* Mensaje si no hay eventos en la categoría (solo si no está cargando) */}
          {!loading && filteredEvents.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <p className="text-xl text-gray-400">No se encontraron eventos en esta categoría.</p>
            </motion.div>
          )}
        </div>

        {/* --- MODIFICACIÓN 6: Modal con formulario integrado y botón compartir --- */}
        <Dialog open={!!selectedEvent} onOpenChange={handleCloseModal}>
          <DialogContent className="bg-boreal-dark border-boreal-blue/50 text-white max-w-lg w-full"> {/* Ajusta max-w-* */}
            {selectedEvent && (
              <>
                <DialogHeader className="mb-4">
                  <div className="relative mb-4">
                    <div className="flex items-center gap-3">
                      <DialogTitle className="text-2xl font-bold text-gradient">{selectedEvent.title}</DialogTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleShare(selectedEvent)}
                        className="text-boreal-aqua hover:text-white ml-2"
                        aria-label="Compartir evento"
                      >
                        <Share2 className="w-5 h-5" />
                      </Button>
                    </div>

                    <DialogClose onClick={handleCloseModal} className="absolute top-0 right-0 text-gray-400 hover:text-white">
                      <XIcon className="w-5 h-5" />
                    </DialogClose>
                  </div>

                  <DialogDescription className="text-gray-300 pr-2"> {/* Detalles (el scroll lo maneja el contenedor de la modal) */}
                    <div className="space-y-3 mb-6">
                       {selectedEvent.date && (
                          <div className="flex items-center">
                            <Calendar className="w-5 h-5 mr-3 text-boreal-aqua" />
                            <span>{selectedEvent.date.toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        )}
                        {selectedEvent.time && (
                          <div className="flex items-center">
                            <Clock className="w-5 h-5 mr-3 text-boreal-aqua" />
                            <span>{selectedEvent.time}</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <MapPin className="w-5 h-5 mr-3 text-boreal-aqua" />
                          <span>{selectedEvent.location}</span>
                        </div>
                        {selectedEvent.capacity && (
                          <div className="flex items-center">
                            <Users className="w-5 h-5 mr-3 text-boreal-aqua" />
                            <span>{selectedEvent.capacity}</span>
                          </div>
                        )}
                    </div>
                    <p className="text-gray-300 mb-6">{selectedEvent.description}</p>
                  </DialogDescription>
                </DialogHeader>
                
                <div className="my-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Formulario de Registro</h4>
                  <EventRegistrationForm 
                    event={selectedEvent} 
                    onSuccess={handleCloseModal} 
                  />
                </div>

                {/* Ya no necesitamos DialogFooter aquí */}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default EventsPage;