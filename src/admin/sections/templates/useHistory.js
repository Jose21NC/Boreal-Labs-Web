// Deshacer/rehacer para el editor. Los cambios "transitorios" (arrastrar) no crean entradas hasta commit().
import { useCallback, useState } from 'react';

const LIMIT = 100;

export function useHistory(initial) {
  const [h, setH] = useState({ past: [], present: initial, future: [], base: null });

  const set = useCallback((updater, transient = false) => setH((s) => {
    const next = typeof updater === 'function' ? updater(s.present) : updater;
    if (transient) return { ...s, present: next, base: s.base ?? s.present };
    return { past: [...s.past, s.base ?? s.present].slice(-LIMIT), present: next, future: [], base: null };
  }), []);

  const commit = useCallback(() => setH((s) => (
    s.base ? { past: [...s.past, s.base].slice(-LIMIT), present: s.present, future: [], base: null } : s
  )), []);

  const undo = useCallback(() => setH((s) => (s.past.length
    ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future], base: null }
    : s)), []);

  const redo = useCallback(() => setH((s) => (s.future.length
    ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), base: null }
    : s)), []);

  const reset = useCallback((value) => setH({ past: [], present: value, future: [], base: null }), []);

  return { state: h.present, set, commit, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
