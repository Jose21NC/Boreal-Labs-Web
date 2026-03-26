import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db, storage } from '../firebase'; // Asegúrate de que la configuración de Firebase esté correcta
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc, setDoc, getDoc, writeBatch, serverTimestamp, query, where, increment } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signOut } from 'firebase/auth';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Plus, Trash2, Heart, Award, School as University, Zap, Building, Mic, Instagram, Star, Users } from 'lucide-react';
import { defaultHomeConfig, defaultLinks } from '@/lib/configService';

const AVAILABLE_ICONS = [
    { name: 'Heart', component: Heart, label: 'Corazón' },
    { name: 'Award', component: Award, label: 'Premio' },
    { name: 'University', component: University, label: 'Educación' },
    { name: 'Zap', component: Zap, label: 'Energía' },
    { name: 'Building', component: Building, label: 'Institución' },
    { name: 'Mic', component: Mic, label: 'Charlas' },
    { name: 'Instagram', component: Instagram, label: 'Redes' },
    { name: 'Star', component: Star, label: 'Estrella' },
    { name: 'Users', component: Users, label: 'Comunidad' },
];

const TEMPLATE_SETS = [
    'BASE UAM - DIEM',
];
const TEMPLATE_SET_STORAGE_KEY = 'admin:templateSets';

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
    const [resultInfo, setResultInfo] = useState({ created: 0, skipped: 0, errors: [], pointsApplied: 0, pointsErrors: [] });
    const [merging, setMerging] = useState(false);
    const [templateSet, setTemplateSet] = useState(TEMPLATE_SETS[0] || '');
    const [templateSets, setTemplateSets] = useState(TEMPLATE_SETS);
    const [templateSetDraft, setTemplateSetDraft] = useState('');
    const [showAddTemplate, setShowAddTemplate] = useState(false);
    const [addPointsEnabled, setAddPointsEnabled] = useState(false);
    const [pointsToAdd, setPointsToAdd] = useState('');
    const [addingPoints, setAddingPoints] = useState(false);
    const [certificatesGenerated, setCertificatesGenerated] = useState(false);
    const [pointsModalOpen, setPointsModalOpen] = useState(false);
    const [manualEvents, setManualEvents] = useState([]);
    const [newEventName, setNewEventName] = useState('');
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importing, setImporting] = useState(false);
    const [importMode, setImportMode] = useState('individual');
    const [showAddEvent, setShowAddEvent] = useState(false);
    const [editEventOpen, setEditEventOpen] = useState(false);
    const [editEventName, setEditEventName] = useState('');
    const [editEventDate, setEditEventDate] = useState('');
    const [savingEvent, setSavingEvent] = useState(false);
    const [deleteEventOpen, setDeleteEventOpen] = useState(false);
    const [deletingEvent, setDeletingEvent] = useState(false);
    const [participantOpen, setParticipantOpen] = useState(false);
    const [activeParticipant, setActiveParticipant] = useState(null);
    const [editParticipantOpen, setEditParticipantOpen] = useState(false);
    const [editParticipantName, setEditParticipantName] = useState('');
    const [editParticipantEmail, setEditParticipantEmail] = useState('');
    const [editParticipantCustomEventName, setEditParticipantCustomEventName] = useState('');
    const [templateByEvent, setTemplateByEvent] = useState({});
    const [uploadingTemplate, setUploadingTemplate] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const templateFileRef = useRef(null);

    // --- ESTADO PARA HOME CONFIG ---
    const [homeConfigOpen, setHomeConfigOpen] = useState(false);
    const [homeConfigData, setHomeConfigData] = useState({ impacts: [], partners: [] });
    const [linksData, setLinksData] = useState(defaultLinks);
    const [activeHomeTab, setActiveHomeTab] = useState('impacts');
    const [savingHomeConfig, setSavingHomeConfig] = useState(false);
    const [uploadingPartnerImage, setUploadingPartnerImage] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [regSnap, manualSnap, templateSnap] = await Promise.all([
                    getDocs(collection(db, 'registrations')),
                    getDocs(collection(db, 'adminEvents')),
                    getDocs(collection(db, 'eventTemplates')),
                ]);

                const data = regSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                const manual = manualSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                const templates = templateSnap.docs.reduce((acc, docSnap) => {
                    const payload = docSnap.data() || {};
                    if (payload.eventName && payload.templateSet) {
                        acc[payload.eventName] = payload.templateSet;
                    }
                    return acc;
                }, {});

                setRegistrations(data);
                setManualEvents(manual);
                setTemplateByEvent(templates);
                organizeByEvent(data, manual);
            } catch (err) {
                console.error('Error fetching registrations', err);
                setError('No se pudieron cargar los registros.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        let localSets = [];
        try {
            const raw = localStorage.getItem(TEMPLATE_SET_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) localSets = parsed.filter(Boolean);
        } catch {}

        const merged = Array.from(new Set([...TEMPLATE_SETS, ...localSets].filter(Boolean)));
        setTemplateSets(merged);
        if (!templateSet && merged[0]) setTemplateSet(merged[0]);
    }, []);

    useEffect(() => {
        if (!selectedEvent) return;
        const mapped = templateByEvent[selectedEvent];
        if (mapped) {
            ensureTemplateSet(mapped);
            setTemplateSet(mapped);
            return;
        }
        if (templateSets[0]) setTemplateSet(templateSets[0]);
    }, [selectedEvent, templateByEvent, templateSets]);

    useEffect(() => {
        setCertificatesGenerated(false);
    }, [selectedEvent]);

    const normalizeTemplateSet = (value) => {
        if (!value) return '';
        const cleaned = String(value).trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
        if (!cleaned || cleaned.includes('..')) return '';
        return cleaned;
    };

    const slugify = (value) => {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
    };

    const ensureTemplateSet = (value) => {
        const cleaned = normalizeTemplateSet(value);
        if (!cleaned) return;
        setTemplateSets((prev) => {
            if (prev.includes(cleaned)) return prev;
            const next = [...prev, cleaned];
            try { localStorage.setItem(TEMPLATE_SET_STORAGE_KEY, JSON.stringify(next)); } catch {}
            return next;
        });
    };

    const saveTemplateForEvent = async (eventName, nextTemplateSet) => {
        if (!eventName || !nextTemplateSet) return;
        setTemplateByEvent((prev) => ({ ...prev, [eventName]: nextTemplateSet }));
        try {
            const docId = encodeURIComponent(eventName);
            await setDoc(doc(db, 'eventTemplates', docId), {
                eventName,
                templateSet: nextTemplateSet,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        } catch (e) {
            console.error('Error guardando plantilla por evento', e);
            toast({ title: 'No se pudo guardar plantilla', description: e?.message || 'Intenta nuevamente', variant: 'destructive' });
        }
    };

    const updateRegistration = async (reg, updates) => {
        if (!reg?.id) return;
        // Optimistic UI
        setEventData((prev) => {
            const copy = { ...prev };
            copy[selectedEvent] = (copy[selectedEvent] || []).map((r) =>
                r.id === reg.id ? { ...r, ...updates } : r
            );
            return copy;
        });
        try {
            await updateDoc(doc(db, 'registrations', reg.id), updates);
        } catch (e) {
            console.error('Error actualizando registro', e);
            toast({ title: 'No se pudo actualizar', description: e?.message || 'Intenta nuevamente', variant: 'destructive' });
        }
    };

    const normalizeTipo = (value) => {
        const v = (value || '').toString().toLowerCase();
        if (v === 'ponente' || v === 'staff') return v;
        return 'participante';
    };

    const normalizeModalidad = (value) => {
        const v = (value || '').toString().toLowerCase();
        return v === 'virtual' ? 'virtual' : 'presencial';
    };

    const onChangeTipo = async (reg, nextTipoRaw) => {
        const tipo = normalizeTipo(nextTipoRaw);
        const updates = {
            tipo,
            tipoAsistencia: tipo,
            modalidad: normalizeModalidad(reg.modalidad || 'presencial'),
        };
        await updateRegistration(reg, updates);
    };

    const onChangeModalidad = async (reg, nextModalidadRaw) => {
        const modalidad = normalizeModalidad(nextModalidadRaw);
        await updateRegistration(reg, { modalidad });
    };

    const nextTipo = (current) => {
        if (current === 'participante') return 'ponente';
        if (current === 'ponente') return 'staff';
        return 'participante';
    };

    const nextModalidad = (current) => (current === 'virtual' ? 'presencial' : 'virtual');

    const renderTipoSelector = (reg) => {
        const tipo = normalizeTipo(reg.tipo || reg.tipoAsistencia);
        const badgeClass = tipo === 'ponente'
            ? 'bg-boreal-purple/30 border-boreal-purple/50 text-white'
            : tipo === 'staff'
            ? 'bg-boreal-aqua/30 border-boreal-aqua/50 text-black'
            : 'bg-white/10 border-white/20 text-white';
        return (
            <div className="inline-flex items-center gap-2">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChangeTipo(reg, nextTipo(tipo)); }}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors ${badgeClass}`}
                    title="Cambiar tipo"
                >
                    {tipo === 'ponente' ? 'Ponente' : tipo === 'staff' ? 'Staff' : 'Participante'}
                </button>
            </div>
        );
    };

    const renderModalidadSelector = (reg) => {
        const modalidad = normalizeModalidad(reg.modalidad);
        return (
            <div className="inline-flex items-center gap-2">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChangeModalidad(reg, nextModalidad(modalidad)); }}
                    className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white transition-colors"
                    title="Cambiar modalidad"
                >
                    {modalidad === 'virtual' ? 'Virtual' : 'Presencial'}
                </button>
            </div>
        );
    };

    const organizeByEvent = (data, manual = []) => {
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
        manual.forEach((evt) => {
            const name = (evt?.name || '').trim();
            if (name && !events[name]) events[name] = [];
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
        const pointsValue = Number.parseInt(pointsToAdd, 10);
        if (addPointsEnabled && (!Number.isFinite(pointsValue) || pointsValue <= 0)) {
            toast({ title: 'Puntos inválidos', description: 'Ingresa una cantidad válida mayor a 0.', variant: 'destructive' });
            return;
        }
        setGenerating(true);
        try {
            const functions = getFunctions(undefined, 'us-central1');
            const callable = httpsCallable(functions, 'generateCertificates');
            const res = await callable({
                eventName: selectedEvent,
                templateSet: (templateSet || '').trim() || null,
                addPoints: addPointsEnabled,
                points: addPointsEnabled ? pointsValue : null,
            });
            const { created = 0, skipped = 0, errors = [], pointsApplied = 0, pointsErrors = [] } = res.data || {};
            setResultInfo({ created, skipped, errors, pointsApplied, pointsErrors });
            setResultOpen(true);
            setCertificatesGenerated(true);
        } catch (e) {
            console.error('Error generando certificados (Cloud Function)', e);
            toast({ title: 'Error generando certificados', description: e.message || 'Inténtalo nuevamente', variant: 'destructive' });
        } finally {
            setGenerating(false);
        }
    };

    const addPointsToSelectedPresent = async () => {
        if (!selectedEvent) return;
        const pointsValue = Number.parseInt(pointsToAdd, 10);
        if (!Number.isFinite(pointsValue) || pointsValue <= 0) {
            toast({ title: 'Puntos inválidos', description: 'Ingresa una cantidad válida mayor a 0.', variant: 'destructive' });
            return;
        }
        const allPresent = (eventData[selectedEvent] || [])
            .filter((r) => isPresent(r.statusAsistencia));
        const selectedPresent = allPresent.filter((r) => selectedIds.has(r.id));
        const list = selectedPresent.length > 0 ? selectedPresent : allPresent;

        if (list.length === 0) {
            toast({ title: 'Sin presentes', description: 'No hay usuarios presentes para asignar puntos.', variant: 'destructive' });
            return;
        }

        setAddingPoints(true);
        try {
            const auth = getAuth();
            const grantedBy = auth.currentUser?.email || auth.currentUser?.uid || 'admin';
            const tasks = list.map(async (r) => {
                const email = (r.userEmail || '').toLowerCase();
                if (!email) return;
                const q = query(collection(db, 'userPoints'), where('email', '==', email));
                const snap = await getDocs(q);
                let userRef;
                if (!snap.empty) {
                    userRef = snap.docs[0].ref;
                    await updateDoc(userRef, {
                        balance: increment(pointsValue),
                        updatedAt: serverTimestamp(),
                        lastEvent: selectedEvent,
                    });
                } else {
                    userRef = doc(collection(db, 'userPoints'));
                    await setDoc(userRef, {
                        email,
                        balance: pointsValue,
                        updatedAt: serverTimestamp(),
                        lastEvent: selectedEvent,
                    });
                }

                await addDoc(collection(userRef, 'adminGrants'), {
                    amount: pointsValue,
                    email,
                    grantedAt: serverTimestamp(),
                    grantedBy,
                    note: selectedEvent || 'Certificado',
                    type: 'manual-award',
                });
            });
            await Promise.all(tasks);
            toast({ title: 'Puntos agregados', description: `Se sumaron puntos a ${list.length} usuario(s).` });
        } catch (e) {
            console.error('Error agregando puntos', e);
            toast({ title: 'No se pudieron agregar puntos', description: e?.message || 'Intenta nuevamente', variant: 'destructive' });
        } finally {
            setAddingPoints(false);
        }
    };

    const mergeCertificatesForCurrentEvent = async () => {
        if (!selectedEvent) return;
        setMerging(true);
        try {
            const functions = getFunctions(undefined, 'us-central1');
            const callable = httpsCallable(functions, 'mergeCertificatesPdf');
            const res = await callable({ eventName: selectedEvent });
            const { merged, urlPdf, pages, reason } = res.data || {};
            if (!merged) {
                toast({ title: 'No se pudo generar PDF', description: reason || 'Sin certificados', variant: 'destructive' });
                return;
            }
            toast({ title: 'PDF combinado listo', description: `Páginas: ${pages || 0}` });
            if (urlPdf) window.open(urlPdf, '_blank', 'noopener');
        } catch (e) {
            console.error('Error combinando PDFs', e);
            toast({ title: 'Error al combinar PDFs', description: e.message || 'Inténtalo nuevamente', variant: 'destructive' });
        } finally {
            setMerging(false);
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
            modalidad: newModalidad || 'presencial',
        };
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
                    modalidad: payload.modalidad,
                    ...(tipo === 'ponente' && customEventName ? { customEventName } : {}),
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

    const handleCreateEvent = async (e) => {
        e?.preventDefault?.();
        const name = (newEventName || '').trim();
        if (!name) {
            toast({ title: 'Escribe el nombre del evento', variant: 'destructive' });
            return;
        }
        if (eventData[name]) {
            setSelectedEvent(name);
            setNewEventName('');
            toast({ title: 'Evento ya existe', description: 'Se seleccionó el evento existente.' });
            return;
        }
        setCreatingEvent(true);
        try {
            const ref = await addDoc(collection(db, 'adminEvents'), {
                name,
                createdAt: serverTimestamp(),
            });
            setManualEvents((prev) => [...prev, { id: ref.id, name }]);
            setEventData((prev) => ({ ...prev, [name]: [] }));
            setSelectedEvent(name);
            setNewEventName('');
            setShowAddEvent(false);
            toast({ title: 'Evento agregado', description: name });
        } catch (err) {
            console.error('Error creando evento manual', err);
            toast({ title: 'No se pudo crear el evento', description: err?.message || 'Intenta de nuevo', variant: 'destructive' });
        } finally {
            setCreatingEvent(false);
        }
    };

    const parseExcelRows = (rows) => {
        if (!rows || rows.length === 0) return { items: [], error: 'El texto está vacío.' };
        const headerRow = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
        const nameIdx = headerRow.findIndex((h) => h.includes('nombre'));
        const emailIdx = headerRow.findIndex((h) => h.includes('correo') || h.includes('email'));
        if (nameIdx === -1 || emailIdx === -1) {
            return { items: [], error: 'No se encontraron columnas NOMBRE y CORREO.' };
        }
        const items = rows.slice(1).map((row) => {
            const name = String(row[nameIdx] || '').trim();
            const email = String(row[emailIdx] || '').trim();
            return { name, email };
        }).filter((item) => item.name && item.email);

        return { items, error: null };
    };

    const parsePastedText = (text) => {
        const raw = (text || '').trim();
        if (!raw) return [];
        const lines = raw.split(/\r?\n/).filter(Boolean);
        return lines.map((line) => {
            const hasTab = line.includes('\t');
            const parts = hasTab ? line.split('\t') : line.split(',');
            return parts.map((cell) => String(cell || '').trim());
        });
    };

    const handleImportExcel = async () => {
        if (!selectedEvent) {
            toast({ title: 'Selecciona un evento', variant: 'destructive' });
            return;
        }
        if (!importText.trim()) {
            toast({ title: 'Pega el texto de tu hoja', variant: 'destructive' });
            return;
        }
        setImporting(true);
        try {
            const rows = parsePastedText(importText);
            const { items, error: parseError } = parseExcelRows(rows);
            if (parseError) {
                toast({ title: 'Error al importar', description: parseError, variant: 'destructive' });
                return;
            }
            if (items.length === 0) {
                toast({ title: 'No hay filas válidas', description: 'Revisa el archivo.', variant: 'destructive' });
                return;
            }

            let added = 0;
            const chunks = [];
            const payloads = items.map((item) => ({
                eventName: selectedEvent,
                userName: item.name,
                userEmail: item.email,
                tipo: 'participante',
                tipoAsistencia: 'participante',
                modalidad: 'presencial',
                statusAsistencia: 'Presente',
            }));

            for (let i = 0; i < payloads.length; i += 450) {
                chunks.push(payloads.slice(i, i + 450));
            }

            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach((payload) => {
                    const docRef = doc(collection(db, 'registrations'));
                    batch.set(docRef, payload);
                });
                await batch.commit();
                added += chunk.length;
            }

            setEventData((prev) => {
                const copy = { ...prev };
                const arr = copy[selectedEvent] ? [...copy[selectedEvent]] : [];
                payloads.forEach((payload) => {
                    arr.push({
                        id: `tmp-${Math.random().toString(36).slice(2)}`,
                        userName: payload.userName,
                        userEmail: payload.userEmail,
                        tipo: payload.tipo,
                        tipoAsistencia: payload.tipoAsistencia,
                        modalidad: payload.modalidad,
                        statusAsistencia: payload.statusAsistencia,
                    });
                });
                copy[selectedEvent] = arr;
                return copy;
            });

            setImportText('');
            setImportOpen(false);
            toast({ title: 'Importación completada', description: `Agregados: ${added}` });
        } catch (err) {
            console.error('Error importando Excel', err);
            toast({ title: 'No se pudo importar', description: err?.message || 'Intenta de nuevo', variant: 'destructive' });
        } finally {
            setImporting(false);
        }
    };

    const handleTemplateUpload = async (file) => {
        if (!selectedEvent) {
            toast({ title: 'Selecciona un evento', variant: 'destructive' });
            return;
        }
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast({ title: 'Archivo inválido', description: 'Sube un PDF.', variant: 'destructive' });
            return;
        }
        setUploadingTemplate(true);
        setUploadProgress(0);
        try {
            const slug = slugify(selectedEvent) || `evento-${Date.now()}`;
            const folder = normalizeTemplateSet(`eventos-admin/${slug}`);
            if (!folder) throw new Error('Nombre de carpeta inválido');
            const fileRef = storageRef(storage, `cert-templates/${folder}/base.pdf`);
            const uploadTask = uploadBytesResumable(fileRef, file);
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Tiempo de carga agotado.'));
                }, 90000);
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
                        setUploadProgress(progress);
                    },
                    (error) => {
                        clearTimeout(timeoutId);
                        reject(error);
                    },
                    () => {
                        clearTimeout(timeoutId);
                        resolve();
                    }
                );
            });
            ensureTemplateSet(folder);
            setTemplateSet(folder);
            await saveTemplateForEvent(selectedEvent, folder);
            toast({ title: 'Plantilla cargada', description: 'PDF listo para generar certificados.' });
        } catch (err) {
            console.error('Error subiendo plantilla', err);
            toast({ title: 'No se pudo subir la plantilla', description: err?.message || 'Intenta de nuevo', variant: 'destructive' });
        } finally {
            setUploadingTemplate(false);
            setUploadProgress(0);
            if (templateFileRef.current) templateFileRef.current.value = '';
        }
    };

    const getManualEventByName = (name) => manualEvents.find((evt) => (evt?.name || '') === name);

    const openEditEvent = () => {
        const evt = getManualEventByName(selectedEvent);
        if (!evt) {
            toast({ title: 'Solo eventos manuales', description: 'Este evento no se puede editar desde aquí.', variant: 'destructive' });
            return;
        }
        setEditEventName(evt.name || selectedEvent);
        const dateValue = evt.date?.toDate ? evt.date.toDate() : (evt.date ? new Date(evt.date) : null);
        setEditEventDate(dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue.toISOString().slice(0, 10) : '');
        setEditEventOpen(true);
    };

    const openDeleteEvent = () => {
        const evt = getManualEventByName(selectedEvent);
        if (!evt) {
            toast({ title: 'Solo eventos manuales', description: 'Este evento no se puede eliminar desde aquí.', variant: 'destructive' });
            return;
        }
        setDeleteEventOpen(true);
    };

    const handleSaveEventDetails = async (e) => {
        e?.preventDefault?.();
        const evt = getManualEventByName(selectedEvent);
        if (!evt) return;
        const nextName = (editEventName || '').trim();
        if (!nextName) {
            toast({ title: 'Nombre requerido', variant: 'destructive' });
            return;
        }
        setSavingEvent(true);
        try {
            const nextDate = editEventDate ? new Date(`${editEventDate}T00:00:00`) : null;
            await updateDoc(doc(db, 'adminEvents', evt.id), {
                name: nextName,
                date: nextDate || null,
                updatedAt: serverTimestamp(),
            });

            if (nextName !== selectedEvent) {
                const regsSnap = await getDocs(query(collection(db, 'registrations'), where('eventName', '==', selectedEvent)));
                let batch = writeBatch(db);
                let counter = 0;
                for (const d of regsSnap.docs) {
                    batch.update(d.ref, { eventName: nextName });
                    counter += 1;
                    if (counter % 450 === 0) {
                        await batch.commit();
                        batch = writeBatch(db);
                    }
                }
                if (counter % 450 !== 0) await batch.commit();

                const existingTemplate = templateByEvent[selectedEvent];
                if (existingTemplate) {
                    const oldId = encodeURIComponent(selectedEvent);
                    const newId = encodeURIComponent(nextName);
                    await setDoc(doc(db, 'eventTemplates', newId), {
                        eventName: nextName,
                        templateSet: existingTemplate,
                        updatedAt: serverTimestamp(),
                    }, { merge: true });
                    await deleteDoc(doc(db, 'eventTemplates', oldId));
                }

                setTemplateByEvent((prev) => {
                    const next = { ...prev };
                    if (prev[selectedEvent]) {
                        next[nextName] = prev[selectedEvent];
                        delete next[selectedEvent];
                    }
                    return next;
                });

                setEventData((prev) => {
                    const next = { ...prev };
                    if (next[selectedEvent]) {
                        next[nextName] = next[selectedEvent];
                        delete next[selectedEvent];
                    }
                    return next;
                });

                setSelectedEvent(nextName);
            }

            setManualEvents((prev) => prev.map((item) => (item.id === evt.id ? { ...item, name: nextName, date: editEventDate ? new Date(`${editEventDate}T00:00:00`) : null } : item)));
            toast({ title: 'Evento actualizado' });
            setEditEventOpen(false);
        } catch (err) {
            console.error('Error actualizando evento', err);
            toast({ title: 'No se pudo actualizar', description: err?.message || 'Intenta de nuevo', variant: 'destructive' });
        } finally {
            setSavingEvent(false);
        }
    };

    const handleDeleteEvent = async () => {
        const evt = getManualEventByName(selectedEvent);
        if (!evt) return;
        setDeletingEvent(true);
        try {
            await deleteDoc(doc(db, 'adminEvents', evt.id));
            const templateId = encodeURIComponent(selectedEvent);
            await deleteDoc(doc(db, 'eventTemplates', templateId));

            const regsSnap = await getDocs(query(collection(db, 'registrations'), where('eventName', '==', selectedEvent)));
            let batch = writeBatch(db);
            let counter = 0;
            for (const d of regsSnap.docs) {
                batch.delete(d.ref);
                counter += 1;
                if (counter % 450 === 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                }
            }
            if (counter % 450 !== 0) await batch.commit();

            setManualEvents((prev) => prev.filter((item) => item.id !== evt.id));
            setTemplateByEvent((prev) => {
                const next = { ...prev };
                delete next[selectedEvent];
                return next;
            });
            let nextSelected = '';
            setEventData((prev) => {
                const next = { ...prev };
                delete next[selectedEvent];
                nextSelected = Object.keys(next)[0] || '';
                return next;
            });
            setSelectedEvent(nextSelected);
            toast({ title: 'Evento eliminado' });
            setDeleteEventOpen(false);
        } catch (err) {
            console.error('Error eliminando evento', err);
            toast({ title: 'No se pudo eliminar', description: err?.message || 'Intenta de nuevo', variant: 'destructive' });
        } finally {
            setDeletingEvent(false);
        }
    };

    const openParticipantDetails = (reg) => {
        if (!reg) return;
        setActiveParticipant(reg);
        setParticipantOpen(true);
    };

    const openEditParticipant = () => {
        if (!activeParticipant) return;
        setEditParticipantName(activeParticipant.userName || '');
        setEditParticipantEmail(activeParticipant.userEmail || '');
        setEditParticipantCustomEventName(activeParticipant.customEventName || '');
        setEditParticipantOpen(true);
    };

    const handleSaveParticipant = async (e) => {
        e?.preventDefault?.();
        if (!activeParticipant?.id) return;
        const nextName = (editParticipantName || '').trim();
        const nextEmail = (editParticipantEmail || '').trim();
        const nextCustomEventName = (editParticipantCustomEventName || '').trim();
        
        if (!nextName || !nextEmail) {
            toast({ title: 'Nombre y email son obligatorios', variant: 'destructive' });
            return;
        }
        
        const updates = { userName: nextName, userEmail: nextEmail };
        
        // Solo guardar customEventName si es ponente
        if (normalizeTipo(activeParticipant.tipo || activeParticipant.tipoAsistencia) === 'ponente') {
            updates.customEventName = nextCustomEventName;
        }

        await updateRegistration(activeParticipant, updates);
        setActiveParticipant((prev) => prev ? { ...prev, ...updates } : prev);
        setEditParticipantOpen(false);
        toast({ title: 'Registro actualizado' });
    };

    const openHomeConfigModal = async () => {
        try {
            const homeSnap = await getDoc(doc(db, 'siteConfig', 'home'));
            if (homeSnap.exists() && homeSnap.data().impacts) {
                setHomeConfigData(homeSnap.data());
            } else {
                setHomeConfigData(defaultHomeConfig);
            }

            const linksSnap = await getDoc(doc(db, 'siteConfig', 'links'));
            if (linksSnap.exists()) {
                setLinksData({ ...defaultLinks, ...linksSnap.data() });
            } else {
                setLinksData(defaultLinks);
            }

            setActiveHomeTab('impacts');
            setHomeConfigOpen(true);
        } catch (e) {
            console.error('Error opening home config', e);
            toast({ title: 'Error', description: 'No se pudo cargar la configuración', variant: 'destructive' });
        }
    };

    const saveHomeConfig = async () => {
        try {
            setSavingHomeConfig(true);
            await setDoc(doc(db, 'siteConfig', 'home'), homeConfigData);
            await setDoc(doc(db, 'siteConfig', 'links'), linksData);
            toast({ title: 'Configuración Guardada', description: 'Los cambios de Inicio y Enlaces fueron aplicados.' });
            setHomeConfigOpen(false);
        } catch (e) {
            toast({ title: 'Error al guardar', description: 'Ocurrió un problema.', variant: 'destructive' });
            console.error('Save Error', e);
        } finally {
            setSavingHomeConfig(false);
        }
    };

    const updateHomeConfigField = (section, index, field, value) => {
        setHomeConfigData(prev => {
            const newArray = [...prev[section]];
            newArray[index] = { ...newArray[index], [field]: value };
            return { ...prev, [section]: newArray };
        });
    };

    const addHomeConfigItem = (section) => {
        setHomeConfigData(prev => {
            const newItem = section === 'impacts' 
                ? { icon: 'Star', metric: '0', description: 'Nuevo impacto' }
                : { name: 'Nuevo Aliado', alt: 'Logo', imgSrc: '' };
            return { ...prev, [section]: [...prev[section], newItem] };
        });
    };

    const removeHomeConfigItem = (section, index) => {
        setHomeConfigData(prev => {
            const newArray = [...prev[section]];
            newArray.splice(index, 1);
            return { ...prev, [section]: newArray };
        });
    };

    const handleUploadPartnerLogo = async (e, index) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingPartnerImage(true);
        try {
            const fileName = `partner_logos/${Date.now()}_${file.name}`;
            const fileRef = storageRef(storage, fileName);
            const uploadTask = await uploadBytesResumable(fileRef, file);
            const downloadURL = await getDownloadURL(uploadTask.ref);
            updateHomeConfigField('partners', index, 'imgSrc', downloadURL);
            toast({ title: 'Imagen subida correctamente' });
        } catch (err) {
            console.error('Error subiendo imagen', err);
            toast({ title: 'Error al subir la imagen', variant: 'destructive' });
        } finally {
            setUploadingPartnerImage(false);
            // reseteamos el input
            e.target.value = null;
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
                    <div className="mb-6 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 items-start">
                            <div>
                                <label htmlFor="eventSelect" className="block text-sm opacity-80 mb-1">Evento</label>
                                <select
                                    id="eventSelect"
                                    className="w-full bg-boreal-dark/60 border border-white/10 rounded px-3 py-2"
                                    value={selectedEvent}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '__add_event__') {
                                            setShowAddEvent(true);
                                            return;
                                        }
                                        setShowAddEvent(false);
                                        setSelectedEvent(value);
                                    }}
                                >
                                    {Object.keys(eventData).sort().map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                    <option value="__add_event__">+ Agregar evento…</option>
                                </select>
                                {showAddEvent && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <Input
                                            value={newEventName}
                                            onChange={(e) => setNewEventName(e.target.value)}
                                            placeholder="Nombre del evento"
                                            className="bg-boreal-dark/60 border border-white/10 text-white text-sm h-9 max-w-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCreateEvent}
                                            disabled={creatingEvent}
                                            className={`rounded-md px-3 py-2 text-xs font-medium border border-white/10 ${creatingEvent ? 'bg-white/10 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20'}`}
                                        >
                                            {creatingEvent ? 'Agregando…' : 'Crear'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label htmlFor="templateSet" className="block text-sm opacity-80 mb-1">Carpeta de plantilla</label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        id="templateSet"
                                        className="bg-boreal-dark/60 border border-white/10 text-white text-sm h-9 max-w-xs rounded px-3"
                                        value={templateSet}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '__upload__') {
                                                if (templateFileRef.current) templateFileRef.current.click();
                                                return;
                                            }
                                            if (value === '__add__') {
                                                setShowAddTemplate(true);
                                                return;
                                            }
                                            setShowAddTemplate(false);
                                            const cleaned = normalizeTemplateSet(value);
                                            setTemplateSet(cleaned);
                                            ensureTemplateSet(cleaned);
                                            if (selectedEvent && cleaned) saveTemplateForEvent(selectedEvent, cleaned);
                                        }}
                                    >
                                        {templateSets.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                        <option value="__upload__">+ Agregar plantilla (PDF)…</option>
                                        <option value="__add__">+ Agregar carpeta…</option>
                                    </select>
                                    <input
                                        ref={templateFileRef}
                                        type="file"
                                        accept="application/pdf"
                                        className="hidden"
                                        onChange={(e) => handleTemplateUpload(e.target.files?.[0])}
                                    />
                                    {showAddTemplate && (
                                        <>
                                            <Input
                                                value={templateSetDraft}
                                                onChange={(e) => setTemplateSetDraft(e.target.value)}
                                                placeholder="Nueva carpeta"
                                                className="bg-boreal-dark/60 border border-white/10 text-white text-sm h-9 max-w-[200px]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cleaned = normalizeTemplateSet(templateSetDraft);
                                                    if (!cleaned) return;
                                                    ensureTemplateSet(cleaned);
                                                    setTemplateSet(cleaned);
                                                    setTemplateSetDraft('');
                                                    setShowAddTemplate(false);
                                                    if (selectedEvent && cleaned) saveTemplateForEvent(selectedEvent, cleaned);
                                                }}
                                                className="rounded-md px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/10"
                                            >
                                                Agregar
                                            </button>
                                        </>
                                    )}
                                    {uploadingTemplate && (
                                        <span className="text-xs opacity-70">Subiendo… {uploadProgress}%</span>
                                    )}
                                </div>
                                <p className="text-xs opacity-60 mt-2">Carpeta en Storage: cert-templates/&lt;carpeta&gt;/</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
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
                            <button
                                type="button"
                                onClick={() => setPointsModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20"
                                title="Puntos"
                            >
                                <span className="text-emerald-300">★</span>
                                Puntos
                            </button>
                            <motion.button
                                onClick={mergeCertificatesForCurrentEvent}
                                disabled={merging || stats.total === 0}
                                whileTap={!merging ? { scale: 0.97 } : undefined}
                                whileHover={!merging ? { scale: 1.02 } : undefined}
                                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-medium transition-colors ${merging || stats.total === 0 ? 'bg-white/10 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                            >
                                {merging ? 'Compilando…' : 'Compilar PDF'}
                            </motion.button>
                            {/* Menú hamburguesa */}
                            <div className="ml-auto relative">
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
                                        <button
                                            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
                                            onClick={() => { openEditEvent(); setMenuOpen(false); }}
                                        >
                                            Editar evento
                                        </button>
                                        <button
                                            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
                                            onClick={() => { openHomeConfigModal(); setMenuOpen(false); }}
                                        >
                                            Configuración Home
                                        </button>
                                        <button
                                            className="w-full text-left px-3 py-2 rounded hover:bg-red-500/10 text-red-300"
                                            onClick={() => { openDeleteEvent(); setMenuOpen(false); }}
                                        >
                                            Eliminar evento
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

                        {/* Contadores abajo */}
                        <div className="grid grid-cols-3 gap-3 w-full">
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
                                const isParticipante = tipoCell === 'participante';
                                return (
                                    <motion.div
                                        key={reg.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        onClick={() => openParticipantDetails(reg)}
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
                                            <div className="flex flex-wrap items-center gap-2">
                                                {renderTipoSelector(reg, 'xs')}
                                                {renderModalidadSelector(reg, 'xs')}
                                            </div>
                                            <div className="shrink-0">
                                                <motion.button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleAttendance(reg); }}
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
                                        const isParticipante = tipoCell === 'participante';
                                        const cells = [];
                                        if (selectionMode) {
                                            cells.push(
                                                <td key="sel" className="px-4 py-2">
                                                    <input type="checkbox" checked={selectedIds.has(reg.id)} onChange={() => toggleSelectOne(reg.id)} aria-label={`Seleccionar ${reg.userEmail}`} />
                                                </td>
                                            );
                                        }
                                        cells.push(
                                            <td key="idx" className="px-4 py-2 opacity-70">{idx + 1}</td>
                                        );
                                        cells.push(
                                            <td key="name" className="px-4 py-2">{reg.userName || '-'}</td>
                                        );
                                        cells.push(
                                            <td key="email" className="px-4 py-2 break-all">{reg.userEmail}</td>
                                        );
                                        cells.push(
                                            <td key="tipo" className="px-4 py-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {renderTipoSelector(reg)}
                                                    {renderModalidadSelector(reg)}
                                                </div>
                                            </td>
                                        );
                                        cells.push(
                                            <td key="attendance" className="px-4 py-2">
                                                <motion.button
                                                    type="button"
                                                        onClick={(e) => { e.stopPropagation(); toggleAttendance(reg); }}
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
                                            </td>
                                        );
                                        return (
                                            <tr
                                                key={reg.id}
                                                onClick={() => openParticipantDetails(reg)}
                                                className={`border-t border-white/10 cursor-pointer ${isPonente ? 'bg-boreal-purple/10' : isStaff ? 'bg-boreal-aqua/10' : ''}`}
                                            >
                                                {cells}
                                            </tr>
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
                            <Label className="block text-sm opacity-80 mb-1">Tipo de carga</Label>
                            <div className="inline-flex rounded-md border border-white/10 bg-white/5 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setImportMode('individual')}
                                    className={`px-3 py-1 text-xs ${importMode === 'individual' ? 'bg-white/20' : 'opacity-70 hover:bg-white/10'}`}
                                >
                                    Individual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setImportMode('masivo')}
                                    className={`px-3 py-1 text-xs ${importMode === 'masivo' ? 'bg-white/20' : 'opacity-70 hover:bg-white/10'}`}
                                >
                                    Masivo
                                </button>
                            </div>
                        </div>
                        <div>
                            <Label className="block text-sm opacity-80 mb-1">Evento</Label>
                            <Input value={selectedEvent} readOnly className="bg-white/5 border-white/10" />
                        </div>
                        {importMode === 'individual' ? (
                            <>
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
                                    <div>
                                        <Label className="block text-sm opacity-80 mb-1">Modalidad</Label>
                                        <select className="w-full bg-boreal-dark/60 border border-white/10 rounded px-3 py-2" value={newModalidad} onChange={(e) => setNewModalidad(e.target.value)}>
                                            <option value="presencial">Presencial</option>
                                            <option value="virtual">Virtual</option>
                                        </select>
                                    </div>
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
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <p className="text-sm opacity-80">Pega una tabla con columnas <strong>NOMBRE</strong> y <strong>CORREO</strong> (separadas por tabulaciones). La modalidad se asigna como <strong>Presencial</strong> por defecto.</p>
                                    <textarea
                                        value={importText}
                                        onChange={(e) => setImportText(e.target.value)}
                                        rows={6}
                                        className="w-full rounded-md bg-boreal-dark/60 border border-white/10 px-3 py-2 text-sm text-white"
                                        placeholder="NOMBRE\tCORREO\nJuan Pérez\tjuan@correo.com"
                                    />
                                </div>
                                <DialogFooter>
                                    <DialogClose onClick={() => setCreateOpen(false)}>Cancelar</DialogClose>
                                    <button
                                        type="button"
                                        onClick={handleImportExcel}
                                        disabled={importing}
                                        className={`rounded-md px-4 py-2 font-medium ${importing ? 'bg-white/10 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-black'}`}
                                    >
                                        {importing ? 'Importando…' : 'Importar masivo'}
                                    </button>
                                </DialogFooter>
                            </>
                        )}
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
                        const { created, skipped, errors, pointsApplied, pointsErrors } = resultInfo;
                        const hasErrors = (errors || []).length > 0;
                        const allOmitted = !hasErrors && created === 0 && skipped > 0;
                        const successAll = !hasErrors && created > 0 && skipped === 0;
                        const mixed = !hasErrors && created > 0 && skipped > 0;
                        const pointsFailed = (pointsErrors || []).length > 0;
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
                                    <div className="opacity-80 mt-1">Puntos aplicados: <strong>{pointsApplied || 0}</strong> • Errores de puntos: <strong>{(pointsErrors || []).length}</strong></div>
                                    {successAll && <div className="text-emerald-400 mt-1">Todos los certificados se generaron correctamente.</div>}
                                    {allOmitted && <div className="text-yellow-300 mt-1">Todos los certificados fueron omitidos.</div>}
                                    {mixed && <div className="text-emerald-300 mt-1">Generación parcial completada.</div>}
                                    {hasErrors && <div className="text-red-300 mt-1">Hubo errores durante la generación.</div>}
                                    {pointsFailed && <div className="text-red-300 mt-1">Hubo errores al asignar puntos.</div>}
                                </div>
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <button onClick={() => setResultOpen(false)} className="rounded-md px-4 py-2 font-medium bg-white/10 hover:bg-white/20">Cerrar</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Puntos */}
            <Dialog open={pointsModalOpen} onOpenChange={setPointsModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Asignar puntos</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                            <div>
                                <div className="text-sm font-semibold text-white">Puntos por certificado</div>
                                <div className="text-xs text-white/60">Se aplican al emitir certificados.</div>
                            </div>
                            <label className="inline-flex items-center gap-2 text-xs text-white/80">
                                <input
                                    type="checkbox"
                                    checked={addPointsEnabled}
                                    onChange={(e) => setAddPointsEnabled(e.target.checked)}
                                />
                                Activar
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                value={pointsToAdd}
                                onChange={(e) => setPointsToAdd(e.target.value)}
                                placeholder="0"
                                type="number"
                                min="1"
                                className="h-9 w-24 bg-boreal-dark/60 border border-white/10 text-white text-sm"
                                disabled={!addPointsEnabled}
                            />
                            {[5, 10, 20].map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                        const current = Number.parseInt(pointsToAdd || '0', 10);
                                        const next = (Number.isFinite(current) ? current : 0) + value;
                                        setPointsToAdd(String(next));
                                    }}
                                    className="rounded-md px-2 py-1 text-xs bg-white/10 hover:bg-white/20"
                                    disabled={!addPointsEnabled}
                                >
                                    +{value}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setPointsToAdd('0')}
                                className="rounded-md px-2 py-1 text-xs bg-white/10 hover:bg-white/20"
                                disabled={!addPointsEnabled}
                            >
                                Reset
                            </button>
                        </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                            <div className="text-sm font-semibold text-white">Agregar a presentes seleccionados</div>
                            <div className="text-xs text-white/60 mt-1">Si no seleccionas, se aplicará a todos los presentes.</div>
                            <button
                                type="button"
                                onClick={addPointsToSelectedPresent}
                                disabled={addingPoints}
                                className={`mt-2 rounded-md px-3 py-2 text-xs font-medium border border-white/10 ${addingPoints ? 'bg-white/10 cursor-not-allowed' : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200'}`}
                            >
                                {addingPoints ? 'Sumando…' : 'Agregar a seleccionados'}
                            </button>
                        </div>
                    </div>
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={() => setPointsModalOpen(false)}
                            className="rounded-md px-4 py-2 font-medium bg-white/10 hover:bg-white/20"
                        >
                            Cerrar
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Configuración Home */}
            <Dialog open={homeConfigOpen} onOpenChange={() => setHomeConfigOpen(false)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manejo de UI Inicio</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex border-b border-white/20">
                            <button
                                className={`px-4 py-2 font-medium text-sm ${activeHomeTab === 'impacts' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
                                onClick={() => setActiveHomeTab('impacts')}
                            >
                                Nuestro Impacto
                            </button>
                            <button
                                className={`px-4 py-2 font-medium text-sm ${activeHomeTab === 'partners' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
                                onClick={() => setActiveHomeTab('partners')}
                            >
                                Aliados e Instituciones
                            </button>
                            <button
                                className={`px-4 py-2 font-medium text-sm ${activeHomeTab === 'links' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
                                onClick={() => setActiveHomeTab('links')}
                            >
                                Enlaces Web
                            </button>
                        </div>

                        {activeHomeTab === 'impacts' && (
                            <div className="space-y-4">
                                {homeConfigData.impacts?.map((impact, idx) => (
                                    <div key={idx} className="flex gap-4 items-start bg-white/5 p-4 rounded-lg relative group">
                                        <button onClick={() => removeHomeConfigItem('impacts', idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="flex-1 space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label className="text-xs text-gray-400 mb-1 block">Métrica (ej: +650)</Label>
                                                    <Input 
                                                        value={impact.metric} 
                                                        onChange={(e) => updateHomeConfigField('impacts', idx, 'metric', e.target.value)} 
                                                        className="h-8"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-400 mb-2 block">Ícono Actual</Label>
                                                    <div className="grid grid-cols-5 gap-2 bg-boreal-dark p-2 rounded-md border border-white/10 h-32 overflow-y-auto">
                                                        {AVAILABLE_ICONS.map((iconObj) => {
                                                            const IconComponent = iconObj.component;
                                                            return (
                                                                <button
                                                                    key={iconObj.name}
                                                                    onClick={() => updateHomeConfigField('impacts', idx, 'icon', iconObj.name)}
                                                                    className={`flex flex-col items-center justify-center p-2 rounded-md transition-all ${
                                                                        impact.icon === iconObj.name 
                                                                        ? 'bg-boreal-purple text-white border-boreal-purple border-2' 
                                                                        : 'text-gray-400 hover:bg-white/10 border-2 border-transparent'
                                                                    }`}
                                                                    title={iconObj.label}
                                                                >
                                                                    <IconComponent className="w-5 h-5 mb-1" />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-400 mb-1 block">Descripción</Label>
                                                <Input 
                                                    value={impact.description} 
                                                    onChange={(e) => updateHomeConfigField('impacts', idx, 'description', e.target.value)} 
                                                    className="h-8"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <Button onClick={() => addHomeConfigItem('impacts')} variant="outline" size="sm" className="w-full mt-2 border-white/20 hover:bg-white/10">
                                    <Plus className="w-4 h-4 mr-2" /> Agregar Métrica
                                </Button>
                            </div>
                        )}

                        {activeHomeTab === 'partners' && (
                            <div className="space-y-4">
                                {homeConfigData.partners?.map((partner, idx) => (
                                    <div key={idx} className="flex gap-4 items-start bg-white/5 p-4 rounded-lg relative group">
                                        <button onClick={() => removeHomeConfigItem('partners', idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="flex-1 space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label className="text-xs text-gray-400 mb-1 block">Nombre de la Institución</Label>
                                                    <Input 
                                                        value={partner.name} 
                                                        onChange={(e) => updateHomeConfigField('partners', idx, 'name', e.target.value)} 
                                                        className="h-8"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-400 mb-1 block">Texto Alternativo (Alt)</Label>
                                                    <Input 
                                                        value={partner.alt} 
                                                        onChange={(e) => updateHomeConfigField('partners', idx, 'alt', e.target.value)} 
                                                        className="h-8"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                    <Label className="text-xs text-gray-400 mb-1 block">URL de la Imagen / Logo</Label>
                                                    <div className="flex gap-2">
                                                        <Input 
                                                            value={partner.imgSrc} 
                                                            onChange={(e) => updateHomeConfigField('partners', idx, 'imgSrc', e.target.value)} 
                                                            className="h-8 flex-1"
                                                            placeholder="https://..."
                                                        />
                                                        <label className="cursor-pointer h-8 px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-md flex items-center justify-center border border-white/20 whitespace-nowrap">
                                                            {uploadingPartnerImage ? '...' : 'Subir'}
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                className="hidden" 
                                                                onChange={(e) => handleUploadPartnerLogo(e, idx)} 
                                                                disabled={uploadingPartnerImage}
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                        </div>
                                    </div>
                                ))}
                                <Button onClick={() => addHomeConfigItem('partners')} variant="outline" size="sm" className="w-full mt-2 border-white/20 hover:bg-white/10">
                                    <Plus className="w-4 h-4 mr-2" /> Agregar Aliado
                                </Button>
                            </div>
                        )}

                        {activeHomeTab === 'links' && (
                            <div className="space-y-4 bg-white/5 p-4 rounded-lg">
                                <div>
                                    <Label className="text-xs text-gray-400 mb-1 block">Video Principal de Inicio (YouTube URL)</Label>
                                    <Input 
                                        value={linksData.youtubeVideoUrl || linksData.youtubeUrl || ''} 
                                        onChange={(e) => setLinksData(prev => ({ ...prev, youtubeVideoUrl: e.target.value, youtubeUrl: e.target.value }))} 
                                        className="h-8"
                                        placeholder="https://www.youtube.com/watch?v=..."
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-400 mb-1 block">Enlace a Boreal Wallet</Label>
                                    <Input 
                                        value={linksData.walletUrl || ''} 
                                        onChange={(e) => setLinksData(prev => ({ ...prev, walletUrl: e.target.value }))} 
                                        className="h-8"
                                        placeholder="https://wallet.borealabs.org"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-400 mb-1 block">Enlace a Comunidad (WhatsApp)</Label>
                                    <Input 
                                        value={linksData.communityUrl || ''} 
                                        onChange={(e) => setLinksData(prev => ({ ...prev, communityUrl: e.target.value }))} 
                                        className="h-8"
                                        placeholder="https://chat.whatsapp.com/..."
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-400 mb-1 block">Enlace a Instagram</Label>
                                    <Input 
                                        value={linksData.instagramUrl || ''} 
                                        onChange={(e) => setLinksData(prev => ({ ...prev, instagramUrl: e.target.value }))} 
                                        className="h-8"
                                        placeholder="https://instagram.com/boreal.labs"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="mt-6">
                        <DialogClose onClick={() => setHomeConfigOpen(false)}>Cancelar</DialogClose>
                        <button
                            onClick={saveHomeConfig}
                            disabled={savingHomeConfig}
                            className={`rounded-md px-4 py-2 font-medium ${savingHomeConfig ? 'bg-white/10 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-black'}`}
                        >
                            {savingHomeConfig ? 'Guardando…' : 'Guardar y Publicar'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Editar evento */}
            <Dialog open={editEventOpen} onOpenChange={() => setEditEventOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar evento</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveEventDetails} className="space-y-3">
                        <div>
                            <Label className="block text-sm opacity-80 mb-1">Nombre</Label>
                            <Input value={editEventName} onChange={(e) => setEditEventName(e.target.value)} placeholder="Nombre del evento" />
                        </div>
                        <div>
                            <Label className="block text-sm opacity-80 mb-1">Fecha</Label>
                            <Input type="date" value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <DialogClose onClick={() => setEditEventOpen(false)}>Cancelar</DialogClose>
                            <button
                                type="submit"
                                disabled={savingEvent}
                                className={`rounded-md px-4 py-2 font-medium ${savingEvent ? 'bg-white/10 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-black'}`}
                            >
                                {savingEvent ? 'Guardando…' : 'Guardar'}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Eliminar evento */}
            <Dialog open={deleteEventOpen} onOpenChange={() => setDeleteEventOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Eliminar evento</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-neutral-300">Se eliminará el evento y todos sus registros asociados. Esta acción no se puede deshacer.</p>
                    <DialogFooter>
                        <DialogClose onClick={() => setDeleteEventOpen(false)}>Cancelar</DialogClose>
                        <button
                            onClick={handleDeleteEvent}
                            disabled={deletingEvent}
                            className={`rounded-md px-4 py-2 font-medium ${deletingEvent ? 'bg-white/10 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                        >
                            {deletingEvent ? 'Eliminando…' : 'Eliminar'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detalle de participante */}
            <Dialog open={participantOpen} onOpenChange={() => setParticipantOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalle del participante</DialogTitle>
                    </DialogHeader>
                    {activeParticipant ? (
                        <div className="space-y-2 text-sm">
                            <div><span className="opacity-70">Nombre:</span> <strong>{activeParticipant.userName || '-'}</strong></div>
                            <div><span className="opacity-70">Correo:</span> <strong>{activeParticipant.userEmail || '-'}</strong></div>
                            <div><span className="opacity-70">Tipo:</span> <strong>{(activeParticipant.tipo || activeParticipant.tipoAsistencia || 'participante')}</strong></div>
                            <div><span className="opacity-70">Modalidad:</span> <strong>{normalizeModalidad(activeParticipant.modalidad) === 'virtual' ? 'Virtual' : 'Presencial'}</strong></div>
                            <div><span className="opacity-70">Asistencia:</span> <strong>{isPresent(activeParticipant.statusAsistencia) ? 'Presente' : 'Ausente'}</strong></div>
                        </div>
                    ) : (
                        <p className="text-sm opacity-70">Sin información.</p>
                    )}
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={openEditParticipant}
                            className="rounded-md px-4 py-2 font-medium bg-white/10 hover:bg-white/20"
                        >
                            Editar
                        </button>
                        <DialogClose onClick={() => setParticipantOpen(false)}>Cerrar</DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Editar participante */}
            <Dialog open={editParticipantOpen} onOpenChange={() => setEditParticipantOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar participante</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveParticipant} className="space-y-3">
                        <div>
                            <Label className="block text-sm opacity-80 mb-1">Nombre</Label>
                            <Input value={editParticipantName} onChange={(e) => setEditParticipantName(e.target.value)} />
                        </div>
                        <div>
                            <Label className="block text-sm opacity-80 mb-1">Correo</Label>
                            <Input type="email" value={editParticipantEmail} onChange={(e) => setEditParticipantEmail(e.target.value)} />
                        </div>
                        {activeParticipant && normalizeTipo(activeParticipant.tipo || activeParticipant.tipoAsistencia) === 'ponente' && (
                            <div className="pt-2">
                                <Label className="block text-sm opacity-80 mb-1">Nombre de evento (para Ponente)</Label>
                                <Input value={editParticipantCustomEventName} onChange={(e) => setEditParticipantCustomEventName(e.target.value)} placeholder="Ej. Ponente invitado en …" />
                            </div>
                        )}
                        <DialogFooter>
                            <DialogClose onClick={() => setEditParticipantOpen(false)}>Cancelar</DialogClose>
                            <button type="submit" className="rounded-md px-4 py-2 font-medium bg-emerald-500 hover:bg-emerald-400 text-black">Guardar</button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminPanel;

