import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Bell, Share2, ArrowLeft, Check, Sparkles, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import voxiSleepingImg from '@/voxlab/voxi.png';
import outlineVoxImg from '@/voxlab/outlinevox.png';

// Helper: Target launch date (October 7 at 11:00 AM)
const getTargetDate = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  let target = new Date(currentYear, 9, 7, 11, 0, 0); // Month 9 is October (0-indexed)

  if (now > target) {
    target = new Date(currentYear + 1, 9, 7, 11, 0, 0);
  }
  return target;
};

export default function VoxlabPage() {
  const [targetDate] = useState(getTargetDate);

  const calculateTimeLeft = useCallback(() => {
    const difference = +targetDate - +new Date();
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isOver: false,
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSleeping, setIsSleeping] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handlePetVoxi = () => {
    setIsSleeping(false);
    setTimeout(() => setIsSleeping(true), 2500);
  };

  const formatTime = (num) => String(num).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#F5A623] text-[#3D1107] font-agrandir flex flex-col justify-between relative overflow-hidden select-none">
      <Helmet>
        <title>Voxlab App - Cuenta Atrás | Boreal Labs</title>
        <meta name="description" content="Shhh... Voxi aún está durmiendo. Voxlab app se lanza el 7 de octubre a las 11:00 AM." />
        <meta property="og:title" content="Voxlab - Cuenta Atrás Voxi" />
        <meta property="og:description" content="Shhh... Voxi aún está durmiendo. Gran lanzamiento este 7 de octubre a las 11:00 AM." />
      </Helmet>

      {/* Dense Organic Scattered Background Pattern */}
      <div className="absolute -inset-[100px] pointer-events-none z-0 overflow-hidden opacity-[0.16]">
        <motion.svg
          className="absolute -inset-[200px] w-[200%] h-[200%]"
          animate={{
            x: [0, -210],
            y: [0, -210],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: 'linear',
          }}
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
              {/* Item 1: Voxi Outline (Top-Left) */}
              <g transform="translate(10, 10) rotate(-10, 18, 18)">
                <image href={outlineVoxImg} width="36" height="36" preserveAspectRatio="xMidYMid meet" />
              </g>

              {/* Item 2: Speech Bubble (Top-Center) */}
              <g transform="translate(65, 10) rotate(-8) scale(0.55)">
                <path d="M 5,5 C 5,5 5,0 12,0 L 48,0 C 55,0 55,5 55,5 L 55,30 C 55,35 55,35 48,35 L 25,35 L 15,45 L 18,35 L 12,35 C 5,35 5,35 5,30 Z" fill="none" stroke="#A83015" strokeWidth="3" strokeLinejoin="round" />
                <line x1="15" y1="12" x2="45" y2="12" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="20" x2="38" y2="20" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="28" x2="30" y2="28" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* Item 3: Microphone (Top-Right) */}
              <g transform="translate(135, 12) rotate(12) scale(0.6)">
                <rect x="11" y="1" width="18" height="28" rx="9" fill="none" stroke="#A83015" strokeWidth="3" />
                <path d="M 5,20 C 5,33 35,33 35,20" fill="none" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
                <line x1="20" y1="33" x2="20" y2="42" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
                <line x1="12" y1="42" x2="28" y2="42" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
              </g>

              {/* Item 4: Speech Bubble (Middle-Left) */}
              <g transform="translate(12, 85) rotate(14) scale(0.55)">
                <path d="M 5,5 C 5,5 5,0 12,0 L 48,0 C 55,0 55,5 55,5 L 55,30 C 55,35 55,35 48,35 L 25,35 L 15,45 L 18,35 L 12,35 C 5,35 5,35 5,30 Z" fill="none" stroke="#A83015" strokeWidth="3" strokeLinejoin="round" />
                <line x1="15" y1="12" x2="45" y2="12" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="20" x2="38" y2="20" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="28" x2="30" y2="28" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* Item 5: Microphone (Center) */}
              <g transform="translate(85, 95) rotate(-10) scale(0.6)">
                <rect x="11" y="1" width="18" height="28" rx="9" fill="none" stroke="#A83015" strokeWidth="3" />
                <path d="M 5,20 C 5,33 35,33 35,20" fill="none" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
                <line x1="20" y1="33" x2="20" y2="42" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
                <line x1="12" y1="42" x2="28" y2="42" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
              </g>

              {/* Item 6: Voxi Outline (Middle-Right) */}
              <g transform="translate(155, 80) rotate(8, 19, 19)">
                <image href={outlineVoxImg} width="38" height="38" preserveAspectRatio="xMidYMid meet" />
              </g>

              {/* Item 7: Voxi Outline (Bottom-Left) */}
              <g transform="translate(45, 155) rotate(-6, 18, 18)">
                <image href={outlineVoxImg} width="36" height="36" preserveAspectRatio="xMidYMid meet" />
              </g>

              {/* Item 8: Speech Bubble (Bottom-Right) */}
              <g transform="translate(150, 155) rotate(-12) scale(0.55)">
                <path d="M 5,5 C 5,5 5,0 12,0 L 48,0 C 55,0 55,5 55,5 L 55,30 C 55,35 55,35 48,35 L 25,35 L 15,45 L 18,35 L 12,35 C 5,35 5,35 5,30 Z" fill="none" stroke="#A83015" strokeWidth="3" strokeLinejoin="round" />
                <line x1="15" y1="12" x2="45" y2="12" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="20" x2="38" y2="20" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="28" x2="30" y2="28" stroke="#A83015" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* Item 9: Microphone (Bottom-Left Offset) */}
              <g transform="translate(5, 160) rotate(5) scale(0.55)">
                <rect x="11" y="1" width="18" height="28" rx="9" fill="none" stroke="#A83015" strokeWidth="3" />
                <path d="M 5,20 C 5,33 35,33 35,20" fill="none" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
                <line x1="20" y1="33" x2="20" y2="42" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
                <line x1="12" y1="42" x2="28" y2="42" stroke="#A83015" strokeWidth="3" strokeLinecap="round" />
              </g>

              {/* Item 10: Voxi Outline (Bottom-Center Offset) */}
              <g transform="translate(105, 165) rotate(15, 17, 17)">
                <image href={outlineVoxImg} width="34" height="34" preserveAspectRatio="xMidYMid meet" />
              </g>

              {/* Scattered Sparkle Stars */}
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

      {/* Decorative Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#FFC554] rounded-full blur-3xl opacity-60 pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#D94426] rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      {/* Top Navbar - Stagger Step 1 (delay 0.1s) */}
      <motion.header
        initial={{ opacity: 0, y: -25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        className="relative z-10 max-w-6xl mx-auto w-full px-4 pt-6 flex items-center justify-between"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-[#D94426] rounded-full font-bold shadow-[0_4px_0_#C8391D] border-2 border-[#D94426] transition-transform active:translate-y-1 active:shadow-none"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Volver a Boreal Labs</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Voxlab App Badge - Hidden on mobile, visible on sm+ screens */}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#D94426] text-white text-sm font-extrabold rounded-full border-2 border-white shadow-md">
            <Flame className="w-4 h-4 text-yellow-300 animate-pulse" />
            VoxLab APP
          </span>
          <button
            onClick={handleShare}
            aria-label="Compartir página"
            className="p-2.5 bg-white/90 hover:bg-white text-[#D94426] rounded-full font-bold shadow-[0_4px_0_#C8391D] border-2 border-[#D94426] transition-transform active:translate-y-1 active:shadow-none"
            title="Compartir página"
          >
            {copied ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
          </button>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col items-center text-center my-auto">
        {/* Sleeping Mascot Container - Stagger Step 2 (delay 0.3s) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.75, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-6 cursor-pointer group"
          onClick={handlePetVoxi}
          role="button"
          aria-label="Tocar a Voxi"
        >
          {/* Animated Zzz floating bubbles */}
          <AnimatePresence>
            {isSleeping && (
              <div className="absolute -top-10 right-2 pointer-events-none z-20">
                <motion.span
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 0], y: [-10, -45], x: [0, 15], scale: [0.8, 1.2, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0 }}
                  className="absolute text-2xl font-black text-[#D94426] drop-shadow-md"
                >
                  Z
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 0], y: [-15, -55], x: [10, -10], scale: [0.7, 1.1, 0.9] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 }}
                  className="absolute left-6 text-3xl font-black text-[#D94426] drop-shadow-md"
                >
                  z
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 0], y: [-20, -65], x: [20, 25], scale: [0.6, 1, 0.8] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 1.6 }}
                  className="absolute left-12 text-4xl font-black text-white stroke-black drop-shadow-lg"
                >
                  z...
                </motion.span>
              </div>
            )}
          </AnimatePresence>

          {/* Voxi Image */}
          <motion.div
            animate={
              isSleeping
                ? { y: [-6, 6, -6], rotate: [-1, 1, -1] }
                : { scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }
            }
            transition={{
              duration: isSleeping ? 4 : 0.5,
              repeat: isSleeping ? Infinity : 0,
              ease: 'easeInOut',
            }}
            className="relative"
          >
            {/* Soft Shadow behind Voxi */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-8 bg-[#A83015]/20 rounded-full blur-md"></div>

            <img
              src={voxiSleepingImg}
              alt="Voxi durmiendo"
              className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105"
            />
          </motion.div>
        </motion.div>

        {/* Main Banner Headline - Stagger Step 3 (delay 0.5s) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
          className="space-y-3 mb-8"
        >
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-[#D94426] tracking-tight leading-none drop-shadow-[0_2px_0_rgba(255,255,255,0.8)]">
            Shhh... Voxi aún está durmiendo
          </h1>

          <div className="inline-block bg-white text-[#D94426] px-6 py-2.5 rounded-2xl border-4 border-[#D94426] shadow-[0_6px_0_#C8391D] rotate-[-1deg]">
            <p className="text-lg sm:text-2xl font-black tracking-wide">
              ¡El próximo año, te ayuda con tu pitch! 😉
            </p>
          </div>
        </motion.div>

        {/* Countdown Section - Stagger Step 4 (delay 0.7s) */}
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border-4 border-[#D94426] shadow-[0_10px_0_#C8391D] mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-4 text-[#D94426]">
            <Clock className="w-6 h-6 animate-spin-slow" />
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider">
              Lanzamiento Oficial
            </h2>
          </div>

          <p className="text-base sm:text-lg font-bold text-[#6E2211] mb-6">
            7 de Octubre a las 11:00 AM
          </p>

          {/* Countdown Cards */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {/* Days */}
            <div className="flex flex-col items-center">
              <div className="w-full bg-[#D94426] text-white rounded-2xl py-3 sm:py-5 border-2 border-[#A8290F] shadow-[0_4px_0_#921E07]">
                <span className="text-2xl sm:text-5xl font-black tracking-tight leading-none">
                  {formatTime(timeLeft.days)}
                </span>
              </div>
              <span className="mt-2 text-xs sm:text-sm font-black text-[#8A240E] uppercase tracking-wide">
                Días
              </span>
            </div>

            {/* Hours */}
            <div className="flex flex-col items-center">
              <div className="w-full bg-[#D94426] text-white rounded-2xl py-3 sm:py-5 border-2 border-[#A8290F] shadow-[0_4px_0_#921E07]">
                <span className="text-2xl sm:text-5xl font-black tracking-tight leading-none">
                  {formatTime(timeLeft.hours)}
                </span>
              </div>
              <span className="mt-2 text-xs sm:text-sm font-black text-[#8A240E] uppercase tracking-wide">
                Horas
              </span>
            </div>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <div className="w-full bg-[#D94426] text-white rounded-2xl py-3 sm:py-5 border-2 border-[#A8290F] shadow-[0_4px_0_#921E07]">
                <span className="text-2xl sm:text-5xl font-black tracking-tight leading-none">
                  {formatTime(timeLeft.minutes)}
                </span>
              </div>
              <span className="mt-2 text-xs sm:text-sm font-black text-[#8A240E] uppercase tracking-wide">
                Minutos
              </span>
            </div>

            {/* Seconds */}
            <div className="flex flex-col items-center">
              <div className="w-full bg-[#D94426] text-white rounded-2xl py-3 sm:py-5 border-2 border-[#A8290F] shadow-[0_4px_0_#921E07]">
                <span className="text-2xl sm:text-5xl font-black tracking-tight leading-none text-yellow-300">
                  {formatTime(timeLeft.seconds)}
                </span>
              </div>
              <span className="mt-2 text-xs sm:text-sm font-black text-[#8A240E] uppercase tracking-wide">
                Segs.
              </span>
            </div>
          </div>
        </motion.div>

        {/* Email Waitlist Notification Form - Stagger Step 5 (delay 0.9s) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {subscribed ? (
            <div className="bg-emerald-500 text-white p-4 rounded-2xl border-4 border-emerald-700 shadow-[0_6px_0_#046c4e] flex items-center justify-center gap-3">
              <Sparkles className="w-6 h-6 animate-bounce" />
              <span className="font-extrabold text-base sm:text-lg">
                Tuani! Te avisaremos el 7 de Octubre cuando Voxi despierte.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ingresa tu correo electrónico..."
                className="flex-1 px-5 py-3.5 rounded-2xl bg-white border-4 border-[#D94426] text-[#3D1107] placeholder-[#D94426]/60 font-bold focus:outline-none focus:ring-4 focus:ring-[#D94426]/30 shadow-md text-base"
                aria-label="Correo electrónico"
              />
              <button
                type="submit"
                className="px-6 py-3.5 bg-[#D94426] hover:bg-[#C8391D] text-white font-black rounded-2xl border-4 border-white shadow-[0_6px_0_#921E07] transition-transform active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 whitespace-nowrap text-base"
              >
                <Bell className="w-5 h-5" />
                Avisarme
              </button>
            </form>
          )}
        </motion.div>
      </main>

      {/* Footer / Social Credits - Stagger Step 6 (delay 1.1s) */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.1, ease: 'easeOut' }}
        className="relative z-10 py-6 text-center text-[#7F2612] font-bold text-sm"
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
  );
}
