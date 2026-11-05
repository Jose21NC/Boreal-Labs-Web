// Sección "Eventos y asistencia": lista de eventos y detalle con inscritos/asistencia.
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import EventList from './EventList';
import EventDetail from './EventDetail';
import { Store, useEventsData } from './store';

export default function EventsSection() {
  const store = useEventsData();
  return (
    <Store.Provider value={store}>
      <Routes>
        <Route index element={<EventList />} />
        <Route path=":eventKey" element={<EventDetail />} />
      </Routes>
    </Store.Provider>
  );
}
