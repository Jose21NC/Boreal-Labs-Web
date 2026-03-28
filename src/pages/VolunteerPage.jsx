import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Heart, Users, ArrowRight, Camera, ArrowUpRight, Leaf, Syringe, Dog, X, Send, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

// Importación de fotos reales
import headerVolunt from '../images/volunt_fotos/header_volunt.webp';
import bannerHosp from '../images/volunt_fotos/banner_hosp.webp';
import hosp1 from '../images/volunt_fotos/hosp_1.webp';
import hosp2 from '../images/volunt_fotos/hosp_2.webp';
import limpieza1 from '../images/volunt_fotos/limpieza_1.webp';
import ambiental1 from '../images/volunt_fotos/ambiental_1.webp';
import ambiental2 from '../images/volunt_fotos/ambiental_2.webp';
import logoVoluntariado from '../images/volunt_fotos/logo_voluntariado.webp';
import manos from '../images/volunt_fotos/manos.webp';
import ninos1 from '../images/volunt_fotos/ninos_1.webp';
import ninos2 from '../images/volunt_fotos/ninos_2.webp';
import ninos3 from '../images/volunt_fotos/ninos_3.webp';
import ninos4 from '../images/volunt_fotos/ninos_4.webp';
import refugio1 from '../images/volunt_fotos/refugio_1.webp';
import refugio2 from '../images/volunt_fotos/refugio_2.webp';
import volunt3 from '../images/volunt_fotos/volunt_3.webp';
import entregaCert from '../images/volunt_fotos/entrega_cert.webp';

import cartaLlamadoPdf from '../pdf/Carta de Llamado a la Jornada Voluntaria 2026.pdf';

const ScrollAnimatedSection = ({ children, className, id }) => {
  return (
    <motion.section
      id={id}
      className={className}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8 }}
    >
      {children}
    </motion.section>
  );
};

const VolunteerPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [customSchedule, setCustomSchedule] = useState('');
  const [showCustomSchedule, setShowCustomSchedule] = useState(false);
  const [selectedShifts, setSelectedShifts] = useState([]);
  const [customTimes, setCustomTimes] = useState({});
  const { toast } = useToast();

  const handleCustomTimeChange = (dia, field, value) => {
    setCustomTimes(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [field]: value
      }
    }));
  };

  const toggleShift = (shift) => {
    setSelectedShifts(prev => {
      if (prev.includes(shift)) {
        return prev.filter(s => s !== shift);
      } else {
        let newShifts = [...prev, shift];
        const [dia, tipo] = shift.split('-');
        if (tipo === 'Personalizado') {
          newShifts = newShifts.filter(s => s !== `${dia}-Mañana` && s !== `${dia}-Tarde`);
        } else {
          newShifts = newShifts.filter(s => s !== `${dia}-Personalizado`);
        }
        return newShifts;
      }
    });
  };

  const playSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // A6
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) {
      console.log('Audio no soportado', e);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (selectedShifts.length === 0) {
      toast({ title: "Atención", description: "Por favor selecciona al menos un turno.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const data = {
        fullName: document.getElementById('fullName').value,
        edad: document.getElementById('edad').value,
        email: document.getElementById('email').value,
        whatsapp: document.getElementById('whatsapp').value,
        ciudad: document.getElementById('ciudad').value,
        talla: document.getElementById('talla').value,
        procedencia: document.getElementById('procedencia').value,
        comentariosAdicionales: (document.getElementById('comentarios')?.value || '').trim(),
        creditos: 0,
        turnos: selectedShifts,
        horariosPersonalizados: customTimes,
        fechaRegistro: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'voluntarios2026'), data);
      
      setIsSuccess(true);
      playSuccessSound();
      toast({
        title: "¡Inscripción recibida!",
        description: "Gracias por querer ser parte de la Jornada Voluntaria 2026.",
      });
    } catch (error) {
      console.error("Error guardando voluntario:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al enviar tu inscripción. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-boreal-dark text-white min-h-screen pt-20">
      <Helmet>
        <title>Jornada Voluntaria 2026 - Boreal Labs</title>
        <meta name="description" content="Únete a la Jornada Voluntaria 2026 de Boreal Labs y sé parte del cambio con actividades sociales en medioambiente, niñez y hospitales." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center pt-20 pb-20 overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 z-0">
          <img src={headerVolunt} alt="Jornada Voluntaria Boreal Labs" className="w-full h-full object-cover opacity-30 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-t from-boreal-dark via-boreal-dark/80 to-boreal-dark/40"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-boreal-purple/20 blur-[120px] rounded-full pointer-events-none" />
        </div>
        
        <div className="container mx-auto px-6 md:px-12 lg:px-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.a
              href={cartaLlamadoPdf}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="inline-flex items-center justify-center gap-2 px-6 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-8 hover:bg-white/20 transition-all hover:scale-105 cursor-pointer shadow-lg shadow-boreal-purple/10"
            >
              <img src={logoVoluntariado} alt="Logo Voluntariado" className="w-[45px] h-[45px] object-contain scale-125" />
              <span className="text-sm font-bold tracking-widest uppercase text-white/90 ml-2">
                Programa Oficial
              </span>
            </motion.a>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 font-montserrat leading-tight text-transparent bg-clip-text bg-gradient-to-r from-boreal-aqua via-white to-boreal-purple"
            >
              Jornada Voluntaria 2026
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-gray-300 mb-10 font-medium font-montserrat leading-relaxed max-w-3xl mx-auto"
            >
              Este 2026, la familia Boreal Labs se une para impactar positivamente nuestro entorno con actividades sociales: cuidando del medioambiente, apoyando animales vulnerables, atendiendo a la niñez y fortaleciendo a la comunidad.
              <span className="block mt-4 text-white font-bold">¡Haz que la solidaridad sea tu mejor proyecto!</span>
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex justify-center"
            >
              <Button 
                size="lg" 
                onClick={() => { setIsModalOpen(true); setIsSuccess(false); }}
                className="bg-boreal-blue hover:bg-blue-600 text-white font-bold px-10 py-6 h-auto text-lg shadow-lg shadow-boreal-blue/30 rounded-full transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-2"
              >
                Quiero Participar <ArrowRight className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Intro con Foto Destacada */}
      <ScrollAnimatedSection className="py-20 bg-boreal-dark" id="que-hacemos">
        <div className="container mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Llevando aliento y apoyo <span className="text-boreal-aqua">donde se necesita</span>
              </h2>
              <p className="text-gray-300 text-lg leading-relaxed mb-6">
                Creemos que el verdadero liderazgo genera acciones en favor de los demás. La <strong>Jornada Voluntaria 2026</strong> concentra los esfuerzos de nuestra comunidad para aportar de forma integral a la sociedad, en asilos, hospitales y comunidades prioritarias.
              </p>
              <div className="space-y-6 mt-8">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-boreal-purple/20 flex items-center justify-center shrink-0">
                    <Heart className="w-5 h-5 text-boreal-purple" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold mb-1">Voluntariado Centrado en la Persona</h4>
                    <p className="text-gray-400 text-sm">Acompañamos pacientes, ancianos y niños de una forma cálida y humanitaria, brindando un acompañamiento social integral.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-boreal-aqua/20 flex items-center justify-center shrink-0">
                    <Leaf className="w-5 h-5 text-boreal-aqua" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold mb-1">Voluntariado Ambiental</h4>
                    <p className="text-gray-400 text-sm">Restauramos áreas verdes con recolección de residuos, programas de reciclaje y reforestación.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Dog className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold mb-1">Voluntariado Animal</h4>
                    <p className="text-gray-400 text-sm">Visitamos refugios, organizamos recolectas y realizamos jornadas de rescate callejeras.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-boreal-blue to-boreal-purple rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
              <img src={volunt3} alt="Equipo de Voluntarios" className="relative rounded-3xl object-cover w-full shadow-2xl border border-white/10" />
            </div>
          </div>
        </div>
      </ScrollAnimatedSection>

      {/* Áreas de Acción (Cards) */}
      <ScrollAnimatedSection className="py-20 bg-black/40 border-y border-white/5 relative">
        <div className="absolute inset-0 bg-[#0a1122] opacity-[0.9]"></div>
        <div className="container mx-auto px-6 md:px-12 lg:px-20 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Nuestro <span className="text-boreal-blue">Compromiso Social</span></h2>
            <p className="text-gray-400 text-lg mb-6">
              Abrazamos causas sociales porque creemos que la innovación debe ir de la mano con la empatía. Nuestras áreas de acción fortalecen el bienestar de la comunidad.
            </p>
            <div className="flex justify-center">
              <Button 
                asChild
                className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:scale-105 hover:shadow-lg hover:shadow-boreal-purple/40 text-white font-bold rounded-full px-8 py-6 text-base transition-all duration-300 border border-white/20 relative overflow-hidden group"
              >
                <a href={cartaLlamadoPdf} target="_blank" rel="noopener noreferrer">
                  <span className="relative z-10 flex items-center gap-2">
                    📄 Leer carta de llamado a voluntarios 2026
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                </a>
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Niños */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:-translate-y-2 transition-transform duration-500">
              <div className="relative h-48 overflow-hidden">
                <div className="absolute inset-0 bg-boreal-dark/30 group-hover:bg-transparent transition-colors z-10"></div>
                <img src={ninos2} alt="Niños vulnerables" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute top-4 left-4 z-20 bg-boreal-purple backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                  <Users className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold">Cuidado a la Niñez</span>
                </div>
              </div>
              <div className="p-8 h-full flex flex-col">
                <h3 className="text-2xl font-bold mb-3">Programa de Apoyo a Niños</h3>
                <p className="text-gray-400 leading-relaxed mb-6 flex-grow">
                  Realizamos actividades de apoyo a la infancia vulnerable; organizamos visitas a centros educativos para impartir charlas, realizar dinamicas y donativos.
                </p>
                <div className="flex gap-3">
                  <img src={ninos1} alt="Actividades con niños" className="w-16 h-16 rounded-xl object-cover border border-white/20" />
                  <img src={ninos4} alt="Niños riendo" className="w-16 h-16 rounded-xl object-cover border border-white/20" />
                </div>
              </div>
            </div>

            {/* Medio Ambiente */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:-translate-y-2 transition-transform duration-500">
              <div className="relative h-48 overflow-hidden">
                <div className="absolute inset-0 bg-boreal-dark/30 group-hover:bg-transparent transition-colors z-10"></div>
                <img src={ambiental1} alt="Medio Ambiente" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 object-top" />
                <div className="absolute top-4 left-4 z-20 bg-emerald-600 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold">Cuido del Medioambiente</span>
                </div>
              </div>
              <div className="p-8 h-full flex flex-col">
                <h3 className="text-2xl font-bold mb-3">Jornadas Ambientales</h3>
                <p className="text-gray-400 leading-relaxed mb-6 flex-grow">
                  Coordinamos jornadas de limpieza y campañas de siembra que ayudan a mitigar nuestro impacto ecológico en la comunidad.
                </p>
                <div className="flex gap-3">
                  <img src={limpieza1} alt="Limpieza" className="w-16 h-16 rounded-xl object-cover border border-white/20" />
                  <img src={ambiental2} alt="Ambiental" className="w-16 h-16 rounded-xl object-cover border border-white/20" />
                </div>
              </div>
            </div>

            {/* Animales */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:-translate-y-2 transition-transform duration-500">
              <div className="relative h-48 overflow-hidden">
                <div className="absolute inset-0 bg-boreal-dark/30 group-hover:bg-transparent transition-colors z-10"></div>
                <img src={refugio2} alt="Refugios de Animales" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute top-4 left-4 z-20 bg-amber-500 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                  <Dog className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold">Protección Animal</span>
                </div>
              </div>
              <div className="p-8 h-full flex flex-col">
                <h3 className="text-2xl font-bold mb-3">Cuido de los animales</h3>
                <p className="text-gray-400 leading-relaxed mb-6 flex-grow">
                  Organizamos visitas a refugios de animales y recolectas de donativos, ademas de jornadas de rescate callejeras.
                </p>
                <div className="flex gap-3">
                  <img src={refugio1} alt="Bañando mascotas" className="w-16 h-16 rounded-xl object-cover border border-white/20" />
                </div>
              </div>
            </div>

            {/* Hospitales y Comunidad */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:-translate-y-2 transition-transform duration-500">
              <div className="relative h-48 overflow-hidden">
                <div className="absolute inset-0 bg-boreal-dark/30 group-hover:bg-transparent transition-colors z-10"></div>
                <img src={hosp1} alt="Hospital Militar Escuela" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute top-4 left-4 z-20 bg-rose-600 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                  <Heart className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold">Comunidad General</span>
                </div>
              </div>
              <div className="p-8 h-full flex flex-col">
                <h3 className="text-2xl font-bold mb-3">Comunidad y Hospitales</h3>
                <p className="text-gray-400 leading-relaxed mb-6 flex-grow">
                  Acudimos como voluntarios al Hospital Militar Escuela, ademas de realizar actividades de apoyo en la comunidad.
                </p>
                <div className="flex gap-3">
                  <img src={bannerHosp} alt="Actividades hospital" className="w-16 h-16 rounded-xl object-cover border border-white/20" />
                  <img src={hosp2} alt="Apoyo en asilos" className="w-16 h-16 rounded-xl object-cover border border-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollAnimatedSection>

      {/* Galería Visual */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-boreal-aqua/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="container mx-auto px-6 md:px-12 lg:px-20 relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center flex items-center justify-center gap-4">
            <Camera className="w-8 h-8 text-boreal-aqua" />
            Archivo Fotográfico
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={ninos1} alt="Niños sonrisas" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Actividades Educativas</span>
              </div>
            </div>
            
            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={hosp2} alt="Hospital" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Apoyo en Hospitales</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={limpieza1} alt="Limpieza ambiental" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Compromiso Ecológico</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={entregaCert} alt="Entrega de certificados" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Entrega de Reconocimientos</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={refugio1} alt="Animales refugios" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Ayuda en Refugios de Animales</span>
              </div>
            </div>
            
            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={ninos3} alt="Niños actividades" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Donativos a Niños</span>
              </div>
            </div>

             <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={ambiental2} alt="Ambiental" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Reforestación</span>
              </div>
            </div>
            
            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 flex items-center justify-center bg-white/5 h-72 sm:h-64 lg:h-72">
              <img src={manos} alt="Manos unidas" className="w-full h-full object-cover p-2" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Comunidad Unida</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={bannerHosp} alt="Actividades en hospital" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Entrega de presentes 2025</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={hosp1} alt="Hospital" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Voluntariado Centrado en la Persona</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={ninos2} alt="Niños sonriendo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Actividades Educativas</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={ninos4} alt="Niños compartiendo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Convivencia Infantil</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={refugio2} alt="Apoyo a refugios" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Rescate Animal</span>
              </div>
            </div>

             <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={volunt3} alt="Equipo Boreal Labs" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Equipo de Voluntarios</span>
              </div>
            </div>

            <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-white/10 h-72 sm:h-64 lg:h-72">
              <img src={ambiental1} alt="Reforestacion equipo" className="w-full h-full object-cover object-top" />
              <div className="absolute inset-0 bg-boreal-dark/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-bold tracking-wider relative z-10">Preservando la Naturaleza</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Cierre / Call to action */}
      {/* Última sección */}
      <ScrollAnimatedSection className="py-24 relative bg-gradient-to-br from-boreal-dark via-[#0a1122] to-boreal-blue/20" id="unete">
        <div className="container mx-auto px-6 md:px-12 lg:px-20 relative z-10 text-center max-w-4xl">
          <h2 className="text-3xl md:text-5xl font-black mb-8 leading-tight">
            Únete a la <span className="text-transparent bg-clip-text bg-gradient-to-r from-boreal-aqua to-white">Jornada Voluntaria 2026</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-300 mb-12">
            No necesitas experiencia para cambiar el mundo. Solo disposición y ganas de ayudar al medioambiente, animales, niños y hospitales. ¡Hagámoslo juntos!
          </p>
          <div className="flex flex-col items-center">
            <Button 
               size="lg" 
               onClick={() => { setIsModalOpen(true); setIsSuccess(false); }}
               className="bg-white text-boreal-dark hover:bg-gray-200 text-lg px-10 py-6 h-auto font-black rounded-full flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] transition-all duration-300 transform hover:-translate-y-1"
            >
              Quiero Participar <ArrowUpRight className="w-6 h-6 ml-1" />
            </Button>
            <p className="mt-8 text-sm text-gray-400 font-medium tracking-wide uppercase">CUPOS LIMITADOS POR BRIGADA SOCIAL</p>
          </div>
        </div>
      </ScrollAnimatedSection>

      {/* Formulario Modal de Inscripción */}
      <Dialog open={isModalOpen} onOpenChange={() => setIsModalOpen(false)}>
        <DialogContent className="sm:max-w-2xl bg-[#0a1122] border border-white/10 relative">
          <button 
            onClick={() => setIsModalOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10"
          >
            <X className="h-5 w-5 text-gray-400" />
            <span className="sr-only">Close</span>
          </button>
          
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-boreal-aqua to-boreal-purple">¡Inscripción Exitosa!</h3>
              <p className="text-gray-300 text-lg max-w-md">Gracias por querer ser parte de la Jornada Voluntaria 2026. Tu solicitud ha sido recibida correctamente.</p>
              <div className="w-full h-px bg-white/10 my-4"></div>
              <p className="text-gray-200">El siguiente paso es unirte a nuestro grupo oficial de WhatsApp para recibir todas las indicaciones.</p>
              <a 
                href="https://chat.whatsapp.com/BPaGPuFIpRQ3yppo5nJVEz?mode=gi_t" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium px-6 py-3 rounded-lg transition-colors mt-2"
              >
                Únete al Grupo de Voluntariado
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.305-.885-.653-1.482-1.46-1.656-1.758-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.571-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              </a>
            </div>
          ) : (
            <>
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-boreal-aqua to-boreal-purple mb-2">
              Inscripción Voluntario 2026
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-base">
              Completa el formulario para ser parte de nuestra Jornada Voluntaria. Te contactaremos con los siguientes pasos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-gray-200">Nombre Completo *</Label>
                <Input id="fullName" required placeholder="Ej. Ana Pérez" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edad" className="text-gray-200">Edad *</Label>
                <Input id="edad" type="number" min="15" max="99" required placeholder="Ej. 20" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200">Correo Electrónico *</Label>
                <Input id="email" type="email" required placeholder="ejemplo@correo.com" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-gray-200">Número de WhatsApp *</Label>
                <Input id="whatsapp" required placeholder="80123456" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ciudad" className="text-gray-200">Ciudad de Residencia *</Label>
                <Input id="ciudad" required placeholder="Ej. Managua" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="talla" className="text-gray-200">Talla de Camisa *</Label>
                <select 
                  id="talla" 
                  defaultValue=""
                  required
                  className="w-full px-3 py-2 rounded-md border border-white/10 bg-[#161c2d] text-white focus:outline-none focus:ring-2 focus:ring-boreal-blue transition-colors appearance-none"
                >
                  <option value="" disabled hidden>Selecciona tu talla</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="procedencia" className="text-gray-200">Procedencia (Universidad / Centro Educativo) *</Label>
                <Input id="procedencia" required placeholder="Ej. UNI, UNAN, UCA..." className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label className="text-gray-200">Disponibilidad de Horarios *</Label>
                <div 
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-left transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-boreal-aqua" />
                    <div>
                      <p className="text-white font-medium">
                         {selectedShifts.length > 0 
                           ? `${selectedShifts.length} turno(s) seleccionado(s)` 
                           : 'Seleccionar disponibilidad en la semana'}
                      </p>
                      <p className="text-sm text-gray-400">
                        {selectedShifts.length > 0 
                          ? 'Haz clic para ver o modificar' 
                          : 'Elige los días y turnos en los que puedes apoyar'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                </div>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="brigada" className="text-gray-200">Área de Interés Principal</Label>
                <select 
                  id="brigada" 
                  defaultValue=""
                  className="w-full px-3 py-2 rounded-md border border-white/10 bg-[#161c2d] text-white focus:outline-none focus:ring-2 focus:ring-boreal-blue transition-colors appearance-none"
                >
                  <option value="" disabled hidden>¿Dónde te gustaría apoyar?</option>
                  <option value="medioambiente">Medioambiente y Reforestación</option>
                  <option value="ninez">Cuidado a la Niñez</option>
                  <option value="animales">Protección Animal</option>
                  <option value="hospitales">Hospitales y asilos</option>
                  <option value="cualquiera">Donde más me necesiten</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="comentarios" className="text-gray-200">Comentarios Adicionales (Opcional)</Label>
                <textarea 
                  id="comentarios" 
                  rows="3"
                  placeholder="¿Alguna habilidad especial (medicina, veterinaria, foto/video), restricción médica o comentario extra?"
                  className="w-full px-3 py-2 rounded-md border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-boreal-blue transition-colors resize-y"
                ></textarea>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-4 border-t border-white/10">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-white/20 text-white hover:bg-white/10">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-boreal-blue hover:bg-blue-600 text-white gap-2 px-8">
                Enviar Inscripción <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submodal de Selección de Horarios */}
      <Dialog open={isScheduleModalOpen} onOpenChange={() => setIsScheduleModalOpen(false)}>
        <DialogContent className="sm:max-w-xl bg-[#0a1122] border border-white/10 relative z-[60] overflow-hidden flex flex-col h-auto max-h-[90vh]">
          <button 
            onClick={() => setIsScheduleModalOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10"
          >
            <X className="h-5 w-5 text-gray-400" />
            <span className="sr-only">Close</span>
          </button>
          
          <DialogHeader className="shrink-0 mb-0">
            <DialogTitle className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-boreal-aqua" />
              Tu Disponibilidad
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Selecciona todos los turnos en los que podrías participar durante la semana (puedes seleccionar varios por día).
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 overflow-y-auto pr-2 flex-grow scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia) => (
              <div key={dia} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                <h4 className="font-semibold text-white">{dia}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button 
                    type="button" 
                    onClick={() => toggleShift(`${dia}-Mañana`)} 
                    className={`py-2 px-3 rounded-lg border text-sm transition-all flex items-center justify-between text-left ${selectedShifts.includes(`${dia}-Mañana`) ? 'bg-boreal-blue/20 border-boreal-blue text-white' : 'border-white/20 text-gray-300 hover:bg-white/10'}`}
                  >
                    <span>Mañana (8am-12pm)</span>
                    {selectedShifts.includes(`${dia}-Mañana`) && <CheckCircle2 className="w-4 h-4 text-boreal-aqua shrink-0 ml-2" />}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => toggleShift(`${dia}-Tarde`)} 
                    className={`py-2 px-3 rounded-lg border text-sm transition-all flex items-center justify-between text-left ${selectedShifts.includes(`${dia}-Tarde`) ? 'bg-boreal-blue/20 border-boreal-blue text-white' : 'border-white/20 text-gray-300 hover:bg-white/10'}`}
                  >
                    <span>Tarde (1pm-5pm)</span>
                    {selectedShifts.includes(`${dia}-Tarde`) && <CheckCircle2 className="w-4 h-4 text-boreal-aqua shrink-0 ml-2" />}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => toggleShift(`${dia}-Personalizado`)} 
                    className={`py-2 px-3 rounded-lg border text-sm transition-all flex items-center justify-between text-left ${selectedShifts.includes(`${dia}-Personalizado`) ? 'bg-boreal-blue/20 border-boreal-blue text-white' : 'border-white/20 text-gray-300 hover:bg-white/10'}`}
                  >
                    <span>Personalizado</span>
                    {selectedShifts.includes(`${dia}-Personalizado`) && <CheckCircle2 className="w-4 h-4 text-boreal-aqua shrink-0 ml-2" />}
                  </button>
                </div>
                {selectedShifts.includes(`${dia}-Personalizado`) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex flex-wrap items-center gap-3 mt-1 p-3 bg-black/20 rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-2">
                       <Label className="text-sm text-gray-400 whitespace-nowrap">De:</Label>
                       <select 
                         value={customTimes[dia]?.start || ''}
                         onChange={(e) => handleCustomTimeChange(dia, 'start', e.target.value)}
                         className="bg-[#161c2d] border border-white/10 text-white h-9 text-sm w-32 px-2 rounded-md focus:outline-none focus:ring-2 focus:ring-boreal-blue transition-colors appearance-none"
                       >
                         <option value="" disabled hidden>Hora</option>
                         <option value="08:00">08:00 AM</option>
                         <option value="08:30">08:30 AM</option>
                         <option value="09:00">09:00 AM</option>
                         <option value="09:30">09:30 AM</option>
                         <option value="10:00">10:00 AM</option>
                         <option value="10:30">10:30 AM</option>
                         <option value="11:00">11:00 AM</option>
                         <option value="11:30">11:30 AM</option>
                         <option value="12:00">12:00 PM</option>
                         <option value="12:30">12:30 PM</option>
                         <option value="13:00">01:00 PM</option>
                         <option value="13:30">01:30 PM</option>
                         <option value="14:00">02:00 PM</option>
                         <option value="14:30">02:30 PM</option>
                         <option value="15:00">03:00 PM</option>
                         <option value="15:30">03:30 PM</option>
                         <option value="16:00">04:00 PM</option>
                         <option value="16:30">04:30 PM</option>
                         <option value="17:00">05:00 PM</option>
                         <option value="17:30">05:30 PM</option>
                         <option value="18:00">06:00 PM</option>
                         <option value="18:30">06:30 PM</option>
                         <option value="19:00">07:00 PM</option>
                         <option value="19:30">07:30 PM</option>
                         <option value="20:00">08:00 PM</option>
                       </select>
                    </div>
                    <div className="flex items-center gap-2">
                       <Label className="text-sm text-gray-400 whitespace-nowrap">A:</Label>
                       <select 
                         value={customTimes[dia]?.end || ''}
                         onChange={(e) => handleCustomTimeChange(dia, 'end', e.target.value)}
                         className="bg-[#161c2d] border border-white/10 text-white h-9 text-sm w-32 px-2 rounded-md focus:outline-none focus:ring-2 focus:ring-boreal-blue transition-colors appearance-none"
                       >
                         <option value="" disabled hidden>Hora</option>
                         <option value="08:00">08:00 AM</option>
                         <option value="08:30">08:30 AM</option>
                         <option value="09:00">09:00 AM</option>
                         <option value="09:30">09:30 AM</option>
                         <option value="10:00">10:00 AM</option>
                         <option value="10:30">10:30 AM</option>
                         <option value="11:00">11:00 AM</option>
                         <option value="11:30">11:30 AM</option>
                         <option value="12:00">12:00 PM</option>
                         <option value="12:30">12:30 PM</option>
                         <option value="13:00">01:00 PM</option>
                         <option value="13:30">01:30 PM</option>
                         <option value="14:00">02:00 PM</option>
                         <option value="14:30">02:30 PM</option>
                         <option value="15:00">03:00 PM</option>
                         <option value="15:30">03:30 PM</option>
                         <option value="16:00">04:00 PM</option>
                         <option value="16:30">04:30 PM</option>
                         <option value="17:00">05:00 PM</option>
                         <option value="17:30">05:30 PM</option>
                         <option value="18:00">06:00 PM</option>
                         <option value="18:30">06:30 PM</option>
                         <option value="19:00">07:00 PM</option>
                         <option value="19:30">07:30 PM</option>
                         <option value="20:00">08:00 PM</option>
                       </select>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-white/10 mt-4 shrink-0">
            <Button type="button" onClick={() => setIsScheduleModalOpen(false)} className="bg-boreal-blue hover:bg-blue-600 text-white w-full sm:w-auto px-8">
              Confirmar Horarios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VolunteerPage;
