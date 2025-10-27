import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase'; // Asegúrate de que la configuración de Firebase esté correcta
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const AdminPanel = () => {
    const [registrations, setRegistrations] = useState([]);
    const [eventData, setEventData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState('');
    const [generating, setGenerating] = useState(false);
    const { toast } = useToast();
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newTipo, setNewTipo] = useState('participante');
    const [customEventName, setCustomEventName] = useState('');
    const [newModalidad, setNewModalidad] = useState('presencial');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();
    const [resultOpen, setResultOpen] = useState(false);
    const [resultInfo, setResultInfo] = useState({ created: 0, skipped: 0, errors: [] });

    useEffect(() => {
        const fetchRegistrations = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'registrations'));
                const data = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                setRegistrations(data);
                organizeByEvent(data);
            } catch (err) {
                console.error('Error fetching registrations', err);
                setError('No se pudieron cargar los registros.');
            } finally {
                setLoading(false);
            }
        };

        fetchRegistrations();
    }, []);

    const organizeByEvent = (data) => {
        const events = {};
        data.forEach(registration => {
            const { eventName, tipoAsistencia, userEmail, userName, statusAsistencia, id, tipo, modalidad, customEventName } = registration;
            const key = eventName || 'Sin evento';
            if (!events[key]) {
                events[key] = [];
            }
            events[key].push({
                id,
                userName,
                userEmail,
                tipo, // rol si existe
                modalidad, // modalidad solo para participantes
                tipoAsistencia, // compatibilidad con datos antiguos
                statusAsistencia,
                customEventName,
            });
        });
        setEventData(events);
        // seleccionar el primer evento por defecto si no hay uno seleccionado
        const names = Object.keys(events);
        if (!selectedEvent && names.length > 0) setSelectedEvent(names[0]);
    };

    // Helpers
    const isPresent = (value) => {
        if (typeof value === 'string') {
            return value.toLowerCase() === 'presente' || value.toLowerCase() === 'present';
        }
        return Boolean(value);
    };

    const nextStatusValue = (current) => {
        // si originalmente es string, mantener string; si es booleano, mantener booleano
        const toPresent = !isPresent(current);
        if (typeof current === 'string') {
            return toPresent ? 'Presente' : 'Ausente';
        }
        return toPresent;
    };

    const currentList = useMemo(() => {
        const list = eventData[selectedEvent] || [];
        return [...list].sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));
    }, [eventData, selectedEvent]);

    const stats = useMemo(() => {
        const list = eventData[selectedEvent] || [];
        const present = list.filter((r) => isPresent(r.statusAsistencia)).length;
        return {
            present,
            absent: list.length - present,
            total: list.length,
        };
    }, [eventData, selectedEvent]);

    const toggleAttendance = async (reg) => {
        const prev = reg.statusAsistencia;
        const updated = nextStatusValue(prev);

        // Optimistic update
        setEventData((prevMap) => {
            const copy = { ...prevMap };
            copy[selectedEvent] = copy[selectedEvent].map((r) =>
                r.id === reg.id ? { ...r, statusAsistencia: updated } : r
            );
            return copy;
        });

        try {
            await updateDoc(doc(db, 'registrations', reg.id), {
                statusAsistencia: updated,
            });
            toast({ title: 'Asistencia actualizada', description: `${reg.userEmail} → ${isPresent(updated) ? 'Presente' : 'Ausente'}` });
        } catch (e) {
            console.error('Error al actualizar asistencia', e);
            // revert on error
            setEventData((prevMap) => {
                const copy = { ...prevMap };
                copy[selectedEvent] = copy[selectedEvent].map((r) =>
                    r.id === reg.id ? { ...r, statusAsistencia: prev } : r
                );
                return copy;
            });
            toast({ title: 'No se pudo actualizar', description: 'Intenta nuevamente', variant: 'destructive' });
        }
    };

    const generateCertificatesForCurrentEvent = async () => {
        if (!selectedEvent) return;
        setGenerating(true);
        try {
            const functions = getFunctions(undefined, 'us-central1');
            const callable = httpsCallable(functions, 'generateCertificates');
            const res = await callable({ eventName: selectedEvent });
            const { created = 0, skipped = 0, errors = [] } = res.data || {};
            setResultInfo({ created, skipped, errors });
            setResultOpen(true);
        } catch (e) {
            console.error('Error generando certificados (Cloud Function)', e);
            toast({ title: 'Error generando certificados', description: e.message || 'Inténtalo nuevamente', variant: 'destructive' });
        } finally {
            setGenerating(false);
        }
    };

    const toggleSelectAll = (e) => {
        const checked = e.target.checked;
        setSelectedIds(() => {
            if (!checked) return new Set();
            return new Set((eventData[selectedEvent] || []).map(r => r.id));
        });
    };

    const markAll = () => {
        setSelectedIds(new Set((eventData[selectedEvent] || []).map(r => r.id)));
    };

    const clearAll = () => {
        setSelectedIds(new Set());
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const onConfirmDelete = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) { setConfirmDeleteOpen(false); return; }
        try {
            // Optimistic UI
            setEventData(prev => {
                const copy = { ...prev };
                copy[selectedEvent] = (copy[selectedEvent] || []).filter(r => !selectedIds.has(r.id));
                return copy;
            });
            // Delete in Firestore
            await Promise.all(ids.map(id => deleteDoc(doc(db, 'registrations', id))));
            toast({ title: 'Registros eliminados', description: `${ids.length} registro(s) eliminados` });
        } catch (e) {
            console.error('Error eliminando registros', e);
            toast({ title: 'No se pudieron eliminar', description: e?.message || 'Intenta nuevamente', variant: 'destructive' });
        } finally {
            setSelectedIds(new Set());
            setConfirmDeleteOpen(false);
        }
    };

    const onCreateRegistration = async (e) => {
        e?.preventDefault?.();
        if (!selectedEvent) {
            toast({ title: 'Selecciona un evento', variant: 'destructive' });
            return;
        }
        if (!newName || !newEmail) {
            toast({ title: 'Nombre y Email son obligatorios', variant: 'destructive' });
            return;
        }
        const tipoLower = (newTipo || '').toLowerCase();
        const tipo = tipoLower === 'ponente' ? 'ponente' : (tipoLower === 'staff' ? 'staff' : 'participante');
        const payload = {
            eventName: selectedEvent,
            userName: newName,
            userEmail: newEmail,
            tipo, // rol
            tipoAsistencia: tipo, // compatibilidad con datos antiguos
            statusAsistencia: 'Presente',
        };
        if (tipo === 'participante') {
            payload.modalidad = newModalidad || 'presencial';
        }
        if (tipo === 'ponente' && customEventName) {
            payload.customEventName = customEventName;
        }
        try {
            const ref = await addDoc(collection(db, 'registrations'), payload);
            // Actualizar UI local
            setEventData((prev) => {
                const copy = { ...prev };
                const arr = copy[selectedEvent] ? [...copy[selectedEvent]] : [];
                arr.push({
                    id: ref.id,
                    userName: newName,
                    userEmail: newEmail,
                    tipo,
                    tipoAsistencia: tipo,
                    statusAsistencia: 'Presente',
                    ...(tipo === 'ponente' && customEventName ? { customEventName } : {}),
                    ...(tipo === 'participante' ? { modalidad: payload.modalidad } : {}),
                });
                copy[selectedEvent] = arr;
                return copy;
            });
            // Reset form
            setNewName(''); setNewEmail(''); setNewTipo('participante'); setCustomEventName(''); setNewModalidad('presencial'); setCreateOpen(false);
            toast({ title: 'Registro agregado', description: `${newName} (${newTipo})` });
        } catch (err) {
            console.error('Error creando registro', err);
            toast({ title: 'No se pudo crear el registro', description: err?.message || 'Intenta de nuevo', variant: 'destructive' });
        }
    };

    const handleLogout = async () => {
        try {
            const auth = getAuth();
            await signOut(auth);
            setMenuOpen(false);
            toast({ title: 'Sesión cerrada' });
            navigate('/');
        } catch (e) {
            console.error('Error al cerrar sesión', e);
            toast({ title: 'No se pudo cerrar sesión', description: e?.message || 'Intenta nuevamente', variant: 'destructive' });
        }
    };

    return (
    <div className="max-w-6xl mx-auto pl-4 pr-6 sm:px-6 py-8 text-white pt-24 sm:pt-28 overflow-x-hidden">
            <h1 className="text-3xl font-bold mb-6 tracking-tight text-gradient">Control de asistencia</h1>

            {loading && <p>Cargando registros…</p>}
            {error && <p className="text-red-400">{error}</p>}

            {!loading && !error && (
                <>
                    <div className="mb-6 grid gap-4 sm:grid-cols-2 items-start">
                        <div>
                            <label htmlFor="eventSelect" className="block text-sm opacity-80 mb-1">Evento</label>
                            <select
                                id="eventSelect"
                                className="w-full bg-boreal-dark/60 border border-white/10 rounded px-3 py-2"
                                value={selectedEvent}
                                onChange={(e) => setSelectedEvent(e.target.value)}
                            >
                                {Object.keys(eventData).sort().map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="self-end pt-6 flex flex-wrap gap-2 sm:justify-end relative">
                            {/* Acciones visibles por defecto */}
                            <motion.button
                                onClick={() => setCreateOpen(true)}
                                whileTap={{ scale: 0.97 }}
                                whileHover={{ scale: 1.02 }}
                                className="rounded-md px-4 py-2 font-medium bg-boreal-purple/80 hover:bg-boreal-purple text-white transition-colors border border-white/10"
                            >
                                Agregar registro
                            </motion.button>
                            <motion.button
                                onClick={generateCertificatesForCurrentEvent}
                                disabled={generating || stats.present === 0}
                                whileTap={!generating ? { scale: 0.97 } : undefined}
                                whileHover={!generating ? { scale: 1.02 } : undefined}
                                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-medium transition-colors ${generating || stats.present === 0 ? 'bg-white/10 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-black'}`}
                            >
                                {generating && (
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                )}
                                {generating ? 'Generando…' : 'Generar certificados'}
                            </motion.button>
                            {/* Menú hamburguesa */}
                            <div className="ml-auto">
                                <motion.button
                                    onClick={() => setMenuOpen((v) => !v)}
                                    aria-haspopup="menu"
                                    aria-expanded={menuOpen}
                                    whileTap={{ scale: 0.95 }}
                                    whileHover={{ scale: 1.05 }}
                                    className="h-10 w-10 inline-flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 border border-white/10"
                                    title="Más opciones"
                                >
                                    <span className="sr-only">Abrir menú</span>
                                    <span className="text-xl leading-none">≡</span>
                                </motion.button>
                                {menuOpen && (
                                    <div className="absolute right-0 mt-2 w-64 rounded-md border border-white/10 bg-boreal-dark/90 shadow-lg backdrop-blur p-2 z-20">
                                        <button
                                            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
                                            onClick={() => { setSelectionMode((s) => { const next = !s; if (!next) setSelectedIds(new Set()); return next; }); setMenuOpen(false); }}
                                        >
                                            {selectionMode ? 'Salir de selección' : 'Selección'}
                                        </button>
                                        {selectionMode && (
                                            <>
                                                <button
                                                    className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
                                                    onClick={() => { markAll(); setMenuOpen(false); }}
                                                >
                                                    Marcar todos
                                                </button>
                                                <button
                                                    className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
                                                    onClick={() => { clearAll(); setMenuOpen(false); }}
                                                >
                                                    Desmarcar todos
                                                </button>
                                                <button
                                                    disabled={selectedIds.size === 0}
                                                    className={`w-full text-left px-3 py-2 rounded ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500/10 text-red-300'}`}
                                                    onClick={() => { if (selectedIds.size > 0) setConfirmDeleteOpen(true); setMenuOpen(false); }}
                                                >
                                                    Eliminar seleccionados
                                                </button>
                                            </>
                                        )}
                                        <div className="my-1 h-px bg-white/10" />
                                        <a
                                            href="/admin/layout"
                                            className="hidden sm:block w-full text-left px-3 py-2 rounded hover:bg-blue-500/10 text-blue-300"
                                        >
                                            Ir a editor de layout
                                        </a>
                                        <button
                                            className="w-full text-left px-3 py-2 rounded hover:bg-red-500/10 text-red-300"
                                            onClick={handleLogout}
                                        >
                                            Cerrar sesión
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contadores abajo, ocupando el ancho completo */}
                        <div className="grid grid-cols-3 gap-3 w-full sm:col-span-2">
                            <div className="rounded-lg bg-white/5 px-3 py-3 text-center min-w-0">
                                <div className="text-xs opacity-70">Presentes</div>
                                <div className="text-lg md:text-xl font-semibold truncate">{stats.present}</div>
                            </div>
                            <div className="rounded-lg bg-white/5 px-3 py-3 text-center min-w-0">
                                <div className="text-xs opacity-70">Ausentes</div>
                                <div className="text-lg md:text-xl font-semibold truncate">{stats.absent}</div>
                            </div>
                            <div className="rounded-lg bg-white/5 px-3 py-3 text-center min-w-0">
                                <div className="text-xs opacity-70">Total</div>
                                <div className="text-lg md:text-xl font-semibold truncate">{stats.total}</div>
                            </div>
                        </div>
                    </div>

                    {stats.total === 0 ? (
                        <p>No hay registros para este evento.</p>
                    ) : (
                        <>
                        {/* Vista móvil: tarjetas */}
                        <div className="sm:hidden space-y-3">
                            {currentList.map((reg, idx) => {
                                const present = isPresent(reg.statusAsistencia);
                                const tipoCell = (reg.tipo || reg.tipoAsistencia || '').toLowerCase();
                                const isPonente = tipoCell === 'ponente';
                                const isStaff = tipoCell === 'staff';
                                return (
                                    <motion.div
                                        key={reg.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        className={`rounded-lg border border-white/10 px-4 py-3 ${isPonente ? 'bg-boreal-purple/10' : isStaff ? 'bg-boreal-aqua/10' : 'bg-white/5'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-[11px] opacity-60">#{idx + 1}</div>
                                                <div className="font-semibold truncate">{reg.userName || '-'}</div>
                                                <div className="text-xs break-all opacity-80">{reg.userEmail}</div>
                                            </div>
                                            {selectionMode && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(reg.id)}
                                                    onChange={() => toggleSelectOne(reg.id)}
                                                    aria-label={`Seleccionar ${reg.userEmail}`}
                                                    className="mt-1"
                                                />
                                            )}
                                        </div>
                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <div>
                                                {isPonente ? (
                                                    <span className="inline-flex items-center text-[10px] uppercase tracking-wide rounded-full bg-boreal-purple/30 border border-boreal-purple/40 px-2 py-0.5">Ponente</span>
                                                ) : isStaff ? (
                                                    <span className="inline-flex items-center text-[10px] uppercase tracking-wide rounded-full bg-boreal-aqua/30 border border-boreal-aqua/40 px-2 py-0.5 text-black">Staff</span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[10px] uppercase tracking-wide rounded-full bg-white/10 border border-white/20 px-2 py-0.5">{(reg.modalidad || 'presencial')}</span>
                                                )}
                                            </div>
                                            <div className="shrink-0">
                                                <motion.button
                                                    type="button"
                                                    onClick={() => toggleAttendance(reg)}
                                                    whileTap={{ scale: 0.95 }}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${present ? 'bg-green-500/80' : 'bg-white/20'}`}
                                                    aria-pressed={present}
                                                    aria-label={`Marcar ${present ? 'ausente' : 'presente'}`}
                                                >
                                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${present ? 'translate-x-5' : 'translate-x-1'}`} />
                                                </motion.button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Vista tablet/desktop: tabla */}
                        <AnimatePresence mode="wait">
                        <motion.div
                            key={selectedEvent}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="hidden sm:block overflow-x-auto rounded-lg border border-white/10"
                        >
                            <table className="min-w-full text-sm">
                                <thead className="bg-white/5">
                                    <tr>
                                        {selectionMode && (
                                            <th className="px-4 py-3 text-left font-semibold">
                                                <input type="checkbox" onChange={toggleSelectAll} checked={currentList.length > 0 && selectedIds.size === currentList.length} aria-label="Seleccionar todos" />
                                            </th>
                                        )}
                                        <th className="px-4 py-3 text-left font-semibold">#</th>
                                        <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                                        <th className="px-4 py-3 text-left font-semibold">Email</th>
                                        <th className="px-4 py-3 text-left font-semibold">Modalidad / Tipo</th>
                                        <th className="px-4 py-3 text-left font-semibold">Asistencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentList.map((reg, idx) => {
                                        const present = isPresent(reg.statusAsistencia);
                                        const tipoCell = (reg.tipo || reg.tipoAsistencia || '').toLowerCase();
                                        const isPonente = tipoCell === 'ponente';
                                        const isStaff = tipoCell === 'staff';
                                        return (
                                            <tr key={reg.id} className={`border-t border-white/10 ${isPonente ? 'bg-boreal-purple/10' : isStaff ? 'bg-boreal-aqua/10' : ''}`}>
                                                {selectionMode && (
                                                    <td className="px-4 py-2">
                                                        <input type="checkbox" checked={selectedIds.has(reg.id)} onChange={() => toggleSelectOne(reg.id)} aria-label={`Seleccionar ${reg.userEmail}`} />
                                                    </td>
                                                )}
                                                <td className="px-4 py-2 opacity-70">{idx + 1}</td>
                                                <td className="px-4 py-2">{reg.userName || '-'}</td>
                                                <td className="px-4 py-2 break-all">{reg.userEmail}</td>
                                                <td className="px-4 py-2">
                                                    {isPonente ? (
                                                        <span className="inline-flex items-center text-xs uppercase tracking-wide rounded-full bg-boreal-purple/30 border border-boreal-purple/40 px-2 py-0.5">Ponente</span>
                                                    ) : isStaff ? (
                                                        <span className="inline-flex items-center text-xs uppercase tracking-wide rounded-full bg-boreal-aqua/30 border border-boreal-aqua/40 px-2 py-0.5 text-black">Staff</span>
                                                    ) : (
                                                        <span className="inline-flex items-center text-xs uppercase tracking-wide rounded-full bg-white/10 border border-white/20 px-2 py-0.5">{(reg.modalidad || 'presencial')}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <motion.button
                                                        type="button"
                                                        onClick={() => toggleAttendance(reg)}
                                                        whileTap={{ scale: 0.95 }}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${present ? 'bg-green-500/80' : 'bg-white/20'}`}
                                                        aria-pressed={present}
                                                        aria-label={`Marcar ${present ? 'ausente' : 'presente'}`}
                                                    >
                                                        <span
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${present ? 'translate-x-5' : 'translate-x-1'}`}
                                                        />
                                                    </motion.button>
                                                    <span className="ml-2 text-xs opacity-80">{present ? 'Presente' : 'Ausente'}</span>
                                                </td>                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </motion.div>
                        </AnimatePresence>
                        </>
                    )}
                </>
            )}

            {/* Dialogo para crear registro */}
            <Dialog open={createOpen} onOpenChange={() => setCreateOpen(false)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Agregar registro</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={onCreateRegistration} className="space-y-4">
                        <div>
                            <Label className="block text-sm opacity-80 mb-1">Evento</Label>
                            <Input value={selectedEvent} readOnly className="bg-white/5 border-white/10" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="block text-sm opacity-80 mb-1">Nombre</Label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del participante" />
                            </div>
                            <div>
                                <Label className="block text-sm opacity-80 mb-1">Email</Label>
                                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="correo@dominio.com" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="block text-sm opacity-80 mb-1">Tipo</Label>
                                <select className="w-full bg-boreal-dark/60 border border-white/10 rounded px-3 py-2" value={newTipo} onChange={(e) => setNewTipo(e.target.value)}>
                                    <option value="participante">Participante</option>
                                    <option value="ponente">Ponente</option>
                                    <option value="staff">Staff</option>
                                </select>
                            </div>
                            {newTipo === 'participante' && (
                                <div>
                                    <Label className="block text-sm opacity-80 mb-1">Modalidad</Label>
                                    <select className="w-full bg-boreal-dark/60 border border-white/10 rounded px-3 py-2" value={newModalidad} onChange={(e) => setNewModalidad(e.target.value)}>
                                        <option value="presencial">Presencial</option>
                                        <option value="virtual">Virtual</option>
                                    </select>
                                </div>
                            )}
                            {newTipo === 'ponente' && (
                                <div>
                                    <Label className="block text-sm opacity-80 mb-1">Nombre de evento (ponente)</Label>
                                    <Input value={customEventName} onChange={(e) => setCustomEventName(e.target.value)} placeholder="Ej. Ponente invitado en …" />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <DialogClose onClick={() => setCreateOpen(false)}>Cancelar</DialogClose>
                            <button type="submit" className="rounded-md px-4 py-2 font-medium bg-emerald-500 hover:bg-emerald-400 text-black">Guardar</button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirmación de eliminación */}
            <Dialog open={confirmDeleteOpen} onOpenChange={() => setConfirmDeleteOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Eliminar registros seleccionados</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-neutral-300">Esta acción no se puede deshacer. Se eliminarán {selectedIds.size} registro(s).</p>
                    <DialogFooter>
                        <DialogClose onClick={() => setConfirmDeleteOpen(false)}>Cancelar</DialogClose>
                        <button onClick={onConfirmDelete} className="rounded-md px-4 py-2 font-medium bg-red-500 hover:bg-red-600 text-white">Eliminar</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Resultado de generación de certificados */}
            <Dialog open={resultOpen} onOpenChange={() => setResultOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Resultado de generación</DialogTitle>
                    </DialogHeader>
                    {(() => {
                        const { created, skipped, errors } = resultInfo;
                        const hasErrors = (errors || []).length > 0;
                        const allOmitted = !hasErrors && created === 0 && skipped > 0;
                        const successAll = !hasErrors && created > 0 && skipped === 0;
                        const mixed = !hasErrors && created > 0 && skipped > 0;
                        return (
                            <div className="flex items-start gap-3">
                                <div className="mt-1">
                                    {hasErrors ? (
                                        <XCircle className="text-red-400" size={28} />
                                    ) : allOmitted ? (
                                        <AlertTriangle className="text-yellow-300" size={28} />
                                    ) : (
                                        <CheckCircle className="text-emerald-400" size={28} />
                                    )}
                                </div>
                                <div className="text-sm">
                                    <div className="opacity-80">Creados: <strong>{created}</strong> • Omitidos: <strong>{skipped}</strong> • Errores: <strong>{(errors || []).length}</strong></div>
                                    {successAll && <div className="text-emerald-400 mt-1">Todos los certificados se generaron correctamente.</div>}
                                    {allOmitted && <div className="text-yellow-300 mt-1">Todos los certificados fueron omitidos.</div>}
                                    {mixed && <div className="text-emerald-300 mt-1">Generación parcial completada.</div>}
                                    {hasErrors && <div className="text-red-300 mt-1">Hubo errores durante la generación.</div>}
                                </div>
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <button onClick={() => setResultOpen(false)} className="rounded-md px-4 py-2 font-medium bg-white/10 hover:bg-white/20">Cerrar</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminPanel;

