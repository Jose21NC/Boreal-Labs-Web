import React, { useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Mail, Search, Clock3, BadgeDollarSign, ListChecks, CheckCircle2, Hourglass, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const toDateSafe = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const dateObj = toDateSafe(value);
  if (!dateObj) return '-';
  return dateObj.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatHoursMinutes = (hoursValue) => {
  const numeric = Number(hoursValue || 0);
  const safe = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  const totalMinutes = Math.round(safe * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}min`;
};

const getLogCreditsValue = (logItem) => {
  const explicitCredits = Number(logItem?.pendingCredits);
  const registeredHours = Number(logItem?.registeredHours);
  const formula = String(logItem?.creditsFormula || '').toLowerCase();

  if (Number.isFinite(explicitCredits)) {
    const isLegacyFormula = formula.includes('1h = 1 credito') || formula.includes('1h=1credito');
    const looksLikeHours = Number.isFinite(registeredHours) && Math.abs(explicitCredits - registeredHours) < 0.02;

    if (isLegacyFormula || looksLikeHours) {
      return Math.max(0, explicitCredits / 2);
    }

    return Math.max(0, explicitCredits);
  }

  if (Number.isFinite(registeredHours)) {
    return Math.max(0, registeredHours / 2);
  }

  return 0;
};

const VolunteerPersonalPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [volunteerProfile, setVolunteerProfile] = useState(null);
  const [logs, setLogs] = useState([]);

  const summary = useMemo(() => {
    const totalHours = logs.reduce((acc, item) => acc + (Number(item.registeredHours) || 0), 0);
    const pendingCredits = logs.reduce((acc, item) => {
      if (item.creditsProcessed) return acc;
      return acc + getLogCreditsValue(item);
    }, 0);

    const processedCreditsFromLogs = logs.reduce((acc, item) => {
      if (!item.creditsProcessed) return acc;
      const explicitAssigned = Number(item.assignedCredits);
      return acc + (Number.isFinite(explicitAssigned) ? explicitAssigned : getLogCreditsValue(item));
    }, 0);

    const creditsFromProfile = Number(volunteerProfile?.creditos);
    const totalCredits = Number.isFinite(creditsFromProfile) ? creditsFromProfile : processedCreditsFromLogs;

    return {
      totalHours: Number(totalHours.toFixed(2)),
      pendingCredits: Number(pendingCredits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
    };
  }, [logs, volunteerProfile]);

  const findVolunteerByEmail = async (normalizedEmail) => {
    const directQuery = query(collection(db, 'voluntarios2026'), where('email', '==', normalizedEmail));
    const directSnap = await getDocs(directQuery);
    if (!directSnap.empty) {
      const first = directSnap.docs[0];
      return { id: first.id, ...first.data() };
    }

    const fallbackSnap = await getDocs(collection(db, 'voluntarios2026'));
    let match = null;
    fallbackSnap.forEach((docItem) => {
      const data = docItem.data();
      if (normalizeEmail(data?.email) === normalizedEmail && !match) {
        match = { id: docItem.id, ...data };
      }
    });
    return match;
  };

  const findLogsByEmail = async (normalizedEmail) => {
    const directQuery = query(collection(db, 'volunteerAttendanceLogs'), where('email', '==', normalizedEmail));
    const directSnap = await getDocs(directQuery);
    let items = directSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));

    if (items.length === 0) {
      const fallbackSnap = await getDocs(collection(db, 'volunteerAttendanceLogs'));
      items = fallbackSnap.docs
        .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        .filter((item) => normalizeEmail(item?.email) === normalizedEmail);
    }

    return items.sort((a, b) => {
      const dateA = toDateSafe(a.createdAt || a.attendanceDate)?.getTime() || 0;
      const dateB = toDateSafe(b.createdAt || b.attendanceDate)?.getTime() || 0;
      return dateB - dateA;
    });
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    setSearched(true);
    setError('');

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setVolunteerProfile(null);
      setLogs([]);
      setError('Ingresa un correo valido para consultar tu resumen.');
      return;
    }

    setLoading(true);
    try {
      const [profile, logsData] = await Promise.all([
        findVolunteerByEmail(normalizedEmail),
        findLogsByEmail(normalizedEmail),
      ]);

      setVolunteerProfile(profile);
      setLogs(logsData);

      if (!profile && logsData.length === 0) {
        setError('No encontramos registros con ese correo. Verifica que sea el mismo correo usado en tus formularios.');
      }
    } catch (searchError) {
      console.error('Error consultando resumen de voluntario:', searchError);
      setVolunteerProfile(null);
      setLogs([]);
      setError('Ocurrio un error al consultar tu informacion. Intenta nuevamente en unos minutos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-boreal-dark text-white pt-24 pb-12 px-4 sm:px-6 overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-boreal-aqua/15 blur-3xl" />
      <div className="pointer-events-none absolute top-28 -right-28 w-96 h-96 rounded-full bg-boreal-purple/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[42rem] h-48 rounded-full bg-cyan-500/10 blur-3xl" />

      <Helmet>
        <title>Mi Resumen de Voluntariado - Boreal Labs</title>
        <meta
          name="description"
          content="Consulta personal de horas, creditos e historial de asistencias del voluntariado Boreal Labs."
        />
      </Helmet>

      <div className="relative z-10 max-w-5xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-[#121a2b] via-[#16223a] to-[#111827] border border-white/20 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/20">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-boreal-aqua font-semibold bg-boreal-aqua/10 border border-boreal-aqua/30 rounded-full px-3 py-1 mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Portal personal
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Mi Resumen de Voluntariado</h1>
            <Link to="/voluntariado" className="inline-flex">
              <Button variant="outline" className="border-white/25 text-gray-200 hover:bg-[#24304d] bg-[#131d31]">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver a voluntariado
              </Button>
            </Link>
          </div>
          <p className="text-gray-200/90 mt-2 text-sm sm:text-base max-w-3xl">
            Escribe tu correo para ver tus horas acumuladas, creditos y tu historial de asistencias.
          </p>

          <form onSubmit={handleSearch} className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu-correo@ejemplo.com"
                className="w-full bg-[#0b1222] border border-white/25 rounded-xl pl-9 pr-3 py-3 text-sm text-white outline-none focus:border-boreal-aqua focus:ring-2 focus:ring-boreal-aqua/20 transition"
              />
            </div>
            <Button type="submit" disabled={loading} className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold rounded-xl px-5">
              <Search className="w-4 h-4 mr-2" /> {loading ? 'Consultando...' : 'Consultar resumen'}
            </Button>
          </form>

          <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-300 bg-[#0f172a] border border-white/15 rounded-full px-3 py-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-boreal-aqua" />
            Consulta privada por correo
          </div>

          {error && <p className="text-sm text-red-300 mt-3 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {searched && !loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-b from-[#131d33] to-[#101a2f] border border-white/20 rounded-2xl p-5 shadow-lg shadow-black/20">
                <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                  <Clock3 className="w-4 h-4" /> Horas registradas
                </div>
                <p className="mt-3 text-3xl font-black text-white tracking-tight">{summary.totalHours.toFixed(2)} h</p>
                <p className="text-xs text-gray-300">{formatHoursMinutes(summary.totalHours)}</p>
              </div>

              <div className="bg-gradient-to-b from-[#1f2b45] to-[#16223a] border border-white/20 rounded-2xl p-5 shadow-lg shadow-black/20">
                <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                  <BadgeDollarSign className="w-4 h-4" /> Creditos acumulados
                </div>
                <p className="mt-3 text-3xl font-black text-white tracking-tight">{summary.totalCredits.toFixed(2)}</p>
                <p className="text-xs text-gray-300">1 credito equivale a 2 horas</p>
              </div>

              <div className="bg-gradient-to-b from-[#2a2336] to-[#1b1f33] border border-white/20 rounded-2xl p-5 shadow-lg shadow-black/20">
                <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                  <Hourglass className="w-4 h-4" /> Creditos pendientes
                </div>
                <p className="mt-3 text-3xl font-black text-white tracking-tight">{summary.pendingCredits.toFixed(2)}</p>
                <p className="text-xs text-gray-300">Pendiente de validacion en admin</p>
              </div>
            </div>

            <div className="bg-[#121a2b] border border-white/20 rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/20">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-boreal-aqua" /> Historial de asistencias
              </h2>

              {!volunteerProfile && (
                <p className="text-sm text-amber-200 mt-2">
                  Encontramos asistencias, pero no un perfil de voluntario en la base principal. Tus datos siguen visibles abajo.
                </p>
              )}

              {logs.length === 0 ? (
                <div className="mt-4 bg-[#1a2338] border border-white/15 rounded-xl p-6 text-center text-gray-300">
                  No hay asistencias registradas para este correo.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-white/20 bg-[#0f172a]/60">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#0b1222] text-gray-300">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Actividad</th>
                        <th className="px-4 py-3 font-semibold text-center">Horas</th>
                        <th className="px-4 py-3 font-semibold text-center">Creditos</th>
                        <th className="px-4 py-3 font-semibold text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-gray-100">
                      {logs.map((item) => {
                        const credits = getLogCreditsValue(item);
                        const activityLabel = item.activityName || item.sourceEventName || item.selectedActivity || item.eventName || 'Actividad registrada';
                        const dateLabel = formatDateTime(item.createdAt || item.attendanceDate);
                        return (
                          <tr key={item.id} className="hover:bg-[#1c2741] transition-colors">
                            <td className="px-4 py-3">{dateLabel}</td>
                            <td className="px-4 py-3">{activityLabel}</td>
                            <td className="px-4 py-3 text-center tabular-nums">{Number(item.registeredHours || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center tabular-nums">{credits.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              {item.creditsProcessed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Asignado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-amber-500/15 text-amber-200 border border-amber-500/30">
                                  <Hourglass className="w-3.5 h-3.5" /> Pendiente
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VolunteerPersonalPage;
