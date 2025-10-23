import React from 'react';
import { motion } from 'framer-motion';
// --- MODIFICACIÓN 1: IMPORTS ---
// Se eliminaron Facebook, Linkedin, Twitter y toast. Solo se conserva Instagram.
import { Instagram, Mail, MapPin } from 'lucide-react';

const Footer = () => {
  // --- MODIFICACIÓN 2: LÓGICA SIMPLIFICADA ---
  // Se eliminó la función 'handleSocialClick' y el array 'socialLinks'
  // ya que solo se usará un enlace directo.

  return (
    <footer className="glass-effect border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            {/* --- MODIFICACIÓN 3: LOGO --- */}
            {/* Se reemplazó el texto 'Boreal Labs' por una imagen. */}
            {/* ¡Asegúrate de que la ruta '/boreal-logo.svg' sea la correcta! */}
            <img 
              src="src/images/logoBoreal.svg"
              alt="Boreal Labs Logo" 
              className="h-12 w-auto" // Ajusta la altura (h-10) según necesites
            />
            {/* --- MODIFICACIÓN 4: TEXTO EN ESPAÑOL --- */}
            <p className="mt-4 text-gray-400 text-sm">
              Empoderando a la juventud nicaragüense a través de la innovación, el emprendimiento y el aprendizaje.
            </p>
          </div>

          <div>
            {/* --- MODIFICACIÓN 4: TEXTO EN ESPAÑOL --- */}
            <span className="text-lg font-semibold text-white mb-4 block">Contacto</span>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-gray-400 text-sm">
                <Mail className="w-4 h-4 text-boreal-aqua" />
                <span>contacto@borealabs.org</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400 text-sm">
                <MapPin className="w-4 h-4 text-boreal-aqua" />
                <span>Managua, Nicaragua</span>
              </div>
            </div>
          </div>

          <div>
            {/* --- MODIFICACIÓN 4: TEXTO EN ESPAÑOL --- */}
            <span className="text-lg font-semibold text-white mb-4 block">Síguenos</span>
            <div className="flex space-x-4">
              {/* --- MODIFICACIÓN 5: SOLO INSTAGRAM --- */}
              {/* Se eliminó el .map() y se dejó un solo enlace <a> a Instagram */}
              <motion.a
                href="https://instagram.com/boreal.labs" // <-- ¡CAMBIA ESTA URL POR LA DE TU INSTAGRAM!
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5 text-boreal-aqua" />
              </motion.a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 text-center">
          {/* --- MODIFICACIÓN 4: TEXTO EN ESPAÑOL --- */}
          <p className="text-gray-400 text-sm">
            © 2025 Boreal Labs. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;