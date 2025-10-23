import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Mic, Users, Heart, Award, School as University, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ScrollAnimatedSection = ({ children, className }) => {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8 }}
    >
      {children}
    </motion.section>
  );
};

const HomePage = () => {
  const programs = [
    {
      icon: Zap,
      title: 'Talleres de Innovación',
      description: 'Sumérgete en el mundo de la tecnología y la creatividad con nuestros talleres prácticos.',
    },
    {
      icon: Mic,
      title: 'Charlas Inspiradoras',
      description: 'Conéctate con líderes y emprendedores que están cambiando el juego en Nicaragua.',
    },
    {
      icon: Users,
      title: 'Eventos de Networking',
      description: 'Expande tu red de contactos y colabora con otros jóvenes apasionados por la innovación.',
    },
  ];

  const impacts = [
    {
      icon: Heart,
      metric: '+1,500',
      description: 'Jóvenes impactados a nivel nacional.',
    },
    {
      icon: Award,
      metric: '50+',
      description: 'Eventos y talleres realizados con éxito.',
    },
    {
      icon: University,
      metric: '10+',
      description: 'Alianzas con universidades y centros de innovación.',
    },
  ];

  const partners = [
    { name: 'Universidad Nacional de Ingeniería', alt: 'Logo UNI' },
    { name: 'Universidad Centroamericana', alt: 'Logo UCA' },
    { name: 'Impact Hub Managua', alt: 'Logo Impact Hub' },
    { name: 'Agora Partnerships', alt: 'Logo Agora' },
    { name: 'Startup Nicaragua', alt: 'Logo Startup Nicaragua' },
    { name: 'Centro de Innovación - UNAN', alt: 'Logo UNAN' },
  ];

  return (
    <>
      <Helmet>
        <title>Home - Boreal Labs</title>
        <meta name="description" content="Boreal Labs: Juventud que Innova Transforma crea Nicaragua. Únete al movimiento." />
      </Helmet>

      <div>
        <section className="relative min-h-screen flex items-center justify-center text-center text-white overflow-hidden">
          <div className="absolute inset-0 bg-boreal-dark z-10 opacity-60"></div>
          <div className="absolute inset-0 z-0">
             <img alt="Grupo de jovenes en evento de lanzamiento de Boreal Labs" className="w-full h-full object-cover" src="src/images/headear.jpg" />
          </div>
          <motion.div
            className="relative z-20 max-w-4xl mx-auto px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 0.2 }}
          >

{/* --- MODIFICACIÓN DEL TÍTULO --- */}
            {/* 1. 'innova': Relleno blanco y borde #da5def (con text-shadow para evitar artefactos). */}
            {/* 2. 'crea': Se aplicó la clase 'text-gradient' para un efecto de color degradado. */}
            {/* 3. 'transforma': Relleno blanco y borde #3162ed (con text-shadow). */}
            <h1 className="text-4xl md:text-6xl font-black tracking-tight">
              #Juventud{' '}
              <span>
                que
              </span>{' '}
              <span style={{ 
                color: 'white',
                textShadow: '2px 0 0 #da5def, -2px 0 0 #da5def, 0 2px 0 #da5def, 0 -2px 0 #da5def, 2px 2px 0 #da5def, -2px -2px 0 #da5def, 2px -2px 0 #da5def, -2px 2px 0 #da5def'
              }}>
                innova
              </span>
              ,{' '}
              <span className="text-gradient">
                crea
              </span>{' '}
              <span>
                y
              </span>{' '}
              <span style={{ 
                color: 'white',
                textShadow: '2px 0 0 #3162ed, -2px 0 0 #3162ed, 0 2px 0 #3162ed, 0 -2px 0 #3162ed, 2px 2px 0 #3162ed, -2px -2px 0 #3162ed, 2px -2px 0 #3162ed, -2px 2px 0 #3162ed'
              }}>
                transforma
              </span>{' '}
              <span className="text-boreal-aqua">Nicaragua</span>
            </h1>
            {/* --- FIN DE LA MODIFICACIÓN --- */}
            
            <motion.p 
              className="mt-6 text-lg md:text-xl max-w-2xl mx-auto text-gray-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.0, delay: 0.8 }}
            >
              Somos el punto de encuentro para jóvenes que buscan transformar el futuro de Nicaragua a través de la innovación y el emprendimiento.
            </motion.p>
            <motion.div 
              className="mt-8 flex justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, delay: 1.2 }}
            >
              <Link to="/events">
                <Button size="lg" className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white px-8 py-6 text-lg font-bold">
                  Ver Próximos Eventos
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        <ScrollAnimatedSection className="py-20 bg-boreal-dark">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold">
              Uniendo <span className="text-gradient">Mentes Brillantes</span> para un Futuro Innovador
            </h2>
            <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto">
              Boreal Labs es una organización sin fines de lucro, liderada por jóvenes, que articula esfuerzos y crea espacios para el desarrollo de habilidades en innovación y emprendimiento en la juventud nicaragüense.
            </p>
            <div className="mt-8">
              <Link to="/about">
                <Button variant="outline" className="border-2 border-boreal-aqua text-boreal-aqua hover:bg-boreal-aqua/10 hover:text-boreal-aqua px-8 py-4 text-base font-semibold">
                  Conoce Nuestra Historia
                </Button>
              </Link>
            </div>
          </div>
        </ScrollAnimatedSection>
        
        <ScrollAnimatedSection className="py-20 bg-boreal-blue/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Nuestros Pilares</h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">Creamos experiencias de aprendizaje únicas para potenciar tu talento.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {programs.map((program, index) => (
                <div key={index} className="glass-effect rounded-2xl p-8 text-center hover:bg-white/10 transition-all transform hover:-translate-y-2">
                  <div className="bg-gradient-to-br from-boreal-blue to-boreal-purple w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6">
                    <program.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">{program.title}</h3>
                  <p className="text-gray-400">{program.description}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimatedSection>

        <ScrollAnimatedSection className="py-20 bg-boreal-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Nuestro <span className="text-gradient">Impacto en Números</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">Construyendo una comunidad, un joven a la vez.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {impacts.map((impact, index) => (
                <div key={index} className="glass-effect rounded-2xl p-8">
                  <impact.icon className="w-12 h-12 mx-auto mb-4 text-boreal-aqua" />
                  <div className="text-4xl font-extrabold text-white">{impact.metric}</div>
                  <p className="mt-2 text-gray-400">{impact.description}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimatedSection>

        <ScrollAnimatedSection className="py-20 bg-boreal-blue/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Nuestros Aliados Estratégicos</h2>
              <p className="text-lg text-gray-400">Colaborando con los mejores para potenciar el talento nicaragüense.</p>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-x-8 md:gap-x-12 gap-y-6">
              {partners.map((partner, index) => (
                <div key={index} className="grayscale hover:grayscale-0 transition-all duration-300 flex items-center gap-x-2">
                   <Building className="w-8 h-8 text-gray-500" />
                   <span className="text-gray-400 text-lg font-semibold">{partner.name}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimatedSection>

        <ScrollAnimatedSection className="text-center py-20 bg-boreal-dark">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 glass-effect rounded-2xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              ¿Listo para ser parte del <span className="text-gradient">cambio</span>?
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
              Únete a nuestra comunidad de jóvenes innovadores. Participa en nuestros eventos, conecta con mentores y lleva tus ideas al siguiente nivel.
            </p>
            <Link to="/events">
              <Button size="lg" className="bg-gradient-to-r from-boreal-aqua to-boreal-blue text-boreal-dark px-8 py-6 text-lg font-bold">
                ¡Únete a la Comunidad!
              </Button>
            </Link>
          </div>
        </ScrollAnimatedSection>
      </div>
    </>
  );
};

export default HomePage;