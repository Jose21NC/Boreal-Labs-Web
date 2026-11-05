import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Mic, Building, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import headerImage from '@/images/headear.webp';
import headerImageMobile from '@/images/headear-mobile.webp';
import headerImageMobile480 from '@/images/headear-mobile-480.webp';
import workshopImage from '@/images/taller.webp';
import workshopImage768 from '@/images/taller-768.webp';
import workshopImageMobile from '@/images/taller-mobile.webp';
import workshopImageMobile480 from '@/images/taller-mobile-480.webp';
import { ImpactGrid, PartnerGrid } from '@/components/HomeConfigSections';
import { useHomeConfig, useSiteLinks } from '@/lib/useSiteConfig';

const ScrollAnimatedSection = ({ children, className }) => {
  return <section className={className}>{children}</section>;
};

const HomePage = () => {
  const siteUrl = 'https://borealabs.org';
  const canonicalUrl = `${siteUrl}/`;
  const instagramRef = useRef(null);
  const [shouldLoadInstagramWidget, setShouldLoadInstagramWidget] = useState(false);

  // Defaults al instante; se reemplazan con siteConfig/home y siteConfig/links (editables en /admin/sitio).
  const homeConfig = useHomeConfig();
  const links = useSiteLinks();
  
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
        <section className="relative min-h-[100svh] flex items-center justify-center text-center text-white overflow-hidden">
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-boreal-dark/75 via-boreal-dark/60 to-boreal-dark"></div>
          <div className="absolute inset-0 z-0">
             {homeConfig.images.hero ? (
              <img alt="Grupo de jovenes en evento de Boreal Labs" className="w-full h-full object-cover" src={homeConfig.images.hero} width="1920" height="1080" fetchpriority="high" decoding="async" />
             ) : (
             <picture>
              <source
                media="(max-width: 768px)"
                srcSet={`${headerImageMobile480} 480w, ${headerImageMobile} 800w`}
                sizes="100vw"
              />
              <img alt="Grupo de jovenes en evento de lanzamiento de Boreal Labs" className="w-full h-full object-cover" src={headerImage} width="1920" height="1080" fetchpriority="high" decoding="async" />
             </picture>
             )}
          </div>
          <div className="relative z-20 max-w-4xl mx-auto px-4 min-h-[350px] md:min-h-[380px] flex flex-col items-center justify-center">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-[1.05]">
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
            
            <p className="mt-6 text-lg md:text-xl max-w-[60ch] mx-auto text-gray-100 leading-relaxed">
              Somos una comunidad juvenil apasionada que busca transformar activamente el futuro de Nicaragua y Latinoamérica a través de la innovación y el emprendimiento.
            </p>

            <div className="mt-8 flex justify-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white px-8 py-6 text-lg font-bold">
                <Link to="/eventos">
                  Ver Próximos Eventos
                  <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* --- SECCIÓN "UNIENDO MENTES" --- */}
        <ScrollAnimatedSection className="py-20 md:py-28 bg-boreal-dark">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Uniendo <span className="text-gradient">Mentes Brillantes</span> para un Futuro Innovador
            </h2>
            <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto">
              Boreal Labs es una organización sin fines de lucro, liderada por jóvenes, que articula esfuerzos y crea espacios para el desarrollo de habilidades en innovación y emprendimiento en la juventud nicaragüense.
            </p>
            <div className="mt-12 flex justify-center">
              {homeConfig.images.workshop ? (
                <img
                  src={homeConfig.images.workshop}
                  alt="Jóvenes de Boreal Labs en un taller"
                  className="rounded-2xl shadow-xl object-cover w-full max-w-3xl h-auto"
                  width="1280"
                  height="720"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
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
              )}
            </div>
            <div className="mt-12">
              <Button asChild variant="outline" size="lg" className="border-2 border-boreal-aqua bg-transparent text-boreal-aqua hover:bg-boreal-aqua/10 hover:text-boreal-aqua px-8 text-base font-semibold">
                <Link to="/nosotros">Conoce Nuestra Historia</Link>
              </Button>
            </div>
          </div>
        </ScrollAnimatedSection>
        
        {/* --- SECCIÓN PILARES --- */}
        <ScrollAnimatedSection className="py-20 md:py-28 bg-boreal-blue/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Nuestros Pilares</h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">Creamos experiencias de aprendizaje únicas para potenciar tu talento.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {programs.map((program, index) => (
                <div key={index} className="glass-effect rounded-2xl p-8 text-center border border-white/10 transition-[transform,background-color,border-color] duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-boreal-aqua/30">
                  <div className="bg-gradient-to-br from-boreal-blue to-boreal-purple w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6">
                    <program.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">{program.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{program.description}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimatedSection>

        {/* --- SECCIÓN IMPACTO --- */}
        <ScrollAnimatedSection className="py-20 md:py-28 bg-boreal-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                  Nuestro <span className="text-gradient">Impacto en Números</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">Construyendo una comunidad, un joven a la vez.</p>
            </div>
            <ImpactGrid impacts={homeConfig.impacts} />
          </div>
        </ScrollAnimatedSection>

        {/* --- SECCIÓN ALIADOS --- */}
        <ScrollAnimatedSection className="py-20 md:py-28 bg-boreal-blue/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Nuestros Aliados Estratégicos</h2>
              <p className="text-lg text-gray-400">Colaborando con los mejores para potenciar el talento nicaragüense.</p>
            </div>
            <PartnerGrid partners={homeConfig.partners} />
          </div>
        </ScrollAnimatedSection>

        {/* --- SECCIÓN DE INSTAGRAM --- */}
        <ScrollAnimatedSection className="py-20 md:py-28 bg-boreal-dark">
          <div ref={instagramRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
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
                <a href={links.instagramUrl} target="_blank" rel="noopener noreferrer">
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
        <ScrollAnimatedSection className="text-center py-20 md:py-28 bg-boreal-dark">
          <div className="mx-4 sm:mx-6 lg:mx-auto max-w-4xl glass-effect rounded-3xl border border-white/10 bg-gradient-to-br from-boreal-blue/15 via-transparent to-boreal-aqua/10 px-6 py-10 md:p-14">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              ¿Listo para ser parte del <span className="text-gradient">cambio</span>?
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
              Únete a nuestra comunidad de jóvenes innovadores. Participa en nuestros eventos, conecta con mentores y lleva tus ideas al siguiente nivel.
            </p>
            <Button asChild size="lg" className="bg-gradient-to-r from-boreal-aqua to-boreal-blue text-boreal-dark px-8 py-6 text-lg font-bold">
              <a href={links.communityUrl} target="_blank" rel="noopener noreferrer">¡Únete a la Comunidad!</a>
            </Button>
          </div>
        </ScrollAnimatedSection>
      </div>
    </>
  );
};

export default HomePage;