import React from 'react';
import { motion } from 'framer-motion';
import { Facebook, Instagram, Linkedin, Twitter, Mail, MapPin } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const Footer = () => {
  const handleSocialClick = (platform) => {
    toast({
      title: "🚧 Social Media Link",
      description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  const socialLinks = [
    { icon: Facebook, label: 'Facebook' },
    { icon: Instagram, label: 'Instagram' },
    { icon: Linkedin, label: 'LinkedIn' },
    { icon: Twitter, label: 'Twitter' },
  ];

  return (
    <footer className="glass-effect border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <span className="text-2xl font-bold text-gradient">Boreal Labs</span>
            <p className="mt-4 text-gray-400 text-sm">
              Empowering Nicaraguan youth through innovation, entrepreneurship, and community-driven learning.
            </p>
          </div>

          <div>
            <span className="text-lg font-semibold text-white mb-4 block">Contact</span>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-gray-400 text-sm">
                <Mail className="w-4 h-4 text-boreal-aqua" />
                <span>info@boreallabs.org</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400 text-sm">
                <MapPin className="w-4 h-4 text-boreal-aqua" />
                <span>Managua, Nicaragua</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-lg font-semibold text-white mb-4 block">Follow Us</span>
            <div className="flex space-x-4">
              {socialLinks.map((social, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSocialClick(social.label)}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5 text-boreal-aqua" />
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 Boreal Labs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
