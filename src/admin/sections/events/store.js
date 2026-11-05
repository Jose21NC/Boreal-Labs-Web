// Estado compartido de la sección: una lectura por colección, lo usan lista y detalle.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { mergeCategories } from '@/lib/eventForms';
import { groupEvents } from './data';
import { logActivity } from '@/admin/lib';

export const Store = createContext(null);
export const useEventsStore = () => useContext(Store);

const load = async (name) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));

/**
 * Corrige `registeredCount` de los eventos públicos que no coinciden con sus inscripciones reales
 * (p. ej. registros borrados desde la consola de Firebase), para que la web no los muestre llenos.
 * Usa los registros ya leídos: no hace lecturas extra y solo escribe si hay diferencias.
 * shortcut: una inscripción que llegue entre la lectura y esta escritura queda fuera del conteo; la próxima carga lo corrige.
 */
async function healCounters(events, regs) {
  const counts = {};
  regs.forEach((r) => { if (r.eventId) counts[r.eventId] = (counts[r.eventId] || 0) + 1; });
  const drifted = events.filter((e) => (Number(e.registeredCount) || 0) !== (counts[e.id] || 0));
  if (!drifted.length) return events;
  try {
    const batch = writeBatch(db);
    drifted.slice(0, 450).forEach((e) => batch.update(doc(db, 'events', e.id), { registeredCount: counts[e.id] || 0 }));
    await batch.commit();
    logActivity('eventos.cupos_corregidos', `Corrigió automáticamente el cupo de ${drifted.length} evento(s)`, { ids: drifted.map((e) => e.id).slice(0, 50) });
    return events.map((e) => ({ ...e, registeredCount: counts[e.id] || 0 }));
  } catch (error) {
    console.warn('[admin/eventos] No se pudieron corregir los cupos', error);
    return events;
  }
}

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
      setState({ events: await healCounters(events, regs), manual, regs, catItems: cats, loading: false, error: null });
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

