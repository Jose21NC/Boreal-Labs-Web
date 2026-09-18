import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, ArrowLeft, CheckCircle, AlertCircle, Heart, Briefcase, HelpCircle, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { db } from '@/firebase.jsx';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import logoWhite from '@/images/partners/logo-white.png';

const TEDxPage = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    cargo: '',
    edad: '',
    motivo: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!formData.email.trim()) {
      newErrors.email = 'El correo es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El correo no es válido';
    }
    if (!formData.whatsapp.trim()) {
      newErrors.whatsapp = 'El número de WhatsApp es requerido';
    } else if (!/^\+?[\d\s-]{8,15}$/.test(formData.whatsapp)) {
      newErrors.whatsapp = 'Introduce un formato de número válido (mín. 8 dígitos)';
    }
    if (!formData.cargo.trim()) {
      newErrors.cargo = 'El cargo o profesión es requerido';
    }
    if (!formData.edad.trim()) {
      newErrors.edad = 'La edad es requerida';
    } else if (!/^\d+$/.test(formData.edad.trim())) {
      newErrors.edad = 'La edad debe ser un número entero';
    }
    if (!formData.motivo.trim()) {
      newErrors.motivo = 'Por favor responde por qué te gustaría asistir';
    } else {
      const wordsCount = formData.motivo.trim().split(/\s+/).filter(Boolean).length;
      if (wordsCount > 100) {
        newErrors.motivo = `El motivo debe tener un máximo de 100 palabras (actual: ${wordsCount})`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast({
        title: 'Formulario incompleto',
        description: 'Por favor, corrige los campos indicados.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Guardar pre-registro en base de datos de Boreal
      await addDoc(collection(db, 'registrations'), {
        eventName: 'TEDx Avenida Bolívar',
        eventId: 'tedx-avenida-bolivar',
        userName: formData.name.trim(),
        userEmail: formData.email.trim().toLowerCase(),
        userWhatsapp: formData.whatsapp.trim(),
        userUniversity: formData.cargo.trim(), // Universidad se usa para Cargo por compatibilidad con admin panel
        cargo: formData.cargo.trim(),
        userCargo: formData.cargo.trim(),
        userDepartment: 'Managua', // Se mantiene con valor por defecto para compatibilidad de esquemas
        edad: Number(formData.edad.trim()),
        userAge: Number(formData.edad.trim()),
        motivo: formData.motivo.trim(),
        whyAttend: formData.motivo.trim(),
        tipoAsistencia: 'Participante',
        isCommunityMember: false,
        registrationDate: serverTimestamp()
      });

      // 2. Suscribir a newsletter de TEDx (Cloud Functions en proyecto TEDx)
      try {
        await fetch('https://us-central1-boreal-50422.cloudfunctions.net/newsletter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: formData.email.trim().toLowerCase() }),
        });
      } catch (newsletterErr) {
        console.error('Error al suscribir al newsletter de TEDx:', newsletterErr);
      }

      setSuccess(true);
      toast({
        title: '¡Pre-registro Exitoso!',
        description: 'Tus datos han sido procesados correctamente.',
      });
    } catch (err) {
      console.error('Error al registrarse en TEDx', err);
      toast({
        title: 'Error de registro',
        description: err?.message || 'No se pudo completar el pre-registro. Inténtalo de nuevo.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const wordCount = formData.motivo.trim().split(/\s+/).filter(Boolean).length;

  return (
    <>
      <Helmet>
        <title>TEDx Avenida Bolívar + Boreal Labs - Pre-registro Oficial</title>
        <meta name="description" content="Pre-regístrate oficialmente al evento TEDx Avenida Bolívar con el soporte y patrocinio tecnológico de Boreal Labs." />
      </Helmet>

      <div className="min-h-screen bg-boreal-dark text-white relative overflow-hidden flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
        
        {/* Luces y brillos de fondo */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-boreal-purple/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto w-full z-10 flex-grow flex flex-col justify-center">
          
          {/* Botón de regreso */}
          <div className="mb-6">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
              <span>Volver a Boreal Labs</span>
            </Link>
          </div>

          <div className="grid md:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Sección Informativa (Columna Izquierda) */}
            <div className="md:col-span-6 space-y-6">
              
              {/* Logo Oficial de TEDx */}
              <div className="flex justify-center md:justify-start mb-4">
                <img 
                  src={logoWhite} 
                  alt="TEDx Avenida Bolívar Logo" 
                  className="h-36 sm:h-40 w-auto object-contain" 
                />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-3xl font-extrabold text-white leading-tight">
                  Apoyado por <span className="text-gradient font-black">Boreal Labs</span>
                </h2>
              </div>

              <p className="text-neutral-400 text-base leading-relaxed max-w-lg">
                TEDx Avenida Bolívar reúne mentes brillantes para difundir ideas innovadoras que inspiren cambios. Como patrocinador y socio tecnológico oficial, <strong>Boreal Labs</strong> apoya la logística digital de este gran acontecimiento, proveyendo la plataforma de registro y pre-selección de entradas.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-500 shrink-0">
                    <Heart className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Ideas que transforman</h3>
                    <p className="text-neutral-400 text-sm">Discursos locales e ideas globales que inspiran a la juventud de Nicaragua.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-boreal-purple/10 rounded-lg border border-boreal-purple/20 text-boreal-purple shrink-0">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Asignación de Entradas</h3>
                    <p className="text-neutral-400 text-sm">Debido al cupo limitado, tu registro cuenta como una preinscripción. Te notificaremos si se te asigna una entrada oficial.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulario (Columna Derecha) */}
            <div className="md:col-span-6">
              <AnimatePresence mode="wait">
                {!success ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="glass-effect border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <h3 className="text-xl font-bold mb-1 text-white">Pre-registro de Entradas</h3>
                    <p className="text-xs text-neutral-400 mb-6">Completa tus datos para postularte a una entrada del evento.</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Campo Nombre */}
                      <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-xs text-neutral-300 font-medium">Nombre Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <Input
                            id="name"
                            placeholder="Juan Pérez"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className={`pl-10 bg-boreal-dark/50 border-white/10 text-white placeholder-neutral-500 text-sm ${errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.name && <span className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name}</span>}
                      </div>

                      {/* Campo Email */}
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs text-neutral-300 font-medium">Correo Electrónico</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="juan@ejemplo.com"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className={`pl-10 bg-boreal-dark/50 border-white/10 text-white placeholder-neutral-500 text-sm ${errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.email && <span className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email}</span>}
                      </div>

                      {/* Campo WhatsApp */}
                      <div className="space-y-1.5">
                        <Label htmlFor="whatsapp" className="text-xs text-neutral-300 font-medium">Número de WhatsApp</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <Input
                            id="whatsapp"
                            placeholder="+505 8888 8888"
                            value={formData.whatsapp}
                            onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                            className={`pl-10 bg-boreal-dark/50 border-white/10 text-white placeholder-neutral-500 text-sm ${errors.whatsapp ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.whatsapp && <span className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.whatsapp}</span>}
                      </div>

                      {/* Grid para Cargo y Edad */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Cargo o Profesión */}
                        <div className="space-y-1.5">
                          <Label htmlFor="cargo" className="text-xs text-neutral-300 font-medium">Cargo o Profesión</Label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                            <Input
                              id="cargo"
                              placeholder="Ej. Diseñador / Estudiante"
                              value={formData.cargo}
                              onChange={(e) => handleInputChange('cargo', e.target.value)}
                              className={`pl-10 bg-boreal-dark/50 border-white/10 text-white placeholder-neutral-500 text-sm ${errors.cargo ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                              disabled={loading}
                            />
                          </div>
                          {errors.cargo && <span className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.cargo}</span>}
                        </div>

                        {/* Edad */}
                        <div className="space-y-1.5">
                          <Label htmlFor="edad" className="text-xs text-neutral-300 font-medium">Edad</Label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                            <Input
                              id="edad"
                              placeholder="Ej. 21"
                              value={formData.edad}
                              onChange={(e) => handleInputChange('edad', e.target.value)}
                              className={`pl-10 bg-boreal-dark/50 border-white/10 text-white placeholder-neutral-500 text-sm ${errors.edad ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                              disabled={loading}
                            />
                          </div>
                          {errors.edad && <span className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.edad}</span>}
                        </div>
                      </div>

                      {/* Campo ¿Por qué te gustaría asistir? */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="motivo" className="text-xs text-neutral-300 font-medium">¿Por qué te gustaría asistir a esta edición?</Label>
                          <span className={`text-[10px] ${wordCount > 100 ? 'text-red-500 font-bold' : 'text-neutral-500'}`}>
                            {wordCount}/100 pal.
                          </span>
                        </div>
                        <div className="relative">
                          <HelpCircle className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                          <textarea
                            id="motivo"
                            rows={3}
                            placeholder="Cuéntanos brevemente tu motivación..."
                            value={formData.motivo}
                            onChange={(e) => handleInputChange('motivo', e.target.value)}
                            className={`w-full pl-10 pr-3 py-2 bg-boreal-dark/50 border border-white/10 rounded-md text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors ${errors.motivo ? 'border-red-500 focus:ring-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.motivo && <span className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.motivo}</span>}
                      </div>

                      {/* Botón de Enviar */}
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 rounded-lg mt-6 shadow-lg shadow-red-600/20 hover:shadow-red-600/30 transition-all flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            <span>Procesando...</span>
                          </>
                        ) : (
                          <span>Pre-registrarme Gratis</span>
                        )}
                      </Button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-effect border border-emerald-500/20 bg-emerald-950/10 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30 mb-4">
                      <CheckCircle className="h-8 w-8" />
                    </div>

                    <h3 className="text-2xl font-bold mb-2 text-white">¡Pre-registro Exitoso!</h3>
                    <p className="text-sm text-neutral-300 max-w-sm mx-auto mb-6">
                      Te has pre-registrado con éxito para <strong>TEDx Avenida Bolívar</strong>. En caso de que se te asigne una entrada oficial, te contactaremos por correo electrónico. ¡También te hemos suscrito a nuestro newsletter para que no te pierdas ninguna actualización!
                    </p>

                    <button
                      onClick={() => {
                        setFormData({ name: '', email: '', whatsapp: '', cargo: '', edad: '', motivo: '' });
                        setSuccess(false);
                      }}
                      className="text-xs text-neutral-400 hover:text-white underline transition-colors"
                    >
                      Pre-registrar a otra persona
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>

        {/* Footer simple de la landing */}
        <div className="text-center text-xs text-neutral-500 z-10 pt-12">
          © {new Date().getFullYear()} Boreal Labs. Todos los derechos reservados. TEDx es un evento organizado independientemente bajo licencia de TED.
        </div>
      </div>
    </>
  );
};

export default TEDxPage;
