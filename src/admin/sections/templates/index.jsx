// Sección Plantillas: galería de carpetas y editor visual de layout.json.
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Gallery from './Gallery';
import Editor from './Editor';

export default function TemplatesSection() {
  return (
    <Routes>
      <Route index element={<Gallery />} />
      <Route path="editar/*" element={<Editor />} />
      <Route path="*" element={<Navigate to="/admin/plantillas" replace />} />
    </Routes>
  );
}
