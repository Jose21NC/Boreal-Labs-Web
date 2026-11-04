import React, { useRef, useState } from 'react';

// Filtro anti-bots sin backend: campo trampa (honeypot) + tiempo mínimo de llenado.
// shortcut: no frena bots que ejecutan JS como humanos; para eso está App Check (src/firebase.jsx).
const MIN_FILL_MS = 3000;

export const EMAIL_RE = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;

export function useFormGuard() {
  const startedAt = useRef(Date.now());
  const [trap, setTrap] = useState('');

  const isBot = () => trap !== '' || Date.now() - startedAt.current < MIN_FILL_MS;

  const honeypot = (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="website">No completar</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
    </div>
  );

  return { isBot, honeypot };
}
