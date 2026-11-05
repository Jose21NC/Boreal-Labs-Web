// Sección Certificados: listado de emitidos y asistente de generación.
import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CertificateList from './List';
import { Skeleton } from '@/admin/ui';

// El asistente usa el motor de plantillas (pdf-lib, ~1 MB): el listado no debe cargarlo.
const Wizard = lazy(() => import('./Wizard'));

export default function CertificatesSection() {
  return (
    <Routes>
      <Route index element={<CertificateList />} />
      <Route path="generar" element={<Suspense fallback={<Skeleton className="h-96 w-full" />}><Wizard /></Suspense>} />
      <Route path="*" element={<Navigate to="/admin/certificados" replace />} />
    </Routes>
  );
}
