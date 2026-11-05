import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Calendar, MapPin, Users, Clock, Share2, Copy, X as XIcon, CheckCircle } from 'lucide-react'; // Icono Share2 añadido
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose // Para cerrar el modal
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Selector para la pregunta
import { useToast } from '@/components/ui/use-toast';
// reCAPTCHA v3 removed: using only reCAPTCHA v2 (react-google-recaptcha)
import ReCAPTCHA from 'react-google-recaptcha';

// Modo de prueba (npm run dev:demo): sin captcha, igual que el admin sin login. Nunca es 'demo' en un build.
const IS_DEMO = import.meta.env.MODE === 'demo';
import { RecaptchaContext } from '@/App.jsx';
// --- MODIFICACIÓN 1: Imports de Firebase ---
import { db, storage } from '@/firebase.jsx'; // Asegúrate que la ruta sea correcta
import { collection, getDocs, query, orderBy, serverTimestamp, doc, getDoc, writeBatch, increment } from 'firebase/firestore';
import { useFormGuard, EMAIL_RE } from '@/lib/antiSpam';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';
import EventCustomFields, { FieldShell, OptionCards, inputCls } from '@/components/EventCustomFields';
import { safeUrl } from '@/lib/team';
import { BUILTIN_CATEGORIES, loadEventCategories, normalizeCode, validateAnswers } from '@/lib/eventForms';
import { compressImageFile } from '@/lib/image';

