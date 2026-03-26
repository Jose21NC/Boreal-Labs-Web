import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CheckCircle2, Clock3, UploadCloud } from 'lucide-react';
import { db, storage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const BASE_ACTIVITIES = [
  'Hospital Militar',
  'Asilo',
  'Jornada Ambiental',
  'Apoyo a la Niñez',
  'Refugio Animal',
];

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
        const q = query(collection(db, 'events'), where('visible', '!=', false));
        const snap = await getDocs(q);
        const volunteerTitles = snap.docs
          .map((d) => d.data() || {})
          .filter((item) => {
            const category = Array.isArray(item.category) ? item.category.join(' ') : String(item.category || '');
            const categoryName = String(item.categoryName || '');
            const title = String(item.title || '');
            const haystack = `${category} ${categoryName} ${title}`.toLowerCase();
            return haystack.includes('volunt');
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
    return Array.from(new Set([...BASE_ACTIVITIES, ...events]));
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
        creditsRule: '1 credito por cada 2 horas',
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold">Registro de Asistencia</h1>
            <p className="text-sm sm:text-base text-white/70 mt-2">
              Registra tu participación por actividad. El sistema calcula créditos automáticamente: 1 crédito por cada 2 horas.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full-name">Nombre completo</Label>
                <Input
                  id="full-name"
                  value={form.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Ej. Ana López"
                  required
                />
              </div>
              <div>
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

            <div>
              <Label htmlFor="activity">Actividad</Label>
              <select
                id="activity"
                value={form.activity}
                onChange={(e) => updateField('activity', e.target.value)}
                className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
                required
              >
                <option value="">Selecciona una actividad</option>
                {activityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="__other__">Otra actividad...</option>
              </select>
              {loadingEvents && <p className="text-xs text-white/60 mt-2">Cargando actividades de voluntariado...</p>}
            </div>

            {form.activity === '__other__' && (
              <div>
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

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="attendance-date">Fecha</Label>
                <Input
                  id="attendance-date"
                  type="date"
                  value={form.attendanceDate}
                  onChange={(e) => updateField('attendanceDate', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="start-time" className="inline-flex items-center gap-2"><Clock3 className="w-4 h-4" /> Hora de llegada</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  required
                />
              </div>
              <div>
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

            <div>
              <Label htmlFor="attendance-proof-file" className="inline-flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> Imagen de prueba de asistencia
              </Label>
              <Input
                id="attendance-proof-file"
                type="file"
                accept="image/*"
                onChange={(e) => updateField('proofFile', e.target.files?.[0] || null)}
                required
              />
              <p className="text-xs text-white/60 mt-2">
                Sube una foto clara de respaldo (actividad, gafete, evidencia en sitio, etc.).
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Regla automática: 1 crédito por cada 2 horas completas.
            </div>

            <div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold"
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
