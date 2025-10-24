import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react'; // Se eliminó 'Rocket' porque ya no se usa
import { Button } from '@/components/ui/button';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Acerca de', path: '/about' },
    { name: 'Equipo', path: '/team' },
    { name: 'Eventos', path: '/events' },
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
              src="src/images/logoBoreal.svg" 
              alt="Boreal Labs" 
              className="h-12 w-auto" // Ajusta la altura (h-10) según necesites
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

            {/* --- MODIFICACIÓN 2: BOTÓN COMUNIDAD (DESKTOP) --- */}
            <Button
              asChild
              className="bg-gradient-to-r from-boreal-aqua to-boreal-blue text-white font-bold transition-transform hover:scale-105"
            >
              <Link to="https://chat.whatsapp.com/HAaxnHFYsuaBltQ812XhRW?mode=wwc">Comunidad</Link>
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

              {/* --- MODIFICACIÓN 3: BOTÓN COMUNIDAD (MÓVIL) --- */}
              <Link
                to="https://chat.whatsapp.com/HAaxnHFYsuaBltQ812XhRW?mode=wwc"
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