const isEventPast = (ev) => {
  if (!ev?.date) return false;
  const endOfDay = new Date(ev.date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay < new Date();
};

// Componente del formulario (ahora dentro de EventsPage)
const EventRegistrationForm = ({ event, onSuccess, onShowConfirmation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [university, setUniversity] = useState('');
  const [country, setCountry] = useState('');
  const [department, setDepartment] = useState('');
  const [isMember, setIsMember] = useState('');
  const [tipoAsistencia, setTipoAsistencia] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [codeOk, setCodeOk] = useState(false);
  // Campos adicionales definidos en el admin (events/{id}.formFields).
  const formFields = Array.isArray(event?.formFields) ? event.formFields : [];
  const [answers, setAnswers] = useState({});
  // Opciones de asistencia configurables por evento
  const getAttendanceOptions = () => {
    // Soporta varias formas: array en event.tipoAsistencia o event.tipoAsistenciaOptions,
    // e incluso string separado por comas.
    const raw = Array.isArray(event?.tipoAsistencia)
      ? event.tipoAsistencia
      : Array.isArray(event?.tipoAsistenciaOptions)
        ? event.tipoAsistenciaOptions
        : (typeof event?.tipoAsistencia === 'string'
            ? event.tipoAsistencia.split(',')
            : (typeof event?.tipoAsistenciaOptions === 'string'
                ? event.tipoAsistenciaOptions.split(',')
                : null));
    const cleaned = (raw || ['Presencial', 'Virtual'])
      .map(o => (o ?? '').toString().trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : ['Presencial', 'Virtual'];
  };
  const asistenciaOptions = getAttendanceOptions();
  const [loading, setLoading] = useState(false);
  const [recaptchaV2Token, setRecaptchaV2Token] = useState(null);
  const recaptchaRef = useRef(null);
  const { toast } = useToast();
  const { setRecaptchaTokenV2, recaptchaSiteKey } = useContext(RecaptchaContext);
  const { isBot, honeypot } = useFormGuard();

  const [errors, setErrors] = useState({});
  const setField = (key, setter) => (v) => { setter(v); setErrors((er) => (er[key] ? { ...er, [key]: undefined } : er)); };

  // Errores en línea (además del toast): campos estándar + los adicionales con la misma lógica de validateAnswers.
  const collectErrors = () => {
    const req = 'Este campo es obligatorio.';
    const er = {};
    if (!name.trim()) er.name = req;
    if (!email.trim()) er.email = req; else if (!EMAIL_RE.test(email.trim())) er.email = 'Revisa que tu correo esté bien escrito.';
    if (!whatsapp.trim()) er.whatsapp = req;
    if (!university.trim()) er.university = req;
    if (!country.trim()) er.country = req;
    if (!department.trim()) er.department = req;
    if (!isMember) er.isMember = 'Elige una opción.';
    if (!tipoAsistencia) er.tipoAsistencia = 'Elige una opción.';
    for (const f of formFields) {
      const msg = validateAnswers([f], answers);
      if (msg) er[f.id] = msg;
    }
    return er;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const er = collectErrors();
    setErrors(er);
    const firstKey = Object.keys(er)[0];
    if (firstKey) {
      const el = document.getElementById(STD_IDS[firstKey] || `reg-extra-${firstKey}`) || document.querySelector(`[name="reg-extra-${firstKey}"]`) || document.querySelector(`[name="reg-${firstKey}"]`);
      el?.focus?.();
      toast({ title: 'Revisa el formulario', description: 'Hay campos por completar o corregir.', variant: 'destructive' });
      return;
    }

    // Antes del captcha: la validación ya corrió arriba, así el token no caduca mientras se corrigen campos.
    if (!recaptchaV2Token && !IS_DEMO) {
      toast({
        title: "Captcha requerido",
        description: "Por favor, marca el captcha 'No soy un robot' antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    if (isBot()) {
      toast({ title: 'Espera un momento', description: 'Revisa tus datos e intenta enviar de nuevo en unos segundos.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Las imágenes se suben antes del batch: el registro guarda solo { url, path, name }.
      const cleanAnswers = {};
      for (const field of formFields) {
        const v = answers[field.id];
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
        if (field.type === 'image') {
          const file = await compressImageFile(v);
          const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '') || 'imagen.jpg';
          const path = `registration-uploads/${event.id}/${Date.now()}-${safeName}`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, file, { contentType: file.type });
          cleanAnswers[field.id] = { url: await getDownloadURL(fileRef), path, name: v.name.slice(0, 200) };
        } else if (field.type === 'number') {
          cleanAnswers[field.id] = Number(v);
        } else {
          cleanAnswers[field.id] = typeof v === 'string' ? v.trim() : v;
        }
      }
      // Registro + contador de cupos en un solo batch; firestore.rules valida el +1 y el tope de capacity.
      // ID determinista evento+correo: un segundo registro con el mismo correo es rechazado por las reglas.
      const regRef = doc(db, 'registrations', `${event.id}_${email.trim().toLowerCase()}`);
      const batch = writeBatch(db);
      batch.set(regRef, {
        eventName: event.title,
        eventId: event.id,
        userName: name,
        userEmail: email.trim().toLowerCase(),
        userWhatsapp: whatsapp,
        userUniversity: university,
        userCountry: country,
        userDepartment: department,
        isCommunityMember: isMember === 'yes',
        tipoAsistencia,
        recaptchaTokenV2: recaptchaV2Token || null,
        registrationDate: serverTimestamp(),
        ...(formFields.length ? { answers: cleanAnswers } : {}),
        // Mayúsculas y sin espacios, igual que lo guarda el admin en eventSecrets (ver normalizeCode).
        ...(event.requiresCode ? { accessCode: normalizeCode(accessCode) } : {}),
      });
      batch.update(doc(db, 'events', event.id), { registeredCount: increment(1), lastRegistrationId: regRef.id });
      await batch.commit();

      toast({
        title: "¡Registro Exitoso!",
        description: `Te has registrado correctamente para ${event.title}.`,
      });
      
      const extraMsg = (
        event?.mensajeConfirmacion ??
        event?.confirmMessage ??
        event?.mensaje ??
        event?.mensajeExtra ??
        event?.nota ??
        (event && event['mensajeConfirmación']) ??
        ''
      ).toString().trim();
      const baseMsg = `Te has registrado exitosamente para el evento: ${event.title}.`;
      const asistenciaMsg = tipoAsistencia ? `\n\nTipo de asistencia seleccionado: ${tipoAsistencia}.` : '';
      // Enlace de Meet del evento (events/{id}.meetLink) solo para quien eligió modalidad virtual.
      const meet = safeUrl(event?.meetLink);
      const virtualMsg = meet && (tipoAsistencia || '').toLowerCase().includes('virtual') && !extraMsg.includes(meet.trim())
        ? `📍 Asistencia virtual: entra aquí el día del evento: ${meet.trim()}`
        : '';
      const finalMsg = [baseMsg + asistenciaMsg, extraMsg, virtualMsg].filter(Boolean).join("\n\n");

      onShowConfirmation(finalMsg || baseMsg);
      onSuccess(); // Llama a la función onSuccess para cerrar el modal

    } catch (error) {
      console.error("Error al registrar: ", error);
      toast({
        title: "Error en el registro",
        description: error?.code === 'permission-denied'
          ? event.requiresCode
            ? "Código incorrecto, ya estás registrado con este correo o no quedan cupos."
            : "Es posible que ya estés registrado con este correo o que no queden cupos."
          : "Hubo un problema al enviar tu registro. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (event?.requiresCode && !codeOk) {
    return <AccessCodeGate eventId={event.id} onValid={(code) => { setAccessCode(code); setCodeOk(true); }} />;
  }

  const std = (key, label, input) => (
    <FieldShell id={STD_IDS[key]} label={label} required error={errors[key]}>
      {(aria) => input(aria)}
    </FieldShell>
  );
  const text = (key, value, setter, props = {}) => std(key, props.label, (aria) => (
    <input {...aria} id={STD_IDS[key]} value={value} onChange={(e) => setField(key, setter)(e.target.value)} disabled={loading} className={inputCls} type={props.type || 'text'} placeholder={props.placeholder} autoComplete={props.autoComplete} maxLength={300} />
  ));
  const sectionCls = 'space-y-4';
  const headingCls = 'text-xs font-semibold uppercase tracking-[0.14em] text-boreal-aqua/80';

  return (
    <motion.form
      onSubmit={handleSubmit}
      noValidate
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-7 pr-1"
    >
      {honeypot}
      <section className={sectionCls} aria-labelledby="reg-sec-you">
        <h3 id="reg-sec-you" className={headingCls}>Tus datos</h3>
        {text('name', name, setName, { label: 'Nombre completo', autoComplete: 'name' })}
        {text('email', email, setEmail, { label: 'Correo electrónico', type: 'email', autoComplete: 'email' })}
        {text('whatsapp', whatsapp, setWhatsapp, { label: 'Número de WhatsApp', type: 'tel', placeholder: '+505 1234 5678', autoComplete: 'tel' })}
        {text('university', university, setUniversity, { label: 'Universidad / centro de procedencia', autoComplete: 'organization' })}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text('country', country, setCountry, { label: 'País', autoComplete: 'country-name' })}
          {text('department', department, setDepartment, { label: 'Departamento / estado', autoComplete: 'address-level1' })}
        </div>
      </section>

      <section className={sectionCls} aria-labelledby="reg-sec-event">
        <h3 id="reg-sec-event" className={headingCls}>Preguntas del evento</h3>
        <FieldShell id="reg-isMember" group label="¿Ya perteneces a la comunidad Boreal Labs?" required error={errors.isMember}>
          {() => <OptionCards name="reg-isMember" options={[{ value: 'yes', label: 'Sí' }, { value: 'no', label: 'No' }]} value={isMember} onChange={setField('isMember', setIsMember)} disabled={loading} />}
        </FieldShell>
        <FieldShell
          id="reg-tipoAsistencia"
          group
          label="Tipo de asistencia"
          required
          error={errors.tipoAsistencia}
          help={event?.mensajeConfirmacion ? 'Al confirmar verás información adicional del evento.' : undefined}
        >
          {() => <OptionCards name="reg-tipoAsistencia" options={asistenciaOptions} value={tipoAsistencia} onChange={setField('tipoAsistencia', setTipoAsistencia)} disabled={loading} />}
        </FieldShell>
        <EventCustomFields
          fields={formFields}
          values={answers}
          errors={errors}
          disabled={loading}
          onChange={(id, v) => { setAnswers((a) => ({ ...a, [id]: v })); setErrors((er) => (er[id] ? { ...er, [id]: undefined } : er)); }}
        />
      </section>

      {!IS_DEMO && (
        <div>
          <ReCAPTCHA
            sitekey={recaptchaSiteKey}
            onChange={(token) => { setRecaptchaV2Token(token); if (setRecaptchaTokenV2) setRecaptchaTokenV2(token); }}
            ref={recaptchaRef}
          />
        </div>
      )}

      {/* Barra de envío fija al fondo del modal en móvil. */}
      <div className="sticky bottom-0 -mx-1 border-t border-white/10 bg-boreal-dark/95 px-1 pb-1 pt-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button
          type="submit"
          disabled={loading}
          className="min-h-[48px] w-full rounded-xl bg-gradient-to-r from-boreal-blue to-boreal-purple text-white font-bold hover:opacity-90"
        >
          {loading ? 'Registrando…' : 'Confirmar registro'}
        </Button>
      </div>
    </motion.form>
  );
};

const STD_IDS = {
  name: 'reg-name', email: 'reg-email', whatsapp: 'reg-whatsapp', university: 'reg-university',
  country: 'reg-country', department: 'reg-department',
};

// Paso previo: verifica el código sin leerlo. firestore.rules permiten get de eventSecrets/{id}/check/{código}
// solo si coincide (el doc no existe): éxito = válido, permission-denied = inválido.
const AccessCodeGate = ({ eventId, onValid }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const locked = lockedUntil > now;

  useEffect(() => {
    if (!locked) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [locked]);

  const submit = async (e) => {
    e.preventDefault();
    const value = normalizeCode(code);
    if (!value || busy || locked) return;
    if (!db) { setError('No se pudo verificar, intenta de nuevo.'); return; }
    setBusy(true);
    setError('');
    try {
      await getDoc(doc(db, 'eventSecrets', eventId, 'check', value));
      onValid(value);
    } catch (err) {
      if (err?.code === 'permission-denied') {
        const n = fails + 1;
        setFails(n);
        // Desalienta adivinar: 2 s tras cada intento fallido, 30 s cada 5.
        const wait = n % 5 === 0 ? 30000 : 2000;
        setLockedUntil(Date.now() + wait);
        setNow(Date.now());
        setError(n % 5 === 0 ? 'Demasiados intentos. Espera 30 segundos para volver a intentar.' : 'Código incorrecto. Revisa e intenta de nuevo.');
      } else {
        console.error('[eventos] verificación de código', err);
        setError('No se pudo verificar, intenta de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  };

  const secs = Math.ceil((lockedUntil - now) / 1000);
  return (
    <motion.form onSubmit={submit} noValidate initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 py-2">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">Código de acceso</h3>
        <p className="text-sm text-gray-400">Este evento es por invitación. Ingresa el código que te compartieron los organizadores.</p>
      </div>
      <input
        id="reg-access-code"
        aria-label="Código de acceso"
        value={code}
        onChange={(e) => { setCode(e.target.value.toUpperCase()); if (error && !locked) setError(''); }}
        disabled={busy}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby="reg-access-code-status"
        className={`${inputCls} text-center text-lg uppercase tracking-[0.3em]`}
        maxLength={64}
      />
      <p id="reg-access-code-status" aria-live="polite" className="min-h-[1.25rem] text-sm text-red-300">
        {error}{locked && secs > 0 ? ` (${secs} s)` : ''}
      </p>
      <Button type="submit" disabled={busy || locked || !normalizeCode(code)} className="min-h-[48px] w-full rounded-xl bg-gradient-to-r from-boreal-blue to-boreal-purple font-bold text-white hover:opacity-90">
        {busy ? 'Verificando…' : 'Continuar'}
      </Button>
    </motion.form>
  );
};

const EventsPage = () => {
  const [filter, setFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  // --- MODIFICACIÓN 2: Estado para eventos y carga ---
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMsg, setConfirmationMsg] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  // Integradas + personalizadas (siteConfig/eventCategories); sin Firebase quedan las integradas.
  const [eventCategories, setEventCategories] = useState(BUILTIN_CATEGORIES);
  useEffect(() => { loadEventCategories(db).then(setEventCategories); }, []);
  const { toast } = useToast(); // Toast para el botón de compartir

  // Sonido de confirmación ligero (Web Audio API)
  const playConfirmTone = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      // Pequeño “chime” ascendente
      osc.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.26);
      osc.stop(ctx.currentTime + 0.28);
      setTimeout(() => ctx.close(), 400);
    } catch (e) {
      // Evitar romper en navegadores sin soporte
      console.warn('No se pudo reproducir sonido de confirmación:', e);
    }
  };

  // Reproducir sonido cuando se muestra la confirmación
  useEffect(() => {
    if (showConfirmation) {
      playConfirmTone();
    }
  }, [showConfirmation]);

  // --- MODIFICACIÓN 3: Cargar eventos desde Firestore ---
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "events"), orderBy("date", "asc")); // Ordenar por fecha
        const querySnapshot = await getDocs(q);
      const rawEvents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Resolver posibles imageUrl almacenados en distintos formatos
      const fetchedEvents = await Promise.all(rawEvents.map(async (ev) => {
        const out = { ...ev };
        // asegurar date como Date
        try {
          out.date = ev.date?.toDate ? ev.date.toDate() : ev.date || null;
        } catch (e) {
          out.date = null;
        }

        // Resolución de imagen: puede venir como `image` (string|array|obj), `imageUrl` string|array|obj
        try {
          // Prioridad: out.image (ya procesada por admin) -> imageUrl field
          if (out.image) {
            const img = out.image;
            if (typeof img === 'string') {
              out.resolvedImage = img;
            } else if (Array.isArray(img) && img.length > 0) {
              const first = img[0];
              if (first?.downloadURL) out.resolvedImage = first.downloadURL;
              else if (first?.ref) out.resolvedImage = await getDownloadURL(storageRef(storage, first.ref));
            } else if (img && typeof img === 'object') {
              if (img.downloadURL) out.resolvedImage = img.downloadURL;
              else if (img.ref) out.resolvedImage = await getDownloadURL(storageRef(storage, img.ref));
            }
          } else if (out.imageUrl) {
            const iv = out.imageUrl;
            if (typeof iv === 'string') {
              out.resolvedImage = iv;
            } else if (Array.isArray(iv) && iv.length > 0) {
              const first = iv[0];
              if (first?.downloadURL) out.resolvedImage = first.downloadURL;
              else if (first?.ref) out.resolvedImage = await getDownloadURL(storageRef(storage, first.ref));
            } else if (iv && typeof iv === 'object') {
              if (iv.downloadURL) out.resolvedImage = iv.downloadURL;
              else if (iv.ref) out.resolvedImage = await getDownloadURL(storageRef(storage, iv.ref));
            }
          }
        } catch (e) {
          console.warn('No se pudo resolver imagen para evento', ev.id, e);
          out.resolvedImage = out.resolvedImage || null;
        }

        return out;
      }));
        // El conteo vive en el propio evento (registeredCount); no se listan registrations desde el público.
        const eventsWithCounts = fetchedEvents.map((ev) => {
          const registeredCount = Number(ev.registeredCount) || 0;
          // Normalizar capacity a número
          let capacityNum = ev.capacity;
          if (typeof capacityNum === 'string') {
            const n = parseInt(capacityNum, 10);
            capacityNum = Number.isFinite(n) ? n : undefined;
          }
          return { ...ev, capacity: capacityNum, registeredCount };
        });

        setEvents(eventsWithCounts);

      } catch (error) {
        console.error("Error al cargar eventos: ", error);
        toast({ title: "Error", description: "No se pudieron cargar los eventos.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []); // Cargar solo una vez al montar

  const categories = [{ value: 'all', label: 'Todos los Eventos' }, ...eventCategories];
  const categoryDisplayNames = Object.fromEntries(eventCategories.map((c) => [c.value, c.label]));

  // --- MODIFICACIÓN 4: Filtrar eventos cargados ---
  // Normaliza y compara categorías de forma permissiva:
  // - acepta que event.category venga en inglés (key), en español (label), en plural o con diferente capitalización
  const normalize = (str) => (str || '').toString().trim().toLowerCase().replace(/s$/, '');

  const categoryKeyFromLabel = (label) => {
    if (!label) return null;
    const normLabel = normalize(label);
    for (const key of Object.keys(categoryDisplayNames)) {
      const display = normalize(categoryDisplayNames[key]);
      if (display === normLabel) return key;
    }
    // If label already looks like a key
    return normLabel;
  };

  const isSoldOut = (ev) => {
    // Permite forzar estado desde Firestore: soldOut | isFull | cupoLleno
    if (ev?.soldOut === true || ev?.isFull === true || ev?.cupoLleno === true) return true;
    const cap = typeof ev?.capacity === 'number' ? ev.capacity : undefined;
    const count = typeof ev?.registeredCount === 'number' ? ev.registeredCount : 0;
    return Number.isFinite(cap) && count >= cap;
  };

  const filteredEvents = useMemo(() => {
    // 1) Filtrar los de "visible" explícito a false
    const visibleEvents = events.filter(ev => ev.visible !== false);

    // 2) Filtrar por categoría
    const categoryEvents = filter === 'all'
      ? visibleEvents
      : visibleEvents.filter(ev => {
        const evCat = ev.category || ev.categoryName || ev.categoryLabel || '';
        const evKey = categoryKeyFromLabel(evCat);
        return normalize(evKey) === normalize(filter);
      });

    // 3) Ordenar: (futuro y con cupo) -> (pasado o lleno) -> conservando orden de fecha
    return categoryEvents.sort((a, b) => {
      const aPriority = !isEventPast(a) && !isSoldOut(a);
      const bPriority = !isEventPast(b) && !isSoldOut(b);

      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;

      // Si empatan, ya vienen medianamente ordenados de Firestore o podemos refinar:
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });
  }, [events, filter, eventCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resetear la cuenta visible cuando cambia el filtro
  useEffect(() => {
    setVisibleCount(10);
  }, [filter]);

  // Función para cerrar el modal
  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  // --- MODIFICACIÓN 5: Función para compartir ---
  const handleShare = async () => {
    const eventUrl = `https://borealabs.org/eventos`;
    const shareData = {
      title: 'Eventos Boreal Labs',
      text: `¡Mira los eventos de Boreal Labs!`,
      url: eventUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(eventUrl);
        toast({ title: "Enlace Copiado", description: `URL copiada: ${eventUrl}` });
      }
    } catch (err) {
      console.error('Error al compartir:', err);
      await navigator.clipboard.writeText(eventUrl);
      toast({ title: "Enlace Copiado", description: `URL copiada: ${eventUrl}` });
    }
  };


  return (
    <MotionConfig reducedMotion="user">
      <Helmet>
        <title>Actividades - Boreal Labs</title>
        <meta name="description" content="Descubre los próximos talleres, conferencias y eventos de networking en Boreal Labs. Únete para aprender y crecer." />
      </Helmet>
      <div className="pt-32 pb-20 bg-boreal-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl md:text-6xl font-black mb-6">
              Nuestras <span className="text-gradient">Actividades</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Únete a nosotros para tener oportunidades emocionantes de aprender, conectar y hacer crecer tu viaje emprendedor.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {categories.map((category) => (
              <Button
                key={category.value}
                onClick={() => setFilter(category.value)}
                variant={filter === category.value ? 'default' : 'outline'}
                className={filter === category.value 
                  ? 'bg-gradient-to-r from-boreal-blue to-boreal-purple text-white' 
                  : 'border-boreal-aqua text-boreal-aqua hover:bg-boreal-aqua/10 hover:text-boreal-aqua'
                }
              >
                {category.label}
              </Button>
            ))}
          </motion.div>
          
          {/* Mensaje de carga */}
          {loading && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-boreal-aqua text-xl">
               Cargando eventos...
             </motion.div>
          )}

          {/* Grid de eventos (solo si no está cargando) */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <AnimatePresence>
                {filteredEvents.slice(0, visibleCount).map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, delay: Math.min(index, 15) * 0.05 }}
                    className={`bg-white/5 border border-white/10 rounded-2xl p-8 transition-all group flex flex-col relative ${
                      isEventPast(event) || isSoldOut(event) ? 'opacity-95' : 'hover:bg-white/10'
                    }`}
                  >
                    {/* Badge se renderiza centrada sobre la imagen si existe */}
                    <div className="flex-grow">
                      {/* Imagen Opcional del Evento */}
                        {(event.resolvedImage || event.image) && (
                         <div className="mb-4 overflow-hidden rounded-lg aspect-video relative">
                           <img
                             src={event.resolvedImage || event.image}
                             alt={`Imagen de ${event.title}`}
                             className="w-full h-full object-cover"
                             width="1280"
                             height="720"
                             loading="lazy"
                             decoding="async"
                             fetchPriority="low"
                           />
                           {(isEventPast(event) || isSoldOut(event)) && (
                             <>
                               <div className="absolute inset-0 bg-black/60 pointer-events-none" />
                               <div className="absolute inset-0 flex items-center justify-center">
                                 <span
                                   className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full text-base font-extrabold tracking-wide shadow-lg ring-1 ring-white/20 ${
                                     isEventPast(event)
                                       ? 'bg-gradient-to-r from-gray-600 to-slate-700 text-white'
                                       : 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                                   }`}
                                 >
                                   {isEventPast(event) ? (
                                     <>
                                       <Clock className="w-5 h-5" /> Finalizado
                                     </>
                                   ) : (
                                     <>
                                       <Users className="w-5 h-5" /> Cupo lleno
                                     </>
                                   )}
                                 </span>
                               </div>
                             </>
                           )}
                         </div>
                      )}
                      {!(event.resolvedImage || event.image) && (isEventPast(event) || isSoldOut(event)) && (
                        <div className="relative mb-4">
                          <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10">
                            <span
                              className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full text-base font-extrabold tracking-wide shadow-lg ring-1 ring-white/20 ${
                                isEventPast(event)
                                  ? 'bg-gradient-to-r from-gray-600 to-slate-700 text-white'
                                  : 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                              }`}
                            >
                              {isEventPast(event) ? (
                                <>
                                  <Clock className="w-5 h-5" /> Finalizado
                                </>
                              ) : (
                                <>
                                  <Users className="w-5 h-5" /> Cupo lleno
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <div className="bg-gradient-to-br from-boreal-blue to-boreal-purple text-white text-xs font-bold px-3 py-1 rounded-lg uppercase">
                          {categoryDisplayNames[event.category] || event.category}
                        </div>
                        {event.capacity && (
                          <div className="flex items-center text-gray-400 text-sm">
                            <Users className="w-4 h-4 mr-1" />
                            {event.capacity}
                          </div>
                        )}
                      </div>

                      <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-gradient transition-all">
                        {event.title}
                      </h3>

                      <div className="space-y-3 mb-6">
                        {event.date && (
                          <div className="flex items-center text-gray-300">
                            <Calendar className="w-5 h-5 mr-3 text-boreal-aqua" />
                            {/* Formatear la fecha */}
                            <span>{event.date.toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        )}
                        {event.time && (
                          <div className="flex items-center text-gray-300">
                            <Clock className="w-5 h-5 mr-3 text-boreal-aqua" />
                            <span>{event.time}</span>
                          </div>
                        )}
                         <div className="flex items-center text-gray-300">
                           <MapPin className="w-5 h-5 mr-3 text-boreal-aqua" />
                           <span>{event.location}</span>
                         </div>
                      </div>

                      <p className="text-gray-400 mb-6">
                        {event.description}
                      </p>
                    </div>
                    
                    {isEventPast(event) || isSoldOut(event) ? (
                      <Button
                        disabled
                        className="w-full bg-gray-600 text-white font-bold mt-auto opacity-70 cursor-not-allowed"
                      >
                        {isEventPast(event) ? 'Evento finalizado' : 'Cupo lleno'}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setSelectedEvent(event)}
                        className="w-full bg-gradient-to-r from-boreal-blue to-boreal-purple hover:opacity-90 text-white font-bold mt-auto"
                      >
                        Ver Detalles y Registrarse
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {!loading && filteredEvents.length > visibleCount && (
            <div className="text-center mt-12">
              <Button
                onClick={() => setVisibleCount((prev) => prev + 10)}
                className="bg-transparent border border-boreal-aqua text-boreal-aqua hover:bg-boreal-aqua/10 px-8 py-2 font-bold"
              >
                Cargar más eventos
              </Button>
            </div>
          )}

          {/* Mensaje si no hay eventos en la categoría (solo si no está cargando) */}
          {!loading && filteredEvents.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <p className="text-xl text-gray-400">No se encontraron eventos en esta categoría.</p>
            </motion.div>
          )}
        </div>

        {/* --- MODIFICACIÓN 6: Modal con formulario integrado y botón compartir --- */}
        <Dialog open={!!selectedEvent} onOpenChange={handleCloseModal}>
          <DialogContent className="bg-boreal-dark border-boreal-blue/50 text-white max-w-lg w-full">
            {selectedEvent && (
              <>
                <DialogHeader className="mb-4">
                  <div className="relative mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
                      <div className="flex items-center gap-3 justify-between w-full">
                        <div className="flex items-center gap-3">
                          <DialogTitle className="text-2xl font-bold text-gradient">{selectedEvent.title}</DialogTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleShare}
                            className="text-boreal-aqua hover:text-white ml-2 z-30"
                            aria-label="Compartir evento"
                          >
                            <Share2 className="w-5 h-5" />
                          </Button>
                          <DialogClose onClick={handleCloseModal} className="text-gray-400 hover:text-white z-20">
                            <XIcon className="w-5 h-5" />
                          </DialogClose>
                        </div>
                      </div>
                    </div>
                    <DialogDescription className="text-gray-300 pr-2 mt-4">
                      <div className="space-y-3 mb-6">
                       {selectedEvent.date && (
                          <div className="flex items-center">
                            <Calendar className="w-5 h-5 mr-3 text-boreal-aqua" />
                            <span>{selectedEvent.date.toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        )}
                        {selectedEvent.time && (
                          <div className="flex items-center">
                            <Clock className="w-5 h-5 mr-3 text-boreal-aqua" />
                            <span>{selectedEvent.time}</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <MapPin className="w-5 h-5 mr-3 text-boreal-aqua" />
                          <span>{selectedEvent.location}</span>
                        </div>
                        {selectedEvent.capacity && (
                          <div className="flex items-center">
                            <Users className="w-5 h-5 mr-3 text-boreal-aqua" />
                            <span>{selectedEvent.capacity}</span>
                          </div>
                        )}
                    </div>
                    <p className="text-gray-300 mb-6">{selectedEvent.description}</p>
                  </DialogDescription>
                </div>
              </DialogHeader>
              
              <div className="my-4">
                <h4 className="text-lg font-semibold text-white mb-3">Formulario de Registro</h4>
                <EventRegistrationForm key={selectedEvent.id}
                  event={selectedEvent} 
                  onSuccess={handleCloseModal} 
                  onShowConfirmation={(msg) => { setConfirmationMsg(msg); setShowConfirmation(true); }}
                />
              </div>

              {/* (Se movió el modal de confirmación fuera de este Dialog para que no se cierre al cerrar el formulario) */}
            </>
          )}

          </DialogContent>
        </Dialog>

        {/* Modal de confirmación personalizada (Top-level, mismo estilo que el formulario) */}
        <Dialog open={showConfirmation} onOpenChange={(open) => setShowConfirmation(open)}>
          <DialogContent className="bg-boreal-dark border-boreal-blue/50 text-white max-w-lg w-full">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="relative flex justify-center pt-2 pb-3">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="relative z-10"
                >
                  <CheckCircle className="w-16 h-16 text-green-500" />
                </motion.div>
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-green-500/40"
                  style={{ width: '76px', height: '76px' }}
                  initial={{ scale: 0.8, opacity: 0.6 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              </div>
              <DialogHeader className="text-center items-center">
                <DialogTitle className="text-2xl font-bold text-gradient w-full text-center block">¡Registro Exitoso!</DialogTitle>
              </DialogHeader>
              <div className="mb-4 mt-2 text-gray-300 whitespace-pre-line text-left">{confirmationMsg.split(/(https?:\/\/[^\s]+?)(?=[.,;:!?)]*(?:\s|$))/g).map((part, i) => (safeUrl(part) && i % 2 === 1
                ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-boreal-aqua underline">{part}</a>
                : part))}</div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={async () => { await navigator.clipboard.writeText(confirmationMsg); toast({ title: 'Mensaje copiado' }); }}
                  className="flex items-center gap-2 border-boreal-aqua text-boreal-aqua"
                >
                  <Copy className="w-4 h-4" /> Copiar
                </Button>
                <Button
                  variant="default"
                  onClick={() => setShowConfirmation(false)}
                  className="bg-gradient-to-r from-boreal-blue to-boreal-purple text-white"
                >
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>

        {/* ESTA ETIQUETA FALTABA: 
          Debe cerrar el <div className="pt-32 pb-20 bg-boreal-dark"> 
        */}
        </div>
        
      </MotionConfig>
    );
  };
export default EventsPage;