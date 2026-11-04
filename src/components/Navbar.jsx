import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Wallet as WalletIcon } from 'lucide-react'; // Se eliminó 'Rocket' porque ya no se usa
import { Button } from '@/components/ui/button';
import logoBoreal from '@/images/logoBoreal.svg';

const FALLBACK_LINKS = {
  walletUrl: 'https://wallet.borealabs.org',
  communityUrl: 'https://chat.whatsapp.com/HAaxnHFYsuaBltQ812XhRW?mode=wwc',
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const walletUrl = FALLBACK_LINKS.walletUrl;
  const communityUrl = FALLBACK_LINKS.communityUrl;
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (location.pathname.toLowerCase() === '/voxlab') {
    return null;
  }


  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Nosotros', path: '/nosotros' },
    { name: 'Equipo', path: '/equipo' },
    { name: 'Eventos', path: '/eventos' },
    { name: 'Voluntariado', path: '/voluntariado' },
    { name: 'Validación', path: '/validacion' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-lg transition-[background-color,border-color,box-shadow] duration-300 border-b ${scrolled || isOpen ? 'bg-boreal-dark/90 border-white/10 shadow-lg shadow-black/20' : 'bg-boreal-dark/40 border-transparent'}`}>
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
              width="192"
              height="48"
              decoding="async"
            />
          </Link>
          {/* --- FIN MODIFICACIÓN 1 --- */}


          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                aria-current={isActive(link.path) ? 'page' : undefined}
                className="relative group rounded py-2"
              >
                <span className={`text-sm font-medium transition-colors ${
                  isActive(link.path) ? 'text-boreal-aqua' : 'text-gray-300 hover:text-white'
                }`}>
                  {link.name}
                </span>
                {isActive(link.path) && (
                  <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-boreal-aqua to-boreal-blue" />
                )}
              </Link>
            ))}

            {/* Botón destacado: Wallet (externo) */}
            <a
              href={walletUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all
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
              <a href={communityUrl} target="_blank" rel="noopener noreferrer">Comunidad</a>
            </Button>
            {/* --- FIN MODIFICACIÓN 2 --- */}
          </div>

          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              className="text-white h-11 w-11"
              aria-label={isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
              aria-expanded={isOpen}
              aria-controls="mobile-nav-menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {isOpen && (
          <div id="mobile-nav-menu" className="md:hidden bg-boreal-dark/95 border-t border-white/10">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-3 text-lg font-medium transition-colors ${
                    isActive(link.path) ? 'text-boreal-aqua bg-white/5' : 'text-gray-300 hover:text-white hover:bg-white/5'
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
                className="mt-3 flex items-center justify-center gap-2 text-lg font-bold text-white border border-boreal-aqua/60 rounded-xl py-3
                           bg-white/5 hover:bg-white/10 transition-all shadow-[0_0_18px_rgba(45,212,191,0.25)]"
              >
                <WalletIcon className="w-5 h-5 text-boreal-aqua" aria-hidden="true" />
                Wallet
              </a>

              {/* --- MODIFICACIÓN 3: BOTÓN COMUNIDAD (MÓVIL) --- */}
              <a
                href={communityUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="block text-center text-lg font-bold text-white bg-gradient-to-r from-boreal-aqua to-boreal-blue rounded-xl py-3 transition-transform active:scale-95"
              >
                Comunidad
              </a>
              {/* --- FIN MODIFICACIÓN 3 --- */}
            </div>
          </div>
        )}
    </nav>
  );
};

export default Navbar;