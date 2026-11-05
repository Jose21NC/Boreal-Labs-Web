// Sección Equipo: /admin/equipo (listado), /solicitudes, /enlaces, /nuevo y /:id (editor).
import React, { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { PageHeader, Tabs } from '@/admin/ui';
import TeamList from './TeamList';
import MemberEditor from './MemberEditor';
import RequestsTab from './Requests';
import InvitesTab from './Invites';

function TeamNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pending, setPending] = useState(null);
  useEffect(() => {
    if (!db) return undefined;
    return onSnapshot(query(collection(db, 'teamSubmissions'), where('status', '==', 'pending')), (snap) => setPending(snap.size), () => setPending(null));
  }, []);
  const value = pathname.endsWith('/solicitudes') ? 'solicitudes' : pathname.endsWith('/enlaces') ? 'enlaces' : '';
  return (
    <Tabs
      className="mb-6"
      value={value}
      onChange={(v) => navigate(v ? `/admin/equipo/${v}` : '/admin/equipo')}
      items={[
        { value: '', label: 'Integrantes' },
        { value: 'solicitudes', label: 'Solicitudes', count: pending || null },
        { value: 'enlaces', label: 'Enlaces de perfil' },
      ]}
    />
  );
}

const withNav = (title, description, el) => (
  <>
    <TeamNav />
    {title && <PageHeader title={title} description={description} />}
    {el}
  </>
);

export default function TeamSection() {
  return (
    <Routes>
      <Route index element={withNav(null, null, <TeamList />)} />
      <Route path="solicitudes" element={withNav('Solicitudes de perfil', 'Perfiles enviados por enlace. Se publican en /equipo solo al aprobarlos.', <RequestsTab />)} />
      <Route path="enlaces" element={withNav('Enlaces de perfil', 'Enlaces únicos para que un integrante complete o actualice su perfil.', <InvitesTab />)} />
      <Route path="nuevo" element={<MemberEditor />} />
      <Route path=":id" element={<MemberEditor />} />
    </Routes>
  );
}
