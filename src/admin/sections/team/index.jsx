// Sección Equipo: /admin/equipo (listado), /admin/equipo/nuevo y /admin/equipo/:id (editor).
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import TeamList from './TeamList';
import MemberEditor from './MemberEditor';

export default function TeamSection() {
  return (
    <Routes>
      <Route index element={<TeamList />} />
      <Route path="nuevo" element={<MemberEditor />} />
      <Route path=":id" element={<MemberEditor />} />
    </Routes>
  );
}
