import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Sparkles, Flame, Target, Mic, LineChart, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import outlineVoxImg from '@/voxlab/outlinevox.png';
import voxiAwakeImg from '@/voxlab/voxi-awake.png';
import voxlabStartImg from '@/voxlab/voxlabstartpage.png';
import voxlabMapImg from '@/voxlab/voxlabmap.png';
import InstallButton, { useApkDownload } from '@/components/InstallButton';

const FEATURES = [
  {
    icon: Mic,
    title: 'Practica tu pitch',
    description:
      'Graba tu presentacion tantas veces como quieras y practica con el acompanamiento de Voxi.',
  },
  {
    icon: LineChart,
    title: 'Analiza tu ensayo',
    description:
      'Revisa tus grabaciones y descubre que mejorar: ritmo, claridad y confianza.',
  },
  {
    icon: Target,
    title: 'Ruta de aprendizaje',
    description:
      'Un mapa de progreso paso a paso, desde los fundamentos de oratoria hasta tu pitch final.',
  },
  {
    icon: User,
    title: 'Tu perfil',
    description:
      'Guarda tu cuenta y tu progreso en un solo lugar, disponible desde donde estes.',
  },
];

export default function VoxlabPage() {
  const apk = useApkDownload();

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Voxi App', url });
        return;
      } catch {
        // El usuario cancelo el dialogo: no hacer nada.
        return;
      }
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5A623] text-[#3D1107] font-agrandir relative overflow-hidden">
      <Helmet>
        <title>Voxi App - Practica tu pitch | Boreal Labs</title>
        <meta
          name="description"
          content="Descarga Voxi, la app de Boreal Labs para practicar oratoria, analizar tus grabaciones y seguir tu ruta de aprendizaje."
        />
        <meta property="og:title" content="Voxi App - Practica tu pitch" />
        <meta
          property="og:description"
          content="Practica, analiza y sigue tu ruta de aprendizaje con Voxi. Disponible para Android."
        />
      </Helmet>

      {/* Patrón de fondo */}
      <div className="absolute -inset-[100px] pointer-events-none z-0 overflow-hidden opacity-[0.16]">
        <motion.svg
          className="absolute -inset-[200px] w-[200%] h-[200%]"
          animate={{ x: [0, -210], y: [0, -210] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="voxlab-dense-scattered-pattern"
              width="210"
              height="210"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(8)"
            >
              <g transform="translate(10, 10) rotate(-10, 18, 18)">
                <image href={outlineVoxImg} width="36" height="36" preserveAspectRatio="xMidYMid meet" />
              </g>
              <g transform="translate(65, 10) rotate(-8) scale(0.55)">
                <path d="M 5,5 C 5,5 5,0 12,0 L 48,0 C 55,0 55,5 55,5 L 55,30 C 55,35 55,35 48,35 L 25,35 L 15,45 L 18,35 L 12,35 C 5,35 5,35 5,30 Z" fill="none" stroke="#A83015" strokeWidth="3" strokeLinejoin="round" />
                <line x1="15" y1="12" x2="45" y2="12" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="20" x2="38" y2="20" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="28" x2="30" y2="28" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
              </g>
              <g transform="translate(135, 12) rotate(12) scale(0.6)">
                <rect x="11" y="1" width="18" height="28" rx="9" fill="none" stroke="#A83015" strokeWidth="3" />
                <path d="M 5,20 C 5,33 35,33 35,20" fill="none" stroke="#A83015" strokeWidth="3" />
                <line x1="20" y1="33" x2="20" y2="42" stroke="#A83015" strokeWidth="3" />
                <line x1="12" y1="42" x2="28" y2="42" stroke="#A83015" strokeWidth="3" />
              </g>
              <g transform="translate(12, 85) rotate(14) scale(0.55)">
                <path d="M 5,5 C 5,5 5,0 12,0 L 48,0 C 55,0 55,5 55,5 L 55,30 C 55,35 55,35 48,35 L 25,35 L 15,45 L 18,35 L 12,35 C 5,35 5,35 5,30 Z" fill="none" stroke="#A83015" strokeWidth="3" strokeLinejoin="round" />
                <line x1="15" y1="12" x2="45" y2="12" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="20" x2="38" y2="20" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="28" x2="30" y2="28" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
              </g>
              <g transform="translate(85, 95) rotate(-10) scale(0.6)">
                <rect x="11" y="1" width="18" height="28" rx="9" fill="none" stroke="#A83015" strokeWidth="3" />
                <path d="M 5,20 C 5,33 35,33 35,20" fill="none" stroke="#A83015" strokeWidth="3" />
                <line x1="20" y1="33" x2="20" y2="42" stroke="#A83015" strokeWidth="3" />
                <line x1="12" y1="42" x2="28" y2="42" stroke="#A83015" strokeWidth="3" />
              </g>
              <g transform="translate(155, 80) rotate(8, 19, 19)">
                <image href={outlineVoxImg} width="38" height="38" preserveAspectRatio="xMidYMid meet" />
              </g>
              <g transform="translate(45, 155) rotate(-6, 18, 18)">
                <image href={outlineVoxImg} width="36" height="36" preserveAspectRatio="xMidYMid meet" />
              </g>
              <g transform="translate(150, 155) rotate(-12) scale(0.55)">
                <path d="M 5,5 C 5,5 5,0 12,0 L 48,0 C 55,0 55,5 55,5 L 55,30 C 55,35 55,35 48,35 L 25,35 L 15,45 L 18,35 L 12,35 C 5,35 5,35 5,30 Z" fill="none" stroke="#A83015" strokeWidth="3" strokeLinejoin="round" />
                <line x1="15" y1="12" x2="45" y2="12" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="20" x2="38" y2="20" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="28" x2="30" y2="28" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
              </g>
              <g transform="translate(5, 160) rotate(5) scale(0.55)">
                <rect x="11" y="1" width="18" height="28" rx="9" fill="none" stroke="#A83015" strokeWidth="3" />
                <path d="M 5,20 C 5,33 35,33 35,20" fill="none" stroke="#A83015" strokeWidth="3" />
                <line x1="20" y1="33" x2="20" y2="42" stroke="#A83015" strokeWidth="3" />
                <line x1="12" y1="42" x2="28" y2="42" stroke="#A83015" strokeWidth="3" />
              </g>
              <g transform="translate(105, 165) rotate(15, 17, 17)">
                <image href={outlineVoxImg} width="34" height="34" preserveAspectRatio="xMidYMid meet" />
              </g>
              <path d="M 175,25 L 177,30 L 182,32 L 177,34 L 175,39 L 173,34 L 168,32 L 173,30 Z" fill="#A83015" />
              <path d="M 55,60 L 57,65 L 62,67 L 57,69 L 55,74 L 53,69 L 48,67 L 53,65 Z" fill="#A83015" />
              <path d="M 125,70 L 127,75 L 132,77 L 127,79 L 125,84 L 123,79 L 118,77 L 123,75 Z" fill="#A83015" />
              <path d="M 195,125 L 197,130 L 202,132 L 197,134 L 195,139 L 193,134 L 188,132 L 193,130 Z" fill="#A83015" />
              <path d="M 95,145 L 97,150 L 102,152 L 97,154 L 95,159 L 93,154 L 88,152 L 93,150 Z" fill="#A83015" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#voxlab-dense-scattered-pattern)" />
        </motion.svg>
      </div>

      {/* Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#FFC554] rounded-full blur-3xl opacity-60 pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#D94426] rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      <div className="relative z-10">
        {/* Navbar */}
        <motion.header
          initial={{ opacity: 0, y: -25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="max-w-6xl mx-auto w-full px-4 pt-6 flex items-center justify-between"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-[#D94426] rounded-full font-bold shadow-[0_4px_0_#C8391D] border-2 border-[#D94426] transition-transform active:translate-y-1 active:shadow-none"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Volver a Boreal Labs</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#D94426] text-white text-sm font-extrabold rounded-full border-2 border-white shadow-md">
              <Flame className="w-4 h-4 text-yellow-300 animate-pulse" />
              Voxi APP
            </span>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Compartir página"
              title="Compartir página"
              className="p-2.5 bg-white/90 hover:bg-white text-[#D94426] rounded-full font-bold shadow-[0_4px_0_#C8391D] border-2 border-[#D94426] transition-transform active:translate-y-1 active:shadow-none"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </motion.header>

        {/* Hero */}
        <main className="max-w-5xl mx-auto w-full px-4 pb-16 pt-8 sm:pt-12 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative mb-2"
          >
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-52 h-10 bg-[#A83015]/20 rounded-full blur-md"></div>
            <img
              src={voxiAwakeImg}
              alt="Voxi, el asistente de Boreal Labs"
              width="240"
              height="240"
              className="w-48 h-48 sm:w-60 sm:h-60 object-contain drop-shadow-2xl"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
            className="space-y-4 mb-6"
          >
            <div className="inline-block bg-white text-[#D94426] px-5 py-2 rounded-2xl border-4 border-[#D94426] shadow-[0_5px_0_#C8391D] rotate-[-1deg]">
              <p className="text-base sm:text-lg font-black tracking-wide">
                Ya puedes tener a Voxi en tu teléfono
              </p>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-[#D94426] tracking-tight leading-[0.95] drop-shadow-[0_2px_0_rgba(255,255,255,0.8)]">
              Practica tu pitch
              <br />
              hasta que brille
            </h1>

            <p className="text-lg sm:text-2xl font-bold text-[#6E2211] max-w-2xl mx-auto">
              Voxi te acompana para grabar tu presentacion, analizar como lo hiciste y seguir tu
              ruta de aprendizaje, dia a dia.
            </p>
          </motion.div>

          {/* Boton de instalacion principal */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
            className="mb-6"
          >
            <InstallButton status={apk.status} error={apk.error} onCheck={apk.check} variant="hero" />
          </motion.div>

          {/* Capturas reales de la app */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65, ease: 'easeOut' }}
            className="w-full mt-10 grid gap-6 sm:grid-cols-2 max-w-3xl"
          >
            <figure className="flex flex-col items-center">
              <img
                src={voxlabStartImg}
                alt="Pantalla de registro de Voxi"
                width="360"
                height="760"
                loading="lazy"
                className="w-40 sm:w-48 rounded-[2rem] border-4 border-white shadow-[0_12px_0_#C8391D] object-cover"
              />
              <figcaption className="mt-4 text-sm font-bold text-[#6E2211]">
                Crea tu cuenta y guarda tu progreso
              </figcaption>
            </figure>

            <figure className="flex flex-col items-center">
              <img
                src={voxlabMapImg}
                alt="Mapa de la ruta de aprendizaje de Voxi"
                width="360"
                height="760"
                loading="lazy"
                className="w-40 sm:w-48 rounded-[2rem] border-4 border-white shadow-[0_12px_0_#C8391D] object-cover"
              />
              <figcaption className="mt-4 text-sm font-bold text-[#6E2211]">
                Tu ruta de aprendizaje paso a paso
              </figcaption>
            </figure>
          </motion.div>

          {/* Features */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8, ease: 'easeOut' }}
            className="w-full mt-16 sm:mt-24"
          >
            <div className="flex items-center justify-center gap-2 mb-8 text-[#D94426]">
              <Sparkles className="w-6 h-6" />
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider">
                Que hace Voxi
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto text-left">
              {FEATURES.map(({ icon: Icon, title, description }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 + i * 0.08, ease: 'easeOut' }}
                  className="flex gap-4 bg-white/95 backdrop-blur-md rounded-3xl p-5 border-4 border-[#D94426] shadow-[0_8px_0_#C8391D]"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#D94426] text-white grid place-items-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-[#D94426] text-lg leading-tight mb-1">{title}</p>
                    <p className="text-[#6E2211] font-bold text-sm leading-relaxed">{description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* CTA final */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.1, ease: 'easeOut' }}
            className="w-full mt-16 sm:mt-24 bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-12 border-4 border-[#D94426] shadow-[0_10px_0_#C8391D] max-w-3xl mx-auto"
          >
            <h2 className="text-2xl sm:text-4xl font-black text-[#D94426] leading-tight mb-3">
              Empieza hoy
            </h2>
            <p className="text-[#6E2211] font-bold text-lg mb-7 max-w-xl mx-auto">
              Descarga Voxi, crea tu cuenta gratis y practica tu primera presentacion en minutos.
            </p>

            <InstallButton
              status={apk.status}
              error={apk.error}
              onCheck={apk.check}
              variant="section"
            />
          </motion.section>

          </main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.3, ease: 'easeOut' }}
          className="py-8 text-center text-[#7F2612] font-bold text-sm"
        >
          <p className="flex items-center justify-center gap-2">
            <span>Hecho por</span>
            <span className="bg-white/80 px-2.5 py-0.5 rounded-full text-[#D94426] font-black border border-[#D94426]">
              @voxlab.ni
            </span>
            <span>&</span>
            <span className="bg-white/80 px-2.5 py-0.5 rounded-full text-[#D94426] font-black border border-[#D94426]">
              Boreal Labs
            </span>
          </p>
        </motion.footer>
      </div>
    </div>
  );
}