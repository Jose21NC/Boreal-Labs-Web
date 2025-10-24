import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home } from 'lucide-react'; // Ícono para el error

const NotFoundPage = () => {
  return (
    <>
      <Helmet>
        <title>Página no encontrada - Boreal Labs</title>
        <meta name="description" content="La página que buscas no existe o ha sido movida." />
      </Helmet>

      <div className="pt-32 pb-20 bg-boreal-dark flex items-center justify-center min-h-screen text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8"
        >
          <AlertTriangle className="w-24 h-24 text-boreal-purple mx-auto mb-8 animate-bounce" />
          <h1 className="text-6xl md:text-8xl font-black text-white mb-4">
            404
          </h1>
          <h2 className="text-3xl md:text-4xl font-bold text-gradient mb-6">
            Página No Encontrada
          </h2>
          <p className="text-lg text-gray-300 mb-10">
            Lo sentimos, la página que estás buscando no existe o ha sido movida.
          </p>
          <Link to="/">
            <Button
              size="lg"
              className="bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white px-8 py-4 text-lg font-semibold"
            >
              <Home className="mr-2 w-5 h-5" />
              Volver al Inicio
            </Button>
          </Link>
        </motion.div>
      </div>
    </>
  );
};

export default NotFoundPage;
