import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { canSee, sectionOfPath, useAccess } from './access';
import AdminLayout from './AdminLayout';
import { Skeleton } from './ui';

const Dashboard = lazy(() => import('./sections/dashboard'));
const Activity = lazy(() => import('./sections/activity'));
const Events = lazy(() => import('./sections/events'));
const Certificates = lazy(() => import('./sections/certificates'));
const Templates = lazy(() => import('./sections/templates'));
const Points = lazy(() => import('./sections/points'));
const Volunteers = lazy(() => import('./sections/volunteers'));
const Team = lazy(() => import('./sections/team'));
const Site = lazy(() => import('./sections/site'));
const Access = lazy(() => import('./sections/access'));

const Loading = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Cargando">
    <Skeleton className="h-8 w-56" />
    <Skeleton className="h-28 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

/** Sección sin permiso (p. ej. URL escrita a mano) → al Resumen. */
function Guard({ children }) {
  const access = useAccess();
  const { pathname } = useLocation();
  return canSee(access, sectionOfPath(pathname)) ? children : <Navigate to="/admin" replace />;
}

// Rutas relativas a /admin. Cada sección puede definir sus propias subrutas (p. ej. eventos/:id).
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<Guard><AdminLayout /></Guard>}>
        <Route index element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
        <Route path="actividad/*" element={<Suspense fallback={<Loading />}><Activity /></Suspense>} />
        <Route path="eventos/*" element={<Suspense fallback={<Loading />}><Events /></Suspense>} />
        <Route path="certificados/*" element={<Suspense fallback={<Loading />}><Certificates /></Suspense>} />
        <Route path="plantillas/*" element={<Suspense fallback={<Loading />}><Templates /></Suspense>} />
        <Route path="puntos/*" element={<Suspense fallback={<Loading />}><Points /></Suspense>} />
        <Route path="voluntariado/*" element={<Suspense fallback={<Loading />}><Volunteers /></Suspense>} />
        <Route path="equipo/*" element={<Suspense fallback={<Loading />}><Team /></Suspense>} />
        <Route path="sitio/*" element={<Suspense fallback={<Loading />}><Site /></Suspense>} />
        <Route path="accesos/*" element={<Suspense fallback={<Loading />}><Access /></Suspense>} />
        <Route path="layout" element={<Navigate to="/admin/plantillas" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
