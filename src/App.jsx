import React, { Suspense, lazy, useState, createContext } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary'; // Assuming you have this component
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
// Se importa HelmetProvider y Helmet (si necesitas Helmet global)
import { HelmetProvider, Helmet } from 'react-helmet-async'; 
import { Toaster } from '@/components/ui/toaster';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import AdminGate from '@/components/AdminGate';

const HomePage = lazy(() => import('@/pages/HomePage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const TeamPage = lazy(() => import('@/pages/TeamPage'));
const TeamEditorPage = lazy(() => import('@/pages/TeamEditorPage'));
const EventsPage = lazy(() => import('@/pages/EventsPage'));
const VolunteerPage = lazy(() => import('@/pages/VolunteerPage'));
const VolunteerAttendancePage = lazy(() => import('@/pages/VolunteerAttendancePage'));
const VolunteerPersonalPage = lazy(() => import('@/pages/VolunteerPersonalPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const LayoutEditor = lazy(() => import('@/pages/LayoutEditor'));
const PaginaValidacion = lazy(() => import('@/pages/PaginaValidacion'));
const AdminPanel = lazy(() => import('@/pages/AdminPanel'));
const VolunteerAdminPanel = lazy(() => import('@/pages/VolunteerAdminPanel'));

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
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {/* Fuerza scroll al tope en cada navegación */}
          <ScrollToTop behavior="smooth" />
          {/* --- CÓDIGO RESTAURADO: Helmet original --- */}
          <Helmet>
            <title>Boreal Labs - Juventud que Innova Transforma crea Nicaragua</title>
            <meta name="description" content="Boreal Labs is a Nicaraguan youth-led non-profit fostering innovation and entrepreneurship through workshops, talks, and events." />
          </Helmet>
          {/* --- FIN CÓDIGO RESTAURADO --- */}

          <div className="min-h-screen flex flex-col bg-boreal-dark">
            <Navbar />
            <main className="flex-grow">
              <ErrorBoundary> {/* ErrorBoundary envuelve las Rutas */}
                <Suspense
                  fallback={(
                    <div className="min-h-[50vh] flex items-center justify-center text-boreal-aqua text-lg">
                      Cargando...
                    </div>
                  )}
                >
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    {/* Rutas en español */}
                    <Route path="/nosotros" element={<AboutPage />} />
                    <Route path="/equipo" element={<TeamPage />} />
                    <Route path="/equipo/editar" element={<TeamEditorPage />} />
                    <Route path="/eventos" element={<EventsPage />} />
                    <Route path="/voluntariado" element={<VolunteerPage />} />
                    <Route path="/voluntariado/asistencia" element={<VolunteerAttendancePage />} />
                    <Route path="/voluntariado/personal" element={<VolunteerPersonalPage />} />

                    {/* Admin */}
                    <Route path="/admin" element={<AdminGate><AdminPanel /></AdminGate>} />
                    <Route path="/admin/layout" element={<AdminGate><LayoutEditor /></AdminGate>} />
                    <Route path="/voluntariado/admin" element={<AdminGate><VolunteerAdminPanel /></AdminGate>} />

                    {/* Redirecciones desde rutas antiguas en inglés */}
                    <Route path="/about" element={<Navigate to="/nosotros" replace />} />
                    <Route path="/team" element={<Navigate to="/equipo" replace />} />
                    <Route path="/events" element={<Navigate to="/eventos" replace />} />
                    <Route path="/volunteer" element={<Navigate to="/voluntariado" replace />} />
                    <Route path="/validar-certificado" element={<PaginaValidacion />} />
                    <Route path="/validacion" element={<PaginaValidacion />} />

                    <Route path="*" element={<NotFoundPage />} /> {/* Ruta para página no encontrada */}
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
            <ConditionalFooter />
            <Toaster />
          </div>
        </Router>
      </RecaptchaContext.Provider>
    </HelmetProvider>
  );
}

export default App;

// Footer condicional según ruta y viewport (ocultar en móviles para admin y validación)
function ConditionalFooter() {
  const location = useLocation();
  const path = location.pathname || '';
  const hideOnMobile = path.startsWith('/admin') || path === '/validacion' || path === '/validar-certificado';
  if (hideOnMobile) {
    return (
      <div className="hidden sm:block">
        <Footer />
      </div>
    );
  }
  return <Footer />;
}

