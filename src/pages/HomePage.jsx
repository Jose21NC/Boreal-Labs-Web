import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
// Se agregó el ícono de 'Instagram'
import { ArrowRight, Zap, Mic, Heart, Award, School as University, Building, Instagram, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import headerImage from '@/images/headear.webp';
import headerImageMobile from '@/images/headear-mobile.webp';
import headerImageMobile480 from '@/images/headear-mobile-480.webp';
import workshopImage from '@/images/taller.webp';
import workshopImage768 from '@/images/taller-768.webp';
import workshopImageMobile from '@/images/taller-mobile.webp';
import workshopImageMobile480 from '@/images/taller-mobile-480.webp';
import partnerUam from '@/images/partners/uam.webp';
import partnerUni from '@/images/partners/uni.webp';
import partnerInatec from '@/images/partners/inatec.webp';
import partnerUnanNuevo from '@/images/partners/unanNuevo.webp';
import partnerAspire from '@/images/partners/aspire.webp';
import partnerTedx from '@/images/partners/logo-white.webp';

const FALLBACK_HOME_CONFIG = {
  impacts: [
    { icon: 'Heart', metric: '+850', description: 'Jóvenes impactados a nivel nacional.' },
    { icon: 'Award', metric: '12', description: 'Eventos y talleres realizados con éxito.' },
    { icon: 'University', metric: '7', description: 'Alianzas con universidades y centros de innovación.' }
  ],
  partners: [
    { name: 'Universidad Americana (UAM)', alt: 'Logo UAM', imgSrc: partnerUam, width: 256, height: 91 },
    { name: 'Universidad Nacional de Ingeniería', alt: 'Logo UNI', imgSrc: partnerUni, width: 207, height: 128 },
    { name: 'Tecnologico Nacional (INATEC)', alt: 'Logo INATEC', imgSrc: partnerInatec, width: 218, height: 128 },
    { name: 'Universidad Nacional Autonoma de Nicaragua, Managua - UNAN', alt: 'Logo UNAN', imgSrc: partnerUnanNuevo, width: 181, height: 128 },
    { name: 'Aspire Institute Inc.', alt: 'Logo Aspire', imgSrc: partnerAspire, width: 256, height: 97 },
    { name: 'TEDx Avenida Bolivar', alt: 'Logo TEDx Avenida Bolivar', imgSrc: partnerTedx, width: 256, height: 89 },
  ]
};

const ScrollAnimatedSection = ({ children, className }) => {
  return <section className={className}>{children}</section>;
};

const HomePage = () => {
  const siteUrl = 'https://borealabs.org';
  const canonicalUrl = `${siteUrl}/`;
  const instagramRef = useRef(null);
  const [shouldLoadInstagramWidget, setShouldLoadInstagramWidget] = useState(false);

  const [homeConfig] = useState(FALLBACK_HOME_CONFIG);
  
  const programs = [
    {
      icon: Zap,
      title: 'Talleres Formativos',
      description: 'Sumérgete en la innovación, liderazgo, tecnología y más con nuestros talleres prácticos.',
    },
    {
      icon: Mic,
      title: 'Charlas Inspiradoras',
      description: 'Conéctate con líderes, emprendedores y docentes que están cambiando el juego en Nicaragua.',
    },
    {
      icon: Building,
      title: 'Espacios de Conexión',
      description: 'Contamos con oficina presencial y eventos para colaborar con otros jóvenes apasionados.',
    },
  ];

  // Mapeamos los nombres de los iconos guardados en BD a los componentes importados de Lucide
  const iconMap = {
    Heart, Award, University, Zap, Building, Mic, Instagram, Star, Users
  };

  const impacts = homeConfig.impacts.map(item => ({
    ...item,
    icon: iconMap[item.icon] || Heart // Por defecto Heart si no se encuentra
  })).filter((item) => {
    const metric = String(item.metric || '').trim();
    const description = String(item.description || '').toLowerCase();
    return !(metric === '8' && description.includes('emprendimiento'));
  });
  const hasCertificatesImpact = impacts.some((item) => {
    const metric = String(item.metric || '').toLowerCase();
    const description = String(item.description || '').toLowerCase();
    return metric.includes('280') && description.includes('certificado');
  });
  const impactsWithCertificates = hasCertificatesImpact
    ? impacts
    : [
        ...impacts,
        {
          metric: '280',
          description: 'certificados digitales emitidos',
          icon: Award,
        },
      ];

  const partners = homeConfig.partners;

  useEffect(() => {
    if (!instagramRef.current || shouldLoadInstagramWidget) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadInstagramWidget(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(instagramRef.current);
    return () => observer.disconnect();
  }, [shouldLoadInstagramWidget]);

  useEffect(() => {
    if (!shouldLoadInstagramWidget || typeof document === 'undefined') return;
    if (!document.getElementById('EmbedSocialHashtagScript')) {
      const js = document.createElement('script');
      js.id = 'EmbedSocialHashtagScript';
      js.src = 'https://embedsocial.com/cdn/ht.js';
      js.async = true;
      js.defer = true;
      document.getElementsByTagName('head')[0].appendChild(js);
    }
  }, [shouldLoadInstagramWidget]);


  return (
    <>
      <Helmet>
        <title>Inicio - Boreal Labs</title>
        <meta 
          name="description" 
          content="Somos una comunidad juvenil que busca transformar el futuro de Nicaragua y latinoamerica a través de la innovación y el emprendimiento." 
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_NI" />
        <meta property="og:site_name" content="Boreal Labs" />
        <meta property="og:title" content="Boreal Labs | Juventud que innova, crea y transforma" />
        <meta property="og:description" content="Comunidad juvenil que impulsa innovación y emprendimiento en Nicaragua y Latinoamérica." />
        <meta property="og:url" content={canonicalUrl} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Boreal Labs | Juventud que innova, crea y transforma" />
        <meta name="twitter:description" content="Comunidad juvenil que impulsa innovación y emprendimiento en Nicaragua y Latinoamérica." />
        <link
          rel="preload"
          as="image"
          href={headerImageMobile}
          media="(max-width: 768px)"
          imagesrcset={`${headerImageMobile480} 480w, ${headerImageMobile} 800w`}
          imagesizes="100vw"
          fetchpriority="high"
        />
        <link rel="preload" as="image" href={headerImage} media="(min-width: 769px)" fetchpriority="high" />
      </Helmet>

      <div>
        {/* --- SECCIÓN HERO --- */}
        <section className="relative min-h-screen flex items-center justify-center text-center text-white overflow-hidden">
          <div className="absolute inset-0 bg-boreal-dark z-10 opacity-60"></div>
          <div className="absolute inset-0 z-0">
             <picture>
              <source
                media="(max-width: 768px)"
                srcSet={`${headerImageMobile480} 480w, ${headerImageMobile} 800w`}
                sizes="100vw"
              />
              <img alt="Grupo de jovenes en evento de lanzamiento de Boreal Labs" className="w-full h-full object-cover" src={headerImage} width="1920" height="1080" fetchpriority="high" decoding="async" />
             </picture>
          </div>
          <div className="relative z-20 max-w-4xl mx-auto px-4 min-h-[350px] md:min-h-[380px] flex flex-col items-center justify-center">
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
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
              <span style={{
                backgroundImage: 'linear-gradient(to right, #69e6af, #3162ed)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent'
              }}>
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
            
            <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto text-white">
              Somos una comunidad juvenil apasionada que busca transformar activamente el futuro de Nicaragua y Latinoamérica a través de la innovación y el emprendimiento.
            </p>

            <div className="mt-8 flex justify-center">
              <Link to="/eventos">
                <Button size="lg" className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white px-8 py-6 text-lg font-bold">
                  Ver Próximos Eventos
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* --- SECCIÓN "UNIENDO MENTES" --- */}
        <ScrollAnimatedSection className="py-20 bg-boreal-dark">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold">
              Uniendo <span className="text-gradient">Mentes Brillantes</span> para un Futuro Innovador
            </h2>
            <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto">
              Boreal Labs es una organización sin fines de lucro, liderada por jóvenes, que articula esfuerzos y crea espacios para el desarrollo de habilidades en innovación y emprendimiento en la juventud nicaragüense.
            </p>
            <div className="mt-12 flex justify-center">
              <picture>
                <source
                  media="(max-width: 768px)"
                  srcSet={`${workshopImageMobile480} 480w, ${workshopImageMobile} 800w`}
                  sizes="(max-width: 768px) 92vw, 768px"
                />
                <img 
                  src={workshopImage768}
                  srcSet={`${workshopImage768} 768w, ${workshopImage} 1280w`}
                  sizes="(max-width: 768px) 92vw, 768px"
                  alt="Jóvenes de Boreal Labs en un taller" 
                  className="rounded-2xl shadow-xl object-cover w-full max-w-3xl h-auto"
                  width="1280"
                  height="720"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="mt-12">
              <Link to="/nosotros">
                <Button variant="outline" className="border-2 border-boreal-aqua text-boreal-aqua hover:bg-boreal-aqua/10 hover:text-boreal-aqua px-8 py-4 text-base font-semibold">
                  Conoce Nuestra Historia
                </Button>
              </Link>
            </div>
          </div>
        </ScrollAnimatedSection>
        
        {/* --- SECCIÓN PILARES --- */}
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

        {/* --- SECCIÓN IMPACTO --- */}
        <ScrollAnimatedSection className="py-20 bg-boreal-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Nuestro <span className="text-gradient">Impacto en Números</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">Construyendo una comunidad, un joven a la vez.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              {impactsWithCertificates.map((impact, index) => (
                <div key={index} className="glass-effect rounded-2xl p-8">
                  <impact.icon className="w-12 h-12 mx-auto mb-4 text-boreal-aqua" />
                  <div className="text-4xl font-extrabold text-white">{impact.metric}</div>
                  <p className="mt-2 text-gray-400">{impact.description}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimatedSection>

        {/* --- SECCIÓN ALIADOS --- */}
        <ScrollAnimatedSection className="py-20 bg-boreal-blue/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Nuestros Aliados Estratégicos</h2>
              <p className="text-lg text-gray-400">Colaborando con los mejores para potenciar el talento nicaragüense.</p>
            </div>
            <div className="flex flex-wrap justify-center items-start gap-x-12 md:gap-x-16 gap-y-8">
              {partners.map((partner, index) => (
                <div key={index} className="flex flex-col items-center text-center gap-y-3 w-40">
                   <img 
                     src={partner.imgSrc} 
                     alt={partner.alt} 
                     className="h-16 w-auto object-contain"
                     width={partner.width || 128}
                     height={partner.height || 64}
                     loading="lazy"
                     decoding="async"
                   />
                   <span className="text-gray-400 text-sm font-semibold">{partner.name}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimatedSection>

        {/* --- SECCIÓN DE INSTAGRAM --- */}
        <ScrollAnimatedSection className="py-20 bg-boreal-dark">
          <div ref={instagramRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Síguenos en <span className="text-gradient">Instagram</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
                Entérate de nuestros últimos eventos, talleres y noticias de la comunidad.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-[#da5def] to-[#3162ed] text-white font-bold transition-transform hover:scale-105"
              >
                <a href="https://instagram.com/boreal.labs" target="_blank" rel="noopener noreferrer">
                  <Instagram className="mr-2 w-5 h-5" />
                  @boreal.labs
                </a>
              </Button>
            </div>
            
            {shouldLoadInstagramWidget ? (
              <div className="glass-effect rounded-2xl min-h-[520px] overflow-hidden">
                <div
                  className="embedsocial-hashtag"
                  data-ref="25ea543c23c71d10a060d4c621620aaa5cd54958"
                >
                  <a
                    className="feed-powered-by-es feed-powered-by-es-feed-img es-widget-branding"
                    href="https://embedsocial.com/social-media-aggregator/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Instagram widget"
                  >
                    <img src="https://embedsocial.com/cdn/icon/embedsocial-logo.webp" alt="EmbedSocial" width="64" height="64" loading="lazy" decoding="async" />
                    <div className="es-widget-branding-text">Instagram widget</div>
                  </a>
                </div>
              </div>
            ) : (
              <div className="glass-effect rounded-2xl min-h-[520px] flex items-center justify-center text-gray-400">
                Cargando feed de Instagram...
              </div>
            )}


          </div>
        </ScrollAnimatedSection>

        {/* --- SECCIÓN CALL TO ACTION --- */}
        <ScrollAnimatedSection className="text-center py-20 bg-boreal-dark">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 glass-effect rounded-2xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              ¿Listo para ser parte del <span className="text-gradient">cambio</span>?
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
              Únete a nuestra comunidad de jóvenes innovadores. Participa en nuestros eventos, conecta con mentores y lleva tus ideas al siguiente nivel.
            </p>
            <Link to="https://chat.whatsapp.com/HAaxnHFYsuaBltQ812XhRW?mode=wwc">
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