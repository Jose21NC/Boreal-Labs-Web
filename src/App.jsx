import React, { useState, createContext } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary'; // Assuming you have this component
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// Se importa HelmetProvider y Helmet (si necesitas Helmet global)
import { HelmetProvider, Helmet } from 'react-helmet-async'; 
import { Toaster } from '@/components/ui/toaster';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HomePage from '@/pages/HomePage';
import AboutPage from '@/pages/AboutPage';
import TeamPage from '@/pages/TeamPage';
import EventsPage from '@/pages/EventsPage';
// Se importa el proveedor de reCAPTCHA
// Google reCAPTCHA v3 removed - using only reCAPTCHA v2 where needed

export const RecaptchaContext = createContext({
  recaptchaTokenV2: null,
  setRecaptchaTokenV2: () => {},
  recaptchaSiteKey: null,
});

function App() {
  // Estado para almacenar el token reCAPTCHA v2 a nivel de aplicación
  const [recaptchaTokenV2, setRecaptchaTokenV2] = useState(null);
  // Clave del sitio reCAPTCHA (preferible desde variable de entorno VITE_RECAPTCHA_SITE_KEY)
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Le4B_UrAAAAAIY93oAoOIfnkHJ_DXej03I5SQ5e';

  return (
    // Se envuelve todo con HelmetProvider
    <HelmetProvider>
      <RecaptchaContext.Provider value={{ recaptchaTokenV2, setRecaptchaTokenV2, recaptchaSiteKey }}>
        <Router>
          {/* --- CÓDIGO RESTAURADO: Helmet original --- */}
          <Helmet>
            <title>Boreal Labs - Juventud que Innova Transforma crea Nicaragua</title>
            <meta name="description" content="Boreal Labs is a Nicaraguan youth-led non-profit fostering innovation and entrepreneurship through workshops, talks, and events." />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet" />
          </Helmet>
          {/* --- FIN CÓDIGO RESTAURADO --- */}

          <div className="min-h-screen flex flex-col bg-boreal-dark">
            <Navbar />
            <main className="flex-grow">
              <ErrorBoundary> {/* ErrorBoundary envuelve las Rutas */}
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/events" element={<EventsPage />} />
                </Routes>
              </ErrorBoundary>
            </main>
            <Footer />
            <Toaster />
          </div>
        </Router>
      </RecaptchaContext.Provider>
    </HelmetProvider>
  );
}

export default App;

