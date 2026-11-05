// Suscripción en vivo a voluntarios y registros de horas: si otro admin aprueba, la lista se actualiza sola.
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { toDate } from '@/admin/lib';
import { indexByEmail } from './utils';

const byDateDesc = (field) => (a, b) => (toDate(b[field])?.getTime() || 0) - (toDate(a[field])?.getTime() || 0);

function useCollection(name, sortField) {
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  useEffect(() => {
    if (!db) {
      setState({ rows: [], loading: false, error: new Error('Firebase no está configurado.') });
      return undefined;
    }
    // Sin orderBy en la consulta: así no se pierden docs sin el campo ni hace falta índice.
    return onSnapshot(
      collection(db, name),
      (snap) => setState({ rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byDateDesc(sortField)), loading: false, error: null }),
      (error) => setState((s) => ({ ...s, loading: false, error })),
    );
  }, [name, sortField]);
  return state;
}

export default function useVolunteerData() {
  const volunteers = useCollection('voluntarios2026', 'fechaRegistro');
  const logs = useCollection('volunteerAttendanceLogs', 'createdAt');
  const byEmail = useMemo(() => indexByEmail(volunteers.rows), [volunteers.rows]);
  return {
    volunteers: volunteers.rows,
    logs: logs.rows,
    byEmail,
    loading: volunteers.loading || logs.loading,
    error: volunteers.error || logs.error,
  };
}
