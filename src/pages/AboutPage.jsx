import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Heart, Target, Zap, Globe } from 'lucide-react';

// --- MODIFICACIÓN 1: IMPORTS DE SWIPER ---
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Navigation, Autoplay } from 'swiper/modules'; // Importa módulos necesarios

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
// Puedes añadir tus estilos personalizados o sobrescribir los de Swiper aquí si es necesario
// import './swiper-custom.css'; 

const AboutPage = () => {
  const values = [
    {
      icon: Heart,
      title: 'Comunidad Primero',
      description: 'Creemos en el poder del crecimiento colectivo y el apoyo mutuo.',
    },
    {
      icon: Target,
      title: 'Impulsados por el Impacto',
      description: 'Cada iniciativa está diseñada para crear un cambio positivo y medible.',
    },
    {
      icon: Zap,
      title: 'Enfoque en Innovación',
      description: 'Abrazamos nuevas ideas y tecnologías para resolver problemas del mundo real.',
    },
    {
      icon: Globe,
      title: 'Crecimiento Inclusivo',
      description: 'Creamos oportunidades accesibles para toda la juventud nicaragüense.',
    },
  ];

  const milestones = [
    { year: '23 de Mayo 2025', event: 'Lanzamiento de Boreal Labs', description: 'Iniciamos con la visión de empoderar a la juventud.' },
    { year: '27 de Mayo', event: 'Primera Serie de Talleres', description: 'Lanzamos el programa inaugural de emprendimiento y aperturamos la oficina en UAM.' },
    { year: '9 de Junio', event: '1era Temporada de Workshops', description: 'Hicimos el lanzamiento del calendario de Workshops y Certificaciones.' },
    { year: '9 de Julio', event: '1era Certificacion', description: 'Realizamos con exito la primera certificacion con ponentes invitados.' },
    { year: '4 de Agosto', event: 'Lanzamiento del programa de Voluntariado', description: 'Alcanzamos la meta de apoyar a hospitales, medio ambiente y animales.' },
    { year: '29 de Septiembre', event: 'Boreal Labs ¨Hack-Day¨', description: 'Culminamos con exito nuestro evento mas grande del año.' },
  ];

  // --- MODIFICACIÓN 2: DATOS PARA EL CARRUSEL ---
  // ¡CAMBIA ESTAS RUTAS DE IMÁGENES Y ALT TEXTS!
  const carouselImages = [
    { src: 'src/images/carrusel/b.jpg', alt: 'Evento de Boreal Labs 1' },
    { src: 'src/images/carrusel/c.webp', alt: 'Taller de innovación' },
    { src: 'src/images/carrusel/d.webp', alt: 'Miembros del equipo colaborando' },
    { src: 'src/images/carrusel/e.jpg', alt: 'Charla inspiradora con un ponente' },
    { src: 'src/images/carrusel/f.webp', alt: 'Jóvenes participando en un hackathon' },
    { src: 'src/images/carrusel/g.jpg', alt: 'Graduación de un programa de emprendimiento' },
    { src: 'src/images/carrusel/h.jpg', alt: 'Sesión de networking' },
    { src: 'src/images/carrusel/i.webp', alt: 'Jóvenes desarrollando proyectos' },
  ];

  return (
    <>
      <Helmet>
        <title>Sobre Nosotros - Boreal Labs</title>
        <meta name="description" content="Conoce la misión de Boreal Labs de empoderar a la juventud nicaragüense a través de la innovación y el emprendimiento." />
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
              Nuestra <span className="text-gradient">Historia</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Construyendo un futuro más brillante para la juventud de Nicaragua a través de la innovación y el emprendimiento.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <img alt="Foto de miembros de Boreal Labs" className="rounded-2xl shadow-2xl" src="src/images/quienes.png" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white">Quiénes Somos</h2>
              <p className="text-lg text-gray-300">
                Boreal Labs es una organización sin fines de lucro liderada por jóvenes en Nicaragua, dedicada a fomentar la innovación y el emprendimiento. Creemos que cada joven tiene el potencial de crear un cambio positivo en su comunidad.
              </p>
              <p className="text-lg text-gray-300">
                A través de alianzas estratégicas con universidades y centros de innovación, ofrecemos talleres, charlas y eventos que equipan a la juventud con las habilidades, el conocimiento y las redes que necesitan para tener éxito.
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
              Nuestra <span className="text-gradient">Misión</span>
            </h2>
            <p className="text-xl text-gray-300 text-center max-w-4xl mx-auto mb-16">
              Empoderar a la juventud nicaragüense brindando oportunidades accesibles para el aprendizaje, la innovación y el emprendimiento, creando un ecosistema vibrante donde los jóvenes líderes puedan prosperar.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="glass-effect rounded-2xl p-6 text-center hover:bg-white/10 transition-all"
                >
                  <div className="bg-gradient-to-br from-boreal-blue to-boreal-purple w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">{value.title}</h3>
                  <p className="text-gray-400">{value.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* --- MODIFICACIÓN 3: NUEVA SECCIÓN DE CARRUSEL DE IMÁGENES --- */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-20" // Margen inferior para separar de la siguiente sección
          >
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
              Nuestros <span className="text-gradient">Momentos</span>
            </h2>

            <Swiper
              spaceBetween={30} // Espacio entre slides
              slidesPerView={1}
              breakpoints={{
                // cuando el ancho de la ventana es >= 640px
                640: {
                  slidesPerView: 2,
                  spaceBetween: 20,
                },
                // cuando el ancho de la ventana es >= 1024px
                1024: {
                  slidesPerView: 3,
                  spaceBetween: 30,
                },
              }}
              autoplay={{
                delay: 3500,
                disableOnInteraction: false,
              }}
              pagination={{ clickable: true }} // Paginación con puntos
              navigation={true} // Flechas de navegación
              modules={[Pagination, Navigation, Autoplay]} // Habilita los módulos
              loop={true} // Repetir el carrusel
              className="mySwiper rounded-2xl shadow-xl p-4 bg-boreal-blue/10" // Clase para estilos y padding
            >
              {carouselImages.map((image, index) => (
                <SwiperSlide key={index}>
                  <img 
                    src={image.src} 
                    alt={image.alt} 
                    className="w-full h-80 object-cover rounded-xl" // Ajusta h-80 a la altura deseada
                  />
                </SwiperSlide>
              ))}
            </Swiper>
          </motion.div>
          {/* --- FIN DE LA NUEVA SECCIÓN DE CARRUSEL --- */}


          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
              Nuestro <span className="text-gradient">Viaje</span>
            </h2>

            <div className="relative">
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-boreal-blue to-boreal-purple hidden md:block" />

              <div className="space-y-12">
                {milestones.map((milestone, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className={`flex items-center ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} flex-col gap-8`}
                  >
                    <div className={`flex-1 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'} text-center`}>
                      <div className="glass-effect rounded-2xl p-6 inline-block">
                        <div className="text-3xl font-bold text-gradient mb-2">{milestone.year}</div>
                        <h3 className="text-xl font-bold text-white mb-2">{milestone.event}</h3>
                        <p className="text-gray-400">{milestone.description}</p>
                      </div>
                    </div>

                    <div className="hidden md:block w-6 h-6 bg-gradient-to-br from-boreal-blue to-boreal-purple rounded-full border-4 border-boreal-dark z-10" />

                    <div className="flex-1" />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default AboutPage;