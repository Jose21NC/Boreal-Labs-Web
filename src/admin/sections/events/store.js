// Estado compartido de la sección: una lectura por colección, lo usan lista y detalle.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { mergeCategories } from '@/lib/eventForms';
import { groupEvents } from './data';

export const Store = createContext(null);
export const useEventsStore = () => useContext(Store);

const load = async (name) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));

/** Una lectura por colección para toda la sección; las vistas comparten el mismo estado. */
export function useEventsData() {
  const [state, setState] = useState({ events: [], manual: [], regs: [], catItems: [], loading: true, error: null });

  const reload = useCallback(async () => {
    if (!db) {
      setState((s) => ({ ...s, loading: false, error: 'Firebase no está configurado.' }));
      return;
    }
    try {
      const [events, manual, regs, cats] = await Promise.all([
        load('events'), load('adminEvents'), load('registrations'),
        // Categorías personalizadas: si falla la lectura quedan las integradas.
        getDoc(doc(db, 'siteConfig', 'eventCategories')).then((s) => s.data()?.items || []).catch(() => []),
      ]);
      setState({ events, manual, regs, catItems: cats, loading: false, error: null });
    } catch (error) {
      console.error('[admin/eventos] carga', error);
      setState((s) => ({ ...s, loading: false, error: 'No se pudieron cargar los eventos.' }));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Para la UI optimista de asistencia: parchea registros locales sin recargar.
  const patchRegs = useCallback((ids, patchFn) => {
    setState((s) => ({ ...s, regs: s.regs.map((r) => (ids.has(r.id) ? { ...r, ...patchFn(r) } : r)) }));
  }, []);

  const setCatItems = useCallback((catItems) => setState((s) => ({ ...s, catItems })), []);

  const groups = useMemo(() => groupEvents(state.events, state.manual, state.regs), [state.events, state.manual, state.regs]);
  const categories = useMemo(() => mergeCategories(state.catItems), [state.catItems]);
  return { ...state, groups, categories, reload, patchRegs, setCatItems };
}

