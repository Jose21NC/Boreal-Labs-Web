import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HomePage from '@/pages/HomePage';
import AboutPage from '@/pages/AboutPage';
import TeamPage from '@/pages/TeamPage';
import EventsPage from '@/pages/EventsPage';

function App() {
  return (
    <Router>
      <Helmet>
        <title>Boreal Labs - Juventud que Innova Transforma crea Nicaragua</title>
        <meta name="description" content="Boreal Labs is a Nicaraguan youth-led non-profit fostering innovation and entrepreneurship through workshops, talks, and events." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-boreal-dark">
        <Navbar />
        <main className="flex-grow">
          <ErrorBoundary>
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
  );
}

export default App;
