import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Wallet as WalletIcon } from 'lucide-react'; // Se eliminó 'Rocket' porque ya no se usa
import { Button } from '@/components/ui/button';
import { defaultLinks, subscribeLinks } from '@/lib/configService';
import logoBoreal from '@/images/logoBoreal.svg';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [walletUrl, setWalletUrl] = useState(defaultLinks.walletUrl);
  const [communityUrl, setCommunityUrl] = useState(defaultLinks.communityUrl);
  const location = useLocation();
  useEffect(() => {
    const unsub = subscribeLinks((links) => {
      setWalletUrl(links.walletUrl || defaultLinks.walletUrl);
      setCommunityUrl(links.communityUrl || defaultLinks.communityUrl);
    });
    return () => unsub && unsub();
  }, []);


  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Nosotros', path: '/nosotros' },
    { name: 'Equipo', path: '/equipo' },
    { name: 'Eventos', path: '/eventos' },
    { name: 'Validación', path: '/validacion' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-effect">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* --- MODIFICACIÓN 1: LOGO --- */}
          {/* Se reemplazó el cohete y el texto por una etiqueta <img> */}
          <Link to="/" className="flex items-center">
            {/* ¡IMPORTANTE! 
              Si está en la carpeta 'public', la ruta está bien.
              Si está en 'src/assets', deberás importarlo arriba:
              import logo from '@/assets/boreal-logo.svg';
              y usar 'src={logo}' abajo.
            */}
            <img 
              src={logoBoreal} 
              alt="Boreal Labs" 
              className="h-12 w-auto" 
            />
          </Link>
          {/* --- FIN MODIFICACIÓN 1 --- */}


          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="relative group"
              >
                <span className={`text-sm font-medium transition-colors ${
                  isActive(link.path) ? 'text-boreal-aqua' : 'text-gray-300 hover:text-white'
                }`}>
                  {link.name}
                </span>
                {isActive(link.path) && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-boreal-aqua to-boreal-blue"
                  />
                )}
              </Link>
            ))}

            {/* Botón destacado: Wallet (externo) */}
            <a
              href={walletUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all
                         border border-boreal-aqua/60 bg-white/5 hover:bg-white/10
                         shadow-[0_0_18px_rgba(45,212,191,0.25)] hover:shadow-[0_0_26px_rgba(45,212,191,0.45)]"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-boreal-aqua/20 to-boreal-blue/20 opacity-0 blur-sm transition-opacity group-hover:opacity-100" />
              <WalletIcon className="w-4 h-4 text-boreal-aqua" />
              <span>Wallet</span>
            </a>

            {/* --- MODIFICACIÓN 2: BOTÓN COMUNIDAD (DESKTOP) --- */}
            <Button
              asChild
              className="bg-gradient-to-r from-boreal-aqua to-boreal-blue text-white font-bold transition-transform hover:scale-105"
            >
              <Link to={communityUrl}>Comunidad</Link>
            </Button>
            {/* --- FIN MODIFICACIÓN 2 --- */}
          </div>

          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              className="text-white"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-effect border-t border-white/10"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block text-lg font-medium transition-colors ${
                    isActive(link.path) ? 'text-boreal-aqua' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {/* Botón destacado: Wallet (MÓVIL) */}
              <a
                href={walletUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 text-lg font-bold text-white border border-boreal-aqua/60 rounded-xl py-3
                           bg-white/5 hover:bg-white/10 transition-all shadow-[0_0_18px_rgba(45,212,191,0.25)]"
              >
                <WalletIcon className="w-5 h-5 text-boreal-aqua" />
                Wallet
              </a>

              {/* --- MODIFICACIÓN 3: BOTÓN COMUNIDAD (MÓVIL) --- */}
              <Link
                to={communityUrl}
                onClick={() => setIsOpen(false)}
                className="block text-center text-lg font-bold text-white bg-gradient-to-r from-boreal-aqua to-boreal-blue rounded-lg py-3 transition-transform hover:scale-105 active:scale-95"
              >
                Comunidad
              </Link>
              {/* --- FIN MODIFICACIÓN 3 --- */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;