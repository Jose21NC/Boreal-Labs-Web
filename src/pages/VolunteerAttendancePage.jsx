import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, CalendarClock, CheckCircle2, ClipboardCheck, Clock3, Sparkles, UploadCloud } from 'lucide-react';
import { db, storage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const HOSPITAL_ACTIVITY = 'Hospital Militar';

const parseDateLike = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const resolveEventEndDate = (item) => {
  return (
    parseDateLike(item.endDate)
    || parseDateLike(item.endAt)
    || parseDateLike(item.fechaFin)
    || parseDateLike(item.fechaFinalizacion)
    || parseDateLike(item.date)
    || null
  );
};

const isVolunteerCategory = (item) => {
  const category = Array.isArray(item.category)
    ? item.category.map((v) => String(v || '')).join(' ')
    : String(item.category || '');
  const categoryName = String(item.categoryName || '');
  const title = String(item.title || '');
  const haystack = `${category} ${categoryName} ${title}`.toLowerCase();
  return haystack.includes('volunt');
};

function VolunteerAttendancePage() {
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    activity: '',
    customActivity: '',
    attendanceDate: '',
    startTime: '',
    endTime: '',
    proofFile: null,
  });

  useEffect(() => {
    const loadVolunteerEvents = async () => {
      try {
        const snap = await getDocs(collection(db, 'events'));
        const now = new Date();
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setHours(0, 0, 0, 0);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const volunteerTitles = snap.docs
          .map((d) => d.data() || {})
          .filter((item) => {
            if (item.visible === false) return false;
            if (!isVolunteerCategory(item)) return false;

            const endDate = resolveEventEndDate(item);
            if (!endDate) return false;
            return endDate >= twoDaysAgo;
          })
          .map((item) => String(item.title || '').trim())
          .filter(Boolean);

        setEvents(Array.from(new Set(volunteerTitles)).sort((a, b) => a.localeCompare(b)));
      } catch (error) {
        console.error('No se pudieron cargar eventos de voluntariado', error);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadVolunteerEvents();
  }, []);

  const activityOptions = useMemo(() => {
    return Array.from(new Set([HOSPITAL_ACTIVITY, ...events]));
  }, [events]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const parseDateTime = (dateValue, timeValue) => {
    return new Date(`${dateValue}T${timeValue}:00`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const email = String(form.email || '').trim().toLowerCase();
    const selectedActivity = form.activity === '__other__'
      ? String(form.customActivity || '').trim()
      : String(form.activity || '').trim();

    if (!form.fullName || !email || !selectedActivity || !form.attendanceDate || !form.startTime || !form.endTime || !form.proofFile) {
      toast({
        title: 'Faltan campos',
        description: 'Completa todos los campos e incluye una imagen de prueba.',
        variant: 'destructive',
      });
      return;
    }

    const start = parseDateTime(form.attendanceDate, form.startTime);
    const end = parseDateTime(form.attendanceDate, form.endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      toast({
        title: 'Horario inválido',
        description: 'La hora de salida debe ser mayor que la hora de llegada.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const safeName = form.proofFile.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
      const filePath = `attendance-proofs/${Date.now()}-${safeName}`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, form.proofFile);
      const proofImageUrl = await getDownloadURL(fileRef);

      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));

      await addDoc(collection(db, 'volunteerAttendanceLogs'), {
        fullName: String(form.fullName).trim(),
        email,
        activityName: selectedActivity,
        attendanceDate: form.attendanceDate,
        startTime: form.startTime,
        endTime: form.endTime,
        startAtIso: start.toISOString(),
        endAtIso: end.toISOString(),
        proofImageUrl,
        proofImagePath: filePath,
        registeredHours: Number(hours.toFixed(2)),
        creditsProcessed: false,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Asistencia registrada',
        description: 'Tu asistencia fue enviada. Los créditos se asignarán automáticamente.',
      });

      setForm({
        fullName: '',
        email: '',
        activity: '',
        customActivity: '',
        attendanceDate: '',
        startTime: '',
        endTime: '',
        proofFile: null,
      });
      const fileInput = document.getElementById('attendance-proof-file');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error registrando asistencia', error);
      toast({
        title: 'No se pudo registrar',
        description: error?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-boreal-dark text-white pt-24 pb-16">
      <Helmet>
        <title>Registro de Asistencia | Voluntariado Boreal</title>
        <meta
          name="description"
          content="Registra tu asistencia de voluntariado con hora de llegada/salida y evidencia fotográfica."
        />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#0f172acc] p-6 sm:p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-boreal-blue/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-10 h-72 w-72 rounded-full bg-boreal-aqua/20 blur-3xl" />

          <div className="relative mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-boreal-aqua/40 bg-boreal-aqua/10 px-3 py-1 text-xs font-semibold text-boreal-aqua">
              <Sparkles className="h-3.5 w-3.5" />
              Registro rápido de asistencia
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">Registrar participación voluntaria</h1>
            <p className="text-sm sm:text-base text-white/75 mt-2 max-w-2xl">
              Completa tus datos, selecciona la actividad y adjunta la evidencia. Los créditos y minutos pendientes se procesan automáticamente.
            </p>
          </div>

          <div className="relative mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm">
              <p className="font-semibold inline-flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-boreal-aqua" /> Paso 1</p>
              <p className="text-white/70 mt-1">Datos del voluntario</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm">
              <p className="font-semibold inline-flex items-center gap-2"><CalendarClock className="h-4 w-4 text-boreal-aqua" /> Paso 2</p>
              <p className="text-white/70 mt-1">Actividad y horario</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm">
              <p className="font-semibold inline-flex items-center gap-2"><Camera className="h-4 w-4 text-boreal-aqua" /> Paso 3</p>
              <p className="text-white/70 mt-1">Evidencia fotográfica</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative space-y-5">
            <div className="grid sm:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-1">
                <Label htmlFor="full-name">Nombre completo</Label>
                <Input
                  id="full-name"
                  value={form.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Ej. Ana López"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="tu-correo@dominio.com"
                  required
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
              <Label htmlFor="activity">Actividad</Label>
              <select
                id="activity"
                value={form.activity}
                onChange={(e) => updateField('activity', e.target.value)}
                className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-boreal-aqua"
                required
              >
                <option value="">Selecciona una actividad</option>
                {activityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="__other__">Otra actividad...</option>
              </select>
              {loadingEvents && <p className="text-xs text-white/60">Cargando actividades vigentes...</p>}
            </div>

            {form.activity === '__other__' && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <Label htmlFor="custom-activity">Especifica la actividad</Label>
                <Input
                  id="custom-activity"
                  value={form.customActivity}
                  onChange={(e) => updateField('customActivity', e.target.value)}
                  placeholder="Ej. Hospital Militar"
                  required
                />
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-1">
                <Label htmlFor="attendance-date">Fecha</Label>
                <Input
                  id="attendance-date"
                  type="date"
                  value={form.attendanceDate}
                  onChange={(e) => updateField('attendanceDate', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="start-time" className="inline-flex items-center gap-2"><Clock3 className="w-4 h-4" /> Hora de llegada</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-time" className="inline-flex items-center gap-2"><Clock3 className="w-4 h-4" /> Hora de salida</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField('endTime', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <Label htmlFor="attendance-proof-file" className="inline-flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> Imagen de prueba de asistencia
              </Label>
              <Input
                id="attendance-proof-file"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => updateField('proofFile', e.target.files?.[0] || null)}
                required
              />
              <p className="text-xs text-white/60 mt-2 inline-flex items-center gap-2">
                <Camera className="w-3.5 h-3.5" />
                Puedes tomar la foto directamente desde tu celular o adjuntarla desde galería.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              El sistema procesa y acumula automáticamente tus minutos para el cálculo de créditos.
            </div>

            <div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto bg-gradient-to-r from-boreal-aqua to-boreal-blue hover:from-emerald-400 hover:to-blue-500 text-black font-semibold"
              >
                {submitting ? 'Registrando...' : 'Registrar asistencia'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default VolunteerAttendancePage;
