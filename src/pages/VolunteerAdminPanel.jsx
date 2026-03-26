import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../firebase';
import { collection, getDocs, updateDoc, doc, query, orderBy, deleteDoc, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { Users, LogOut, CheckCircle, Download, Calendar, Activity, XCircle, Search, Trash2, Menu, Plus, Minus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet-async';
import * as XLSX from 'xlsx';

const VolunteerAdminPanel = () => {
    const [volunteers, setVolunteers] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [eventData, setEventData] = useState({});
    const [volunteerEventMeta, setVolunteerEventMeta] = useState({});
    const [selectedEvent, setSelectedEvent] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('inscripciones');
    
    // New Feature States
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent');
    const [procedenciaFilter, setProcedenciaFilter] = useState('all');
    const [availabilityDayFilter, setAvailabilityDayFilter] = useState('all');
    const [selectedVols, setSelectedVols] = useState([]);
    const [selectionEnabled, setSelectionEnabled] = useState(false);
    const [showColMenu, setShowColMenu] = useState(false);
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [filtersDraft, setFiltersDraft] = useState({
        sortBy: 'recent',
        procedenciaFilter: 'all',
        availabilityDayFilter: 'all'
    });
    const [creditEditor, setCreditEditor] = useState({
        open: false,
        volunteerId: null,
        volunteerName: '',
        tempCredits: 0
    });
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);
    const [showEditEventModal, setShowEditEventModal] = useState(false);
    const [showImageCropperModal, setShowImageCropperModal] = useState(false);
    const [showCertificatesModal, setShowCertificatesModal] = useState(false);
    const [showAssignCreditsModal, setShowAssignCreditsModal] = useState(false);
    const [generatingCertificates, setGeneratingCertificates] = useState(false);
    const [assigningCredits, setAssigningCredits] = useState(false);
    const [creditsToAssign, setCreditsToAssign] = useState('1');
    const [onlyPresentForCredits, setOnlyPresentForCredits] = useState(true);
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [imageToCrop, setImageToCrop] = useState({ file: null, url: '' });
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [eventForm, setEventForm] = useState({
        imageFile: null,
        imagePreviewUrl: '',
        attendanceOptions: ['Presencial', 'Virtual'],
        confirmationMessage: '',
        title: '',
        date: '',
        time: '',
        location: '',
        category: 'voluntariado',
        capacity: '',
        description: ''
    });
    const [eventEditForm, setEventEditForm] = useState({
        id: '',
        title: '',
        date: '',
        time: '',
        location: '',
        capacity: '',
        description: '',
        visible: true,
        soldOut: false,
        attendanceOptions: ['Presencial', 'Virtual'],
        confirmationMessage: ''
    });
    const [availabilityDetail, setAvailabilityDetail] = useState({
        open: false,
        volunteer: null
    });
    const [visibleCols, setVisibleCols] = useState({
        edad: false,
        talla: false,
        contacto: true,
        ubicacion: false,
        disponibilidad: true,
        comentarios: false,
        creditos: true
    });

    const { toast } = useToast();
    const navigate = useNavigate();
    const auth = getAuth();

    const getCallableErrorMessage = (error) => {
        const code = String(error?.code || '');
        const detailsMessage = typeof error?.details === 'string' ? error.details : error?.details?.message;
        if (code.includes('unauthenticated')) {
            return 'Tu sesión de admin expiró. Cierra sesión y vuelve a ingresar.';
        }
        if (code.includes('failed-precondition')) {
            return detailsMessage || error?.message || 'Falta configurar la plantilla PDF en Storage.';
        }
        if (code.includes('not-found')) {
            return 'La Cloud Function no está desplegada o no existe en us-central1.';
        }
        return detailsMessage || error?.message || 'Inténtalo nuevamente.';
    };

    const dayDefinitions = [
        { key: 'lunes', initial: 'L', labels: ['lunes', 'lun'] },
        { key: 'martes', initial: 'M', labels: ['martes', 'mar'] },
        { key: 'miercoles', initial: 'K', labels: ['miercoles', 'miércoles', 'mie', 'mié'] },
        { key: 'jueves', initial: 'J', labels: ['jueves', 'jue'] },
        { key: 'viernes', initial: 'V', labels: ['viernes', 'vie'] },
        { key: 'sabado', initial: 'S', labels: ['sabado', 'sábado', 'sab'] },
        { key: 'domingo', initial: 'D', labels: ['domingo', 'dom'] }
    ];

    const periodStyles = {
        morning: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        afternoon: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
        both: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        custom: 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
    };

    const periodLabels = {
        morning: 'Manana',
        afternoon: 'Tarde',
        both: 'Manana/Tarde',
        custom: 'Personalizado'
    };

    const periodShortLabels = {
        morning: 'Ma',
        afternoon: 'Ta',
        both: 'Ma/Ta',
        custom: 'Per'
    };

    const columnLabels = {
        edad: 'Edad',
        talla: 'Talla',
        contacto: 'Contacto',
        ubicacion: 'Ubicación',
        disponibilidad: 'Horarios',
        comentarios: 'Comentarios',
        creditos: 'Créditos'
    };

    const normalize = (value) => (value || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const getSlotPeriod = (text, isCustom = false) => {
        if (isCustom) return 'custom';
        const n = normalize(text);
        const hasMorning = n.includes('manana');
        const hasAfternoon = n.includes('tarde');
        if (hasMorning && hasAfternoon) return 'both';
        if (hasMorning) return 'morning';
        if (hasAfternoon) return 'afternoon';
        return 'custom';
    };

    const extractDayKeys = (text) => {
        const n = normalize(text);
        return dayDefinitions
            .filter((day) => day.labels.some((label) => n.includes(label)))
            .map((day) => day.key);
    };

    const mergePeriod = (current, incoming) => {
        if (!current) return incoming;
        if (current === incoming) return current;
        if (current === 'custom' || incoming === 'custom') return 'custom';
        if (current === 'both' || incoming === 'both') return 'both';
        return 'both';
    };

    const getAvailabilityMap = (volunteer) => {
        const map = dayDefinitions.reduce((acc, day) => {
            acc[day.key] = null;
            return acc;
        }, {});

        const turnos = Array.isArray(volunteer?.turnos) ? volunteer.turnos : [];
        const personalizados = volunteer?.horariosPersonalizados || null;

        turnos.forEach((slot) => {
            const days = extractDayKeys(slot);
            const period = getSlotPeriod(slot, false);
            days.forEach((dayKey) => {
                map[dayKey] = mergePeriod(map[dayKey], period);
            });
        });

        if (Array.isArray(personalizados)) {
            personalizados.filter(Boolean).forEach((slot) => {
                const days = extractDayKeys(slot);
                days.forEach((dayKey) => {
                    map[dayKey] = mergePeriod(map[dayKey], 'custom');
                });
            });
        } else if (personalizados && typeof personalizados === 'object') {
            Object.keys(personalizados).forEach((dayLabel) => {
                const days = extractDayKeys(dayLabel);
                days.forEach((dayKey) => {
                    map[dayKey] = mergePeriod(map[dayKey], 'custom');
                });
            });
        }

        return map;
    };

    const getPersonalizedSlots = (volunteer) => {
        const horarios = volunteer?.horariosPersonalizados || null;
        const customList = [];
        let hasStructuredCustomRanges = false;

        if (Array.isArray(horarios)) {
            customList.push(...horarios.filter(Boolean));
        } else if (horarios && typeof horarios === 'object') {
            hasStructuredCustomRanges = true;
            Object.entries(horarios).forEach(([dayLabel, range]) => {
                const start = range?.start || '';
                const end = range?.end || '';
                if (start && end) {
                    customList.push(`${dayLabel}: ${start} - ${end}`);
                } else if (start || end) {
                    customList.push(`${dayLabel}: ${start || '--'} - ${end || '--'}`);
                } else {
                    customList.push(`${dayLabel}: Personalizado`);
                }
            });
        }

        const customFromTurnos = hasStructuredCustomRanges
            ? []
            : (Array.isArray(volunteer?.turnos) ? volunteer.turnos : [])
                .filter((slot) => normalize(slot).includes('personalizado'))
                .map((slot) => slot.replace('-', ': '));
        return Array.from(new Set([...customList, ...customFromTurnos]));
    };

    const getAdditionalComments = (volunteer) => (
        volunteer?.comentariosAdicionales
        || volunteer?.comentarioAdicional
        || volunteer?.comentarios
        || volunteer?.observaciones
        || '-'
    );

    const toDateInputValue = (value) => {
        if (!value) return '';
        const dateObj = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
        if (Number.isNaN(dateObj.getTime())) return '';
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getTodayDateValue = () => toDateInputValue(new Date());

    const shiftDateValue = (baseValue, offsetDays = 0) => {
        const base = baseValue ? new Date(baseValue) : new Date();
        if (Number.isNaN(base.getTime())) return '';
        base.setDate(base.getDate() + offsetDays);
        return toDateInputValue(base);
    };

    const formatDatePreview = (value) => {
        if (!value) return '';
        const dateObj = new Date(value);
        if (Number.isNaN(dateObj.getTime())) return '';
        return dateObj.toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const isVolunteerCategory = (category) => {
        if (Array.isArray(category)) {
            return category.some((item) => String(item || '').toLowerCase().includes('volunt'));
        }
        return String(category || '').toLowerCase().includes('volunt');
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch form inscriptions
                let tmpVols = [];
                try {
                    const q = query(collection(db, 'voluntarios2026'), orderBy('fechaRegistro', 'desc'));
                    const qSnap = await getDocs(q);
                    qSnap.forEach(d => tmpVols.push({ id: d.id, ...d.data() }));
                } catch (err) {
                    console.warn('Index missing, using default query', err);
                    const q2 = query(collection(db, 'voluntarios2026'));
                    const qSnap2 = await getDocs(q2);
                    qSnap2.forEach(d => tmpVols.push({ id: d.id, ...d.data() }));
                }
                setVolunteers(tmpVols);

                // 2. Fetch standard events focused on volunteer attendance
                const [regSnap, eventsSnap] = await Promise.all([
                    getDocs(collection(db, 'registrations')),
                    getDocs(collection(db, 'events')),
                ]);
                const regData = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const events = {};
                const eventMetaByTitle = {};
                const volunteerEventById = {};
                const volunteerTitleByLower = {};

                eventsSnap.docs.forEach((d) => {
                    const payload = d.data() || {};
                    const title = String(payload.title || '').trim();
                    if (!title) return;
                    if (!isVolunteerCategory(payload.category) && !String(payload.categoryName || '').toLowerCase().includes('volunt')) return;

                    if (!events[title]) events[title] = [];
                    eventMetaByTitle[title] = { id: d.id, ...payload };
                    volunteerEventById[d.id] = { id: d.id, ...payload };
                    volunteerTitleByLower[title.toLowerCase()] = title;
                });

                regData.forEach((reg) => {
                    const evtNameRaw = String(reg.eventName || '').trim();
                    const evtName = evtNameRaw || 'Sin evento';
                    const evtNameLower = evtName.toLowerCase();
                    const regEventId = String(reg.eventId || '').trim();
                    const matchedById = regEventId && volunteerEventById[regEventId];
                    const matchedTitle = volunteerTitleByLower[evtNameLower];
                    const includeByKeyword = evtNameLower.includes('voluntari');

                    if (!matchedById && !matchedTitle && !includeByKeyword) return;

                    const canonicalEventName = matchedById?.title || matchedTitle || evtName;
                    if (!events[canonicalEventName]) events[canonicalEventName] = [];

                    events[canonicalEventName].push({
                        id: reg.id,
                        userName: reg.userName,
                        userEmail: reg.userEmail,
                        statusAsistencia: reg.statusAsistencia,
                        tipoAsistencia: reg.tipoAsistencia
                    });
                });
                
                setEventData(events);
                setVolunteerEventMeta(eventMetaByTitle);
                const evNames = Object.keys(events);
                if (evNames.length > 0) {
                    setSelectedEvent((prev) => (prev && evNames.includes(prev) ? prev : evNames[0]));
                }
                
                setLoading(false);
            } catch (err) {
                console.error('Error fetching data:', err);
                toast({ title: 'Error', description: 'No se pudieron cargar los datos de Firebase.', variant: 'destructive' });
                setLoading(false);
            }
        };
        fetchData();
    }, [toast]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            toast({ title: 'Error', description: 'Problema al cerrar sesión.', variant: 'destructive' });
        }
    };

    const handleExportExcel = () => {
        if (volunteers.length === 0) return;
        const exportData = volunteers.map((v, i) => ({
            '#': i + 1,
            'Nombre': v.fullName || '',
            'Edad': v.edad || '',
            'Correo': v.email || '',
            'WhatsApp': v.whatsapp || '',
            'Ciudad': v.ciudad || '',
            'Talla': v.talla || '',
            'Procedencia': v.procedencia || '',
            'Comentarios': getAdditionalComments(v),
            'Créditos': v.creditos || 0,
            'Turnos Fijos': Array.isArray(v.turnos) ? v.turnos.join(', ') : (v.turnos || ''),
            'Horarios Personalizados': getPersonalizedSlots(v).join(', '),
            'Fecha Registro': v.fechaRegistro && typeof v.fechaRegistro.toDate === 'function' ? v.fechaRegistro.toDate().toLocaleString() : ''
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Voluntarios');
        XLSX.writeFile(wb, 'Voluntarios_2026.xlsx');
        toast({ title: 'Exportación exitosa', description: 'El archivo Excel se descargó.' });
    };

    // Bulk Delete Feature
    const handleDeleteSelected = async () => {
        if (!window.confirm(`¿Seguro que deseas eliminar permanentemente ${selectedVols.length} voluntarios seleccionados?`)) return;
        try {
            for (const id of selectedVols) {
                await deleteDoc(doc(db, 'voluntarios2026', id));
            }
            setVolunteers(prev => prev.filter(v => !selectedVols.includes(v.id)));
            setSelectedVols([]);
            toast({ title: 'Éxito', description: 'Voluntarios eliminados satisfactoriamente.' });
        } catch (err) {
            toast({ title: 'Error', description: 'Hubo un problema al eliminar los registros.', variant: 'destructive' });
        }
    };

    const handleSaveCredits = async () => {
        if (!creditEditor.volunteerId) return;
        try {
            const updated = Math.max(0, Number(creditEditor.tempCredits) || 0);
            await updateDoc(doc(db, 'voluntarios2026', creditEditor.volunteerId), { creditos: updated });
            setVolunteers(prev => prev.map(v => v.id === creditEditor.volunteerId ? { ...v, creditos: updated } : v));
            setCreditEditor({ open: false, volunteerId: null, volunteerName: '', tempCredits: 0 });
            toast({ title: 'Créditos actualizados', description: 'Se guardaron los cambios.' });
        } catch (err) {
            toast({ title: 'Error', description: 'No se pudieron actualizar los créditos.', variant: 'destructive' });
        }
    };

    const resetEventForm = () => {
        setEventForm({
            imageFile: null,
            imagePreviewUrl: '',
            attendanceOptions: ['Presencial', 'Virtual'],
            confirmationMessage: '',
            title: '',
            date: '',
            time: '',
            location: '',
            category: 'voluntariado',
            capacity: '',
            description: ''
        });
    };

    const getCroppedFileFromPixels = async (imageSrc, pixelCrop, originalName) => {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imageSrc;
        });

        const canvas = document.createElement('canvas');
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        const safeName = (originalName || 'evento').replace(/\.[^/.]+$/, '');
        return new File([blob], `${safeName}-cropped-16x9.jpg`, { type: 'image/jpeg' });
    };

    const handleEventImageChange = (file) => {
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setImageToCrop({ file, url: preview });
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
        setShowImageCropperModal(true);
    };

    const handleApplyImageCrop = async () => {
        if (!imageToCrop.file || !croppedAreaPixels) return;
        try {
            const cropped = await getCroppedFileFromPixels(imageToCrop.url, croppedAreaPixels, imageToCrop.file.name);
            const preview = URL.createObjectURL(cropped);
            setEventForm(prev => ({
                ...prev,
                imageFile: cropped,
                imagePreviewUrl: preview
            }));
            setShowImageCropperModal(false);
            toast({ title: 'Recorte aplicado', description: 'La imagen se ajustó al formato del card (16:9).' });
        } catch (error) {
            console.error('Error recortando imagen:', error);
            toast({ title: 'Error', description: 'No se pudo recortar la imagen.', variant: 'destructive' });
        }
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();

        if (!eventForm.title.trim() || !eventForm.date) {
            toast({ title: 'Campos requeridos', description: 'Completa al menos título y fecha.', variant: 'destructive' });
            return;
        }

        if (!eventForm.attendanceOptions.length) {
            toast({ title: 'Tipo de asistencia requerido', description: 'Selecciona al menos una modalidad permitida.', variant: 'destructive' });
            return;
        }

        setCreatingEvent(true);
        try {
            let imagePayload = null;

            if (eventForm.imageFile) {
                const safeName = eventForm.imageFile.name.replace(/\s+/g, '-');
                const path = `events/${Date.now()}-${safeName}`;
                const fileRef = storageRef(storage, path);
                await uploadBytes(fileRef, eventForm.imageFile);
                const downloadURL = await getDownloadURL(fileRef);
                imagePayload = { ref: path, downloadURL };
            }

            const dateObj = new Date(`${eventForm.date}T00:00:00`);

            await addDoc(collection(db, 'events'), {
                title: eventForm.title.trim(),
                date: dateObj,
                time: eventForm.time.trim() || '',
                location: eventForm.location.trim() || '',
                category: ['voluntariado'],
                categoryName: 'Voluntariado',
                description: eventForm.description.trim() || '',
                capacity: eventForm.capacity ? Number(eventForm.capacity) : null,
                tipoAsistenciaOptions: eventForm.attendanceOptions,
                tipoAsistencia: eventForm.attendanceOptions,
                mensajeConfirmacion: eventForm.confirmationMessage.trim(),
                visible: true,
                soldOut: false,
                image: imagePayload,
                imageUrl: imagePayload,
                createdAt: serverTimestamp()
            });

            setEventData((prev) => ({ ...prev, [eventForm.title.trim()]: prev[eventForm.title.trim()] || [] }));
            toast({ title: 'Evento creado', description: 'El evento fue creado correctamente.' });
            setShowCreateEventModal(false);
            resetEventForm();
        } catch (error) {
            console.error('Error al crear evento:', error);
            toast({ title: 'Error', description: 'No se pudo crear el evento.', variant: 'destructive' });
        } finally {
            setCreatingEvent(false);
        }
    };

    const generateCertificatesForSelectedEvent = async () => {
        if (!selectedEvent) {
            toast({ title: 'Selecciona un evento', description: 'Debes elegir un evento primero.', variant: 'destructive' });
            return;
        }

        if (!auth.currentUser) {
            toast({ title: 'Sesión no válida', description: 'Inicia sesión de nuevo para generar certificados.', variant: 'destructive' });
            return;
        }

        setGeneratingCertificates(true);
        try {
            await auth.currentUser.getIdToken();
            const functions = getFunctions(undefined, 'us-central1');
            const callable = httpsCallable(functions, 'generateCertificates');
            const res = await callable({ eventName: selectedEvent });
            const { created = 0, skipped = 0, errors = [] } = res.data || {};
            toast({
                title: 'Certificados procesados',
                description: `Generados: ${created}. Omitidos: ${skipped}.${errors.length ? ` Errores: ${errors.length}.` : ''}`,
            });
            setShowCertificatesModal(false);
        } catch (error) {
            console.error('Error generando certificados:', error);
            toast({ title: 'Error', description: getCallableErrorMessage(error), variant: 'destructive' });
        } finally {
            setGeneratingCertificates(false);
        }
    };

    const assignCreditsToEventParticipants = async () => {
        if (!selectedEvent) {
            toast({ title: 'Selecciona un evento', description: 'Debes elegir un evento primero.', variant: 'destructive' });
            return;
        }

        const points = Number.parseInt(creditsToAssign, 10);
        if (!Number.isFinite(points) || points <= 0) {
            toast({ title: 'Créditos inválidos', description: 'Ingresa una cantidad mayor a 0.', variant: 'destructive' });
            return;
        }

        const participants = (eventData[selectedEvent] || []).filter((r) => {
            if (!onlyPresentForCredits) return true;
            return isPresent(r.statusAsistencia);
        });

        if (participants.length === 0) {
            toast({ title: 'Sin participantes', description: 'No hay participantes para asignar créditos.', variant: 'destructive' });
            return;
        }

        const volunteerByEmail = new Map(
            volunteers
                .filter((v) => (v.email || '').trim())
                .map((v) => [String(v.email).toLowerCase().trim(), v])
        );

        let updated = 0;
        let skipped = 0;
        setAssigningCredits(true);

        try {
            for (const p of participants) {
                const email = String(p.userEmail || '').toLowerCase().trim();
                if (!email) {
                    skipped += 1;
                    continue;
                }

                const volunteer = volunteerByEmail.get(email);
                if (!volunteer?.id) {
                    skipped += 1;
                    continue;
                }

                await updateDoc(doc(db, 'voluntarios2026', volunteer.id), {
                    creditos: increment(points)
                });
                updated += 1;
            }

            if (updated > 0) {
                setVolunteers((prev) => prev.map((v) => {
                    const isTarget = participants.some((p) => String(p.userEmail || '').toLowerCase().trim() === String(v.email || '').toLowerCase().trim());
                    return isTarget ? { ...v, creditos: (v.creditos || 0) + points } : v;
                }));
            }

            toast({ title: 'Créditos asignados', description: `Actualizados: ${updated}. Omitidos: ${skipped}.` });
            setShowAssignCreditsModal(false);
        } catch (error) {
            console.error('Error asignando créditos:', error);
            toast({ title: 'Error', description: 'No se pudieron asignar créditos.', variant: 'destructive' });
        } finally {
            setAssigningCredits(false);
        }
    };

    const openEditEventModal = () => {
        if (!selectedEvent) return;
        const meta = volunteerEventMeta[selectedEvent];
        if (!meta?.id) {
            toast({ title: 'Evento no editable', description: 'Este evento no existe en la colección events todavía.', variant: 'destructive' });
            return;
        }

        const optionsRaw = Array.isArray(meta.tipoAsistenciaOptions)
            ? meta.tipoAsistenciaOptions
            : Array.isArray(meta.tipoAsistencia)
                ? meta.tipoAsistencia
                : ['Presencial', 'Virtual'];
        const options = optionsRaw.filter(Boolean);

        setEventEditForm({
            id: meta.id,
            title: meta.title || selectedEvent,
            date: toDateInputValue(meta.date),
            time: meta.time || '',
            location: meta.location || '',
            capacity: meta.capacity ?? '',
            description: meta.description || '',
            visible: meta.visible !== false,
            soldOut: meta.soldOut === true || meta.isFull === true || meta.cupoLleno === true,
            attendanceOptions: options.length ? options : ['Presencial', 'Virtual'],
            confirmationMessage: (meta.mensajeConfirmacion || meta.confirmMessage || '').toString(),
        });
        setShowEditEventModal(true);
    };

    const saveEventChanges = async () => {
        if (!eventEditForm.id) return;
        if (!eventEditForm.title.trim()) {
            toast({ title: 'Título requerido', description: 'Ingresa un título para el evento.', variant: 'destructive' });
            return;
        }
        if (!eventEditForm.date) {
            toast({ title: 'Fecha requerida', description: 'Selecciona una fecha para el evento.', variant: 'destructive' });
            return;
        }
        if (!eventEditForm.attendanceOptions.length) {
            toast({ title: 'Asistencia requerida', description: 'Selecciona al menos una modalidad.', variant: 'destructive' });
            return;
        }

        const parsedDate = new Date(eventEditForm.date);
        if (Number.isNaN(parsedDate.getTime())) {
            toast({ title: 'Fecha inválida', description: 'La fecha seleccionada no es válida.', variant: 'destructive' });
            return;
        }

        const updates = {
            title: eventEditForm.title.trim(),
            date: parsedDate,
            time: eventEditForm.time.trim(),
            location: eventEditForm.location.trim(),
            capacity: eventEditForm.capacity === '' ? null : Number(eventEditForm.capacity),
            description: eventEditForm.description.trim(),
            visible: eventEditForm.visible,
            soldOut: eventEditForm.soldOut,
            tipoAsistenciaOptions: eventEditForm.attendanceOptions,
            tipoAsistencia: eventEditForm.attendanceOptions,
            mensajeConfirmacion: eventEditForm.confirmationMessage.trim(),
            category: ['voluntariado'],
            categoryName: 'Voluntariado',
        };

        try {
            await updateDoc(doc(db, 'events', eventEditForm.id), updates);

            const oldTitle = selectedEvent;
            const newTitle = eventEditForm.title.trim();

            setVolunteerEventMeta((prev) => {
                const copy = { ...prev };
                delete copy[oldTitle];
                copy[newTitle] = { ...(prev[oldTitle] || {}), id: eventEditForm.id, ...updates };
                return copy;
            });

            setEventData((prev) => {
                const copy = { ...prev };
                const existingRows = copy[oldTitle] || [];
                delete copy[oldTitle];
                copy[newTitle] = existingRows;
                return copy;
            });

            setSelectedEvent(newTitle);
            setShowEditEventModal(false);
            toast({ title: 'Evento actualizado', description: 'Los cambios se guardaron correctamente.' });
        } catch (error) {
            console.error('Error actualizando evento:', error);
            toast({ title: 'Error', description: 'No se pudo actualizar el evento.', variant: 'destructive' });
        }
    };

    const openCreditsEditor = (volunteer) => {
        setCreditEditor({
            open: true,
            volunteerId: volunteer.id,
            volunteerName: volunteer.fullName || 'Voluntario',
            tempCredits: volunteer.creditos || 0
        });
    };

    const applyAdvancedFilters = () => {
        setSortBy(filtersDraft.sortBy);
        setProcedenciaFilter(filtersDraft.procedenciaFilter);
        setAvailabilityDayFilter(filtersDraft.availabilityDayFilter);
        setShowFiltersModal(false);
    };

    const resetAdvancedFilters = () => {
        const reset = { sortBy: 'recent', procedenciaFilter: 'all', availabilityDayFilter: 'all' };
        setFiltersDraft(reset);
        setSortBy('recent');
        setProcedenciaFilter('all');
        setAvailabilityDayFilter('all');
    };

    const procedenciaOptions = useMemo(() => {
        const vals = volunteers
            .map(v => (v.procedencia || '').trim())
            .filter(Boolean);
        return Array.from(new Set(vals)).sort((a, b) => a.localeCompare(b));
    }, [volunteers]);

    // Processed Data
    const processedVols = useMemo(() => {
        let res = [...volunteers];
        
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            res = res.filter(v => 
                (v.fullName || '').toLowerCase().includes(q) ||
                (v.email || '').toLowerCase().includes(q)
            );
        }

        if (procedenciaFilter !== 'all') {
            res = res.filter(v => (v.procedencia || '').toLowerCase() === procedenciaFilter.toLowerCase());
        }

        if (availabilityDayFilter !== 'all') {
            res = res.filter((v) => {
                const map = getAvailabilityMap(v);
                return Boolean(map[availabilityDayFilter]);
            });
        }
        
        if (sortBy === 'credits_desc') {
            res.sort((a,b) => (b.creditos || 0) - (a.creditos || 0));
        } else if (sortBy === 'credits_asc') {
            res.sort((a,b) => (a.creditos || 0) - (b.creditos || 0));
        } else if (sortBy === 'alphabetic_asc') {
            res.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        } else if (sortBy === 'procedencia_asc') {
            res.sort((a, b) => (a.procedencia || '').localeCompare(b.procedencia || ''));
        } else {
            res.sort((a, b) => {
                const aDate = a.fechaRegistro && typeof a.fechaRegistro.toDate === 'function' ? a.fechaRegistro.toDate().getTime() : 0;
                const bDate = b.fechaRegistro && typeof b.fechaRegistro.toDate === 'function' ? b.fechaRegistro.toDate().getTime() : 0;
                return bDate - aDate;
            });
        }
        
        return res;
    }, [volunteers, searchQuery, sortBy, procedenciaFilter, availabilityDayFilter]);

    const isPresent = (val) => {
        if (typeof val === 'string') return val.toLowerCase() === 'presente' || val.toLowerCase() === 'present';
        return Boolean(val);
    };

    const nextStatusValue = (val) => {
        const toPresent = !isPresent(val);
        if (typeof val === 'string') return toPresent ? 'Presente' : 'Ausente';
        return toPresent;
    };

    const toggleAttendance = async (reg) => {
        const prev = reg.statusAsistencia;
        const updated = nextStatusValue(prev);
        setEventData(prevMap => {
            const copy = { ...prevMap };
            copy[selectedEvent] = copy[selectedEvent].map(r => r.id === reg.id ? { ...r, statusAsistencia: updated } : r);
            return copy;
        });
        try {
            await updateDoc(doc(db, 'registrations', reg.id), { statusAsistencia: updated });
            toast({ title: 'Asistencia actualizada', description: `${reg.userName || 'Usuario'}: ${updated ? 'Presente' : 'Ausente'}` });
        } catch (e) {
            setEventData(prevMap => {
                const copy = { ...prevMap };
                copy[selectedEvent] = copy[selectedEvent].map(r => r.id === reg.id ? { ...r, statusAsistencia: prev } : r);
                return copy;
            });
            toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' });
        }
    };

    const currentList = useMemo(() => {
        const list = eventData[selectedEvent] || [];
        return [...list].sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));
    }, [eventData, selectedEvent]);

    const stats = useMemo(() => {
        const list = eventData[selectedEvent] || [];
        const present = list.filter((r) => isPresent(r.statusAsistencia)).length;
        return { present, absent: list.length - present, total: list.length };
    }, [eventData, selectedEvent]);

    return (
        <div className="min-h-screen bg-boreal-dark text-white font-sans flex flex-col">
            <Helmet>
                <title>Panel de Voluntariado - Boreal Labs</title>
                <meta name="robots" content="noindex,nofollow" />
            </Helmet>

            <div className="flex-grow pt-24 px-6 pb-6 max-w-7xl mx-auto w-full space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161c2d] p-6 rounded-2xl border border-white/5 shadow-2xl">
                    <div>
                        <h1 className="text-3xl items-center font-bold bg-clip-text text-transparent bg-gradient-to-r from-boreal-aqua to-boreal-purple pb-1 flex gap-3">
                            <Users className="w-8 h-8 text-boreal-aqua" />
                            Gestión de Voluntariado
                        </h1>
                        <p className="text-gray-400 mt-2 max-w-2xl text-sm leading-relaxed">
                            Panel administrativo exclusivo para coordinar a los voluntarios de la Jornada 2026.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={handleLogout} variant="outline" className="border-white/10 hover:bg-white/5 text-gray-300 hover:text-white">
                            <LogOut className="w-4 h-4 mr-2" /> Salir
                        </Button>
                    </div>
                </div>

                <div className="flex bg-[#161c2d] p-1.5 rounded-xl border border-white/5 w-fit">
                    <button
                        onClick={() => setActiveTab('inscripciones')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'inscripciones' 
                            ? 'bg-gradient-to-r from-boreal-aqua/20 to-boreal-purple/20 text-white shadow-lg border border-white/5' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }`}
                    >
                        <Users className="w-4 h-4" /> Voluntarios
                    </button>
                    <button
                        onClick={() => setActiveTab('asistencia')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'asistencia' 
                            ? 'bg-gradient-to-r from-boreal-aqua/20 to-boreal-purple/20 text-white shadow-lg border border-white/5' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }`}
                    >
                        <Calendar className="w-4 h-4" /> Gestion de Eventos
                    </button>
                </div>

                <div className="bg-[#161c2d] rounded-2xl border border-white/5 shadow-xl p-6 min-h-[500px]">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-64 space-y-4">
                            <div className="w-12 h-12 border-4 border-boreal-aqua border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-400">Cargando datos...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'inscripciones' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-4">
                                        <h2 className="text-xl font-bold flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-boreal-aqua" /> Registros ({processedVols.length})
                                        </h2>
                                        
                                        {/* Controles: Buscar, Filtrar, Ocultar/Mostrar, Eliminar, Exportar */}
                                        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center p-3 bg-white/5 rounded-xl border border-white/5">
                                            
                                            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                                                <div className="relative flex-grow md:w-64 max-w-sm">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Buscar por nombre o correo..." 
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-boreal-aqua transition-colors"
                                                    />
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setFiltersDraft({ sortBy, procedenciaFilter, availabilityDayFilter });
                                                        setShowFiltersModal(true);
                                                    }}
                                                    className="bg-[#0a0f1b] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none hover:bg-white/5 cursor-pointer transition-colors inline-flex items-center gap-2"
                                                >
                                                    <SlidersHorizontal className="w-4 h-4" />
                                                    Clasificar y filtrar
                                                </button>
                                                
                                                <div className="relative">
                                                    <button 
                                                        onClick={() => setShowColMenu(!showColMenu)} 
                                                        title="Configurar columnas"
                                                        className="p-2.5 bg-[#0a0f1b] border border-white/10 rounded-lg hover:bg-white/5 text-gray-300 transition-colors flex items-center justify-center"
                                                    >
                                                        <Menu className="w-4 h-4" />
                                                    </button>
                                                    {showColMenu && (
                                                        <div className="absolute top-full right-0 lg:left-0 lg:right-auto mt-2 z-50 w-56 bg-[#161c2d] border border-white/10 rounded-xl shadow-2xl p-4 flex flex-col gap-2">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mostrar Columnas</h3>
                                                                <button onClick={() => setShowColMenu(false)} className="text-gray-500 hover:text-white"><XCircle className="w-4 h-4" /></button>
                                                            </div>
                                                            {Object.keys(visibleCols).map(col => (
                                                                <label key={col} className="flex items-center gap-3 text-sm text-gray-200 cursor-pointer hover:bg-white/5 p-1 rounded-md">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={visibleCols[col]} 
                                                                        onChange={() => setVisibleCols({...visibleCols, [col]: !visibleCols[col]})} 
                                                                        className="accent-boreal-aqua w-4 h-4" 
                                                                    />
                                                                    <span>{columnLabels[col] || col}</span>
                                                                </label>
                                                            ))}
                                                            <label className="flex items-center gap-3 text-sm text-gray-200 cursor-pointer hover:bg-white/5 p-1 rounded-md mt-1 border-t border-white/10 pt-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectionEnabled}
                                                                    onChange={(e) => {
                                                                        setSelectionEnabled(e.target.checked);
                                                                        if (!e.target.checked) setSelectedVols([]);
                                                                    }}
                                                                    className="accent-boreal-aqua w-4 h-4"
                                                                />
                                                                <span>Habilitar selección</span>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                                                {selectionEnabled && selectedVols.length > 0 && (
                                                    <Button 
                                                        onClick={handleDeleteSelected} 
                                                        variant="destructive" 
                                                        className="bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/20"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar ({selectedVols.length})
                                                    </Button>
                                                )}
                                                <Button 
                                                    onClick={handleExportExcel} 
                                                    disabled={volunteers.length === 0}
                                                    className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold rounded-lg"
                                                >
                                                    <Download className="w-4 h-4 md:mr-2" />
                                                    <span className="hidden md:inline">Exportar Excel</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {processedVols.length > 0 ? (
                                        <div className="overflow-x-auto rounded-xl border border-white/10 pb-4">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-[#0a0f1b] text-gray-300">
                                                    <tr>
                                                        {selectionEnabled && (
                                                            <th className="px-4 py-4 border-b border-white/10 font-semibold w-12 text-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={selectedVols.length === processedVols.length && processedVols.length > 0}
                                                                    onChange={(e) => setSelectedVols(e.target.checked ? processedVols.map(v => v.id) : [])}
                                                                    className="accent-boreal-aqua w-4 h-4 cursor-pointer"
                                                                />
                                                            </th>
                                                        )}
                                                        <th className="px-4 py-4 border-b border-white/10 font-semibold">Nombre</th>
                                                        {visibleCols.edad && <th className="px-4 py-4 border-b border-white/10 font-semibold">Edad</th>}
                                                        {visibleCols.talla && <th className="px-4 py-4 border-b border-white/10 font-semibold">Talla</th>}
                                                        {visibleCols.contacto && <th className="px-4 py-4 border-b border-white/10 font-semibold">Contacto</th>}
                                                        {visibleCols.ubicacion && <th className="px-4 py-4 border-b border-white/10 font-semibold">Ubicación</th>}
                                                        {visibleCols.disponibilidad && <th className="px-4 py-4 border-b border-white/10 font-semibold">Disponibilidad de Horarios</th>}
                                                        {visibleCols.comentarios && <th className="px-4 py-4 border-b border-white/10 font-semibold">Comentarios</th>}
                                                        {visibleCols.creditos && <th className="px-4 py-4 border-b border-white/10 font-semibold text-center">Créditos</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-400">
                                                    {processedVols.map((vol) => (
                                                        <tr key={vol.id} className={`hover:bg-white-[0.02] transition-colors ${selectedVols.includes(vol.id) ? 'bg-white/5' : ''}`}>
                                                            {selectionEnabled && (
                                                                <td className="px-4 py-3 text-center">
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={selectedVols.includes(vol.id)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) setSelectedVols(prev => [...prev, vol.id]);
                                                                            else setSelectedVols(prev => prev.filter(id => id !== vol.id));
                                                                        }}
                                                                        className="accent-boreal-aqua w-4 h-4 cursor-pointer"
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3 font-medium text-white">{vol.fullName}</td>
                                                            
                                                            {visibleCols.edad && <td className="px-4 py-3">{vol.edad}</td>}
                                                            {visibleCols.talla && <td className="px-4 py-3">{vol.talla || '-'}</td>}
                                                            
                                                            {visibleCols.contacto && (
                                                                <td className="px-4 py-3">
                                                                    <div>{vol.email}</div>
                                                                    <div className="text-xs text-boreal-aqua mt-0.5">{vol.whatsapp}</div>
                                                                </td>
                                                            )}
                                                            
                                                            {visibleCols.ubicacion && (
                                                                <td className="px-4 py-3">
                                                                    <div>{vol.ciudad}</div>
                                                                    <div className="text-xs text-gray-500 mt-0.5">{vol.procedencia}</div>
                                                                </td>
                                                            )}
                                                            
                                                            {visibleCols.disponibilidad && (
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-wrap items-center gap-1.5 min-w-[230px]">
                                                                        {dayDefinitions.map((day) => {
                                                                            const availability = getAvailabilityMap(vol)[day.key];
                                                                            if (!availability) return null;
                                                                            return (
                                                                                <button
                                                                                    key={day.key}
                                                                                    onClick={() => setAvailabilityDetail({ open: true, volunteer: vol })}
                                                                                    className={`w-7 h-7 rounded-full text-xs font-bold transition-colors ${periodStyles[availability]}`}
                                                                                    title={`${day.key}: ${periodLabels[availability]}`}
                                                                                >
                                                                                    {day.initial}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                        <button
                                                                            onClick={() => setAvailabilityDetail({ open: true, volunteer: vol })}
                                                                            className="ml-1 px-2 py-1 text-[11px] rounded-md border border-white/15 text-gray-200 hover:bg-white/10"
                                                                        >
                                                                            Ver detalle
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}

                                                            {visibleCols.comentarios && (
                                                                <td className="px-4 py-3 max-w-[260px] whitespace-normal text-xs text-gray-300">
                                                                    {getAdditionalComments(vol)}
                                                                </td>
                                                            )}
                                                            
                                                            {visibleCols.creditos && (
                                                                <td className="px-4 py-3">
                                                                    <button
                                                                        onClick={() => openCreditsEditor(vol)}
                                                                        className="font-bold text-lg text-white min-w-10 text-center tabular-nums px-3 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                                                                        title="Editar créditos"
                                                                    >
                                                                        {vol.creditos || 0}
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 flex flex-col items-center gap-3 bg-white/5 rounded-xl border border-white/5">
                                            <Search className="w-12 h-12 text-white/10" />
                                            <p className="text-gray-500">No se encontraron voluntarios con los filtros actuales.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'asistencia' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                            <h2 className="text-xl font-bold flex items-center gap-2">
                                                <Calendar className="w-5 h-5 text-boreal-purple" /> Gestion de Eventos
                                            </h2>

                                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                                {Object.keys(eventData).length > 0 ? (
                                                    <select
                                                        value={selectedEvent}
                                                        onChange={e => setSelectedEvent(e.target.value)}
                                                        className="bg-[#0a0f1b] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none min-w-[240px]"
                                                    >
                                                        {Object.keys(eventData).map(evt => (
                                                            <option key={evt} value={evt}>{evt}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-sm text-gray-500">No hay eventos de voluntariado</span>
                                                )}

                                                <Button
                                                    type="button"
                                                    onClick={() => setShowCreateEventModal(true)}
                                                    className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold"
                                                >
                                                    Crear evento
                                                </Button>
                                                <Button
                                                    type="button"
                                                    onClick={openEditEventModal}
                                                    className="bg-white/10 hover:bg-white/20 border border-white/15 text-white"
                                                >
                                                    Editar evento
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            <Button
                                                type="button"
                                                onClick={() => setShowCertificatesModal(true)}
                                                className="bg-boreal-purple/20 hover:bg-boreal-purple/30 border border-boreal-purple/30 text-white"
                                            >
                                                Generar certificados
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => setShowAssignCreditsModal(true)}
                                                className="bg-white/10 hover:bg-white/20 border border-white/15 text-white"
                                            >
                                                Asignar créditos
                                            </Button>
                                        </div>
                                    </div>

                                    {Object.keys(eventData).length > 0 && selectedEvent ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4 mb-6">
                                                <div className="bg-[#0a0f1b] p-4 rounded-xl border border-white/5 text-center">
                                                    <div className="text-2xl font-bold text-white">{stats.total}</div>
                                                    <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Inscritos</div>
                                                </div>
                                                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                                                    <div className="text-2xl font-bold text-emerald-400">{stats.present}</div>
                                                    <div className="text-xs text-emerald-500/70 uppercase tracking-wide mt-1">Asistieron</div>
                                                </div>
                                                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-center">
                                                    <div className="text-2xl font-bold text-red-400">{stats.absent}</div>
                                                    <div className="text-xs text-red-500/70 uppercase tracking-wide mt-1">Faltaron</div>
                                                </div>
                                            </div>

                                            <div className="overflow-hidden rounded-xl border border-white/10">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-[#0a0f1b] text-gray-300">
                                                        <tr>
                                                            <th className="px-4 py-4 font-semibold w-12">#</th>
                                                            <th className="px-4 py-4 font-semibold">Participante</th>
                                                            <th className="px-4 py-4 font-semibold">Contacto</th>
                                                            <th className="px-4 py-4 font-semibold text-center">Estado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5 text-gray-400">
                                                        {currentList.map((reg, index) => {
                                                            const present = isPresent(reg.statusAsistencia);
                                                            return (
                                                                <tr key={reg.id} className="hover:bg-white-[0.02] transition-colors">
                                                                    <td className="px-4 py-3">{index + 1}</td>
                                                                    <td className="px-4 py-3 text-white font-medium">{reg.userName}</td>
                                                                    <td className="px-4 py-3 text-xs">{reg.userEmail}</td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <button
                                                                            onClick={() => toggleAttendance(reg)}
                                                                            className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-all ${
                                                                                present
                                                                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ring-1 ring-emerald-500/50'
                                                                                    : 'bg-white/5 text-gray-500 hover:bg-white/10 ring-1 ring-white/10'
                                                                            }`}
                                                                            title={present ? 'Marcar Ausente' : 'Marcar Presente'}
                                                                        >
                                                                            {present ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 bg-white/5 rounded-xl border border-white/5">
                                            <p className="text-gray-500">No hay registros de asistencia asociados aún.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {showFiltersModal && (
                                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
                                    <div className="w-full max-w-lg bg-[#161c2d] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-white">Clasificar y filtrar voluntarios</h3>
                                            <button onClick={() => setShowFiltersModal(false)} className="text-gray-400 hover:text-white">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Ordenar por</label>
                                                <select
                                                    value={filtersDraft.sortBy}
                                                    onChange={(e) => setFiltersDraft(prev => ({ ...prev, sortBy: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
                                                >
                                                    <option value="recent">Más recientes</option>
                                                    <option value="alphabetic_asc">Orden alfabético (A-Z)</option>
                                                    <option value="procedencia_asc">Procedencia (A-Z)</option>
                                                    <option value="credits_desc">Mayor cantidad de créditos</option>
                                                    <option value="credits_asc">Menor cantidad de créditos</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Filtrar por procedencia</label>
                                                <select
                                                    value={filtersDraft.procedenciaFilter}
                                                    onChange={(e) => setFiltersDraft(prev => ({ ...prev, procedenciaFilter: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
                                                >
                                                    <option value="all">Todas</option>
                                                    {procedenciaOptions.map((item) => (
                                                        <option key={item} value={item}>{item}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Filtrar por día de disponibilidad</label>
                                                <select
                                                    value={filtersDraft.availabilityDayFilter}
                                                    onChange={(e) => setFiltersDraft(prev => ({ ...prev, availabilityDayFilter: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
                                                >
                                                    <option value="all">Cualquier día</option>
                                                    {dayDefinitions.map((day) => (
                                                        <option key={day.key} value={day.key}>{day.initial} - {day.key}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            <Button type="button" variant="outline" onClick={resetAdvancedFilters} className="border-white/15 text-gray-200 hover:bg-white/10">
                                                Resetear
                                            </Button>
                                            <Button type="button" onClick={applyAdvancedFilters} className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold">
                                                Aplicar filtros
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {availabilityDetail.open && availabilityDetail.volunteer && (
                                <div className="fixed inset-0 bg-black/60 z-[85] flex items-center justify-center p-4">
                                    <div className="w-full max-w-xl bg-[#161c2d] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Detalle de disponibilidad</h3>
                                            <button
                                                onClick={() => setAvailabilityDetail({ open: false, volunteer: null })}
                                                className="text-gray-400 hover:text-white"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <p className="text-sm text-gray-300">{availabilityDetail.volunteer.fullName || 'Voluntario'}</p>

                                        <div className="space-y-2">
                                            <p className="text-xs uppercase tracking-wider text-gray-400">Resumen por día</p>
                                            <div className="flex flex-wrap gap-2">
                                                {dayDefinitions.map((day) => {
                                                    const availability = getAvailabilityMap(availabilityDetail.volunteer)[day.key];
                                                    if (!availability) return null;
                                                    return (
                                                        <span key={day.key} className={`px-2 py-1 rounded-md text-xs font-semibold ${periodStyles[availability]}`}>
                                                            {day.initial}: {periodLabels[availability]} <span className="text-[10px] opacity-80">({periodShortLabels[availability]})</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Horarios personalizados</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {getPersonalizedSlots(availabilityDetail.volunteer).map((slot, i) => (
                                                    <span key={`custom-${i}`} className="px-2 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-md text-xs text-fuchsia-300">{slot}</span>
                                                ))}
                                                {getPersonalizedSlots(availabilityDetail.volunteer).length === 0 && (
                                                    <span className="text-xs text-gray-500">Sin horarios personalizados</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {creditEditor.open && (
                                <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
                                    <div className="w-full max-w-sm bg-[#161c2d] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Editar créditos</h3>
                                            <button
                                                onClick={() => setCreditEditor({ open: false, volunteerId: null, volunteerName: '', tempCredits: 0 })}
                                                className="text-gray-400 hover:text-white"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <p className="text-sm text-gray-300">{creditEditor.volunteerName}</p>

                                        <div className="flex items-center justify-center gap-4">
                                            <button
                                                onClick={() => setCreditEditor(prev => ({ ...prev, tempCredits: Math.max(0, (prev.tempCredits || 0) - 1) }))}
                                                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-gray-300"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="text-2xl font-bold text-white w-12 text-center tabular-nums">{creditEditor.tempCredits || 0}</span>
                                            <button
                                                onClick={() => setCreditEditor(prev => ({ ...prev, tempCredits: (prev.tempCredits || 0) + 1 }))}
                                                className="p-2 bg-boreal-aqua/10 hover:bg-boreal-aqua/20 border border-boreal-aqua/20 rounded-md text-boreal-aqua"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setCreditEditor({ open: false, volunteerId: null, volunteerName: '', tempCredits: 0 })}
                                                className="border-white/15 text-gray-200 hover:bg-white/10"
                                            >
                                                Cancelar
                                            </Button>
                                            <Button type="button" onClick={handleSaveCredits} className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold">
                                                Confirmar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showCreateEventModal && (
                                <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4">
                                    <div className="w-full max-w-2xl bg-[#161c2d] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-white">Crear evento</h3>
                                            <button
                                                onClick={() => {
                                                    setShowCreateEventModal(false);
                                                    resetEventForm();
                                                }}
                                                className="text-gray-400 hover:text-white"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <form onSubmit={handleCreateEvent} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1.5 md:col-span-2">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Imagen del evento (primero)</label>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => handleEventImageChange(e.target.files?.[0] || null)}
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-boreal-aqua/20 file:px-3 file:py-1 file:text-boreal-aqua"
                                                    />
                                                    {eventForm.imagePreviewUrl && (
                                                        <div className="space-y-2 mt-2">
                                                            <div className="aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/30">
                                                                <img src={eventForm.imagePreviewUrl} alt="Previsualización" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button type="button" onClick={() => setShowImageCropperModal(true)} className="bg-white/10 hover:bg-white/20 text-white border border-white/15">
                                                                    Ajustar recorte
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5 md:col-span-2">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Título del evento *</label>
                                                    <input
                                                        type="text"
                                                        value={eventForm.title}
                                                        onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                        required
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Fecha *</label>
                                                    <input
                                                        type="date"
                                                        value={eventForm.date}
                                                        onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                                                        min={getTodayDateValue()}
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                        required
                                                    />
                                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setEventForm(prev => ({ ...prev, date: shiftDateValue(prev.date, 0) }))}
                                                            className="px-2 py-1 rounded-md text-xs border border-white/15 text-gray-200 hover:bg-white/10"
                                                        >
                                                            Hoy
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEventForm(prev => ({ ...prev, date: shiftDateValue(prev.date, 1) }))}
                                                            className="px-2 py-1 rounded-md text-xs border border-white/15 text-gray-200 hover:bg-white/10"
                                                        >
                                                            Manana
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEventForm(prev => ({ ...prev, date: shiftDateValue(prev.date, 7) }))}
                                                            className="px-2 py-1 rounded-md text-xs border border-white/15 text-gray-200 hover:bg-white/10"
                                                        >
                                                            +7 dias
                                                        </button>
                                                    </div>
                                                    {eventForm.date && (
                                                        <p className="text-xs text-boreal-aqua/90">{formatDatePreview(eventForm.date)}</p>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Hora</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ej. 10:00 AM"
                                                        value={eventForm.time}
                                                        onChange={(e) => setEventForm(prev => ({ ...prev, time: e.target.value }))}
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Ubicación</label>
                                                    <input
                                                        type="text"
                                                        value={eventForm.location}
                                                        onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Categoría</label>
                                                    <input
                                                        type="text"
                                                        value="Voluntariado"
                                                        disabled
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 outline-none cursor-not-allowed"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Cupo</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={eventForm.capacity}
                                                        onChange={(e) => setEventForm(prev => ({ ...prev, capacity: e.target.value }))}
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                    />
                                                </div>

                                                <div className="space-y-1.5 md:col-span-2">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Descripción</label>
                                                    <textarea
                                                        rows="3"
                                                        value={eventForm.description}
                                                        onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                    />
                                                </div>

                                                <div className="space-y-1.5 md:col-span-2">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Tipo de asistencia permitida</label>
                                                    <div className="flex flex-wrap gap-4 bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2">
                                                        {['Presencial', 'Virtual'].map((opt) => (
                                                            <label key={opt} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={eventForm.attendanceOptions.includes(opt)}
                                                                    onChange={(e) => {
                                                                        setEventForm(prev => {
                                                                            const next = e.target.checked
                                                                                ? [...prev.attendanceOptions, opt]
                                                                                : prev.attendanceOptions.filter((v) => v !== opt);
                                                                            return { ...prev, attendanceOptions: Array.from(new Set(next)) };
                                                                        });
                                                                    }}
                                                                    className="accent-boreal-aqua w-4 h-4"
                                                                />
                                                                {opt}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 md:col-span-2">
                                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Mensaje de confirmación</label>
                                                    <textarea
                                                        rows="3"
                                                        value={eventForm.confirmationMessage}
                                                        onChange={(e) => setEventForm(prev => ({ ...prev, confirmationMessage: e.target.value }))}
                                                        placeholder="Mensaje opcional para mostrar después del registro"
                                                        className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                    />
                                                    <p className="text-[11px] text-gray-400">
                                                        Si la persona elige asistencia Virtual, se agregará automáticamente este texto al confirmar: 📍 Si tu asistencia es Virtual: Entrá aquí el día del taller: https://meet.google.com/nyx-nkmg-kwc
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end gap-2 pt-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setShowCreateEventModal(false);
                                                        resetEventForm();
                                                    }}
                                                    className="border-white/15 text-gray-200 hover:bg-white/10"
                                                    disabled={creatingEvent}
                                                >
                                                    Cancelar
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold"
                                                    disabled={creatingEvent}
                                                >
                                                    {creatingEvent ? 'Guardando...' : 'Guardar evento'}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {showImageCropperModal && imageToCrop.url && (
                                <div className="fixed inset-0 bg-black/70 z-[95] flex items-center justify-center p-4">
                                    <div className="w-full max-w-3xl bg-[#161c2d] border border-white/10 rounded-2xl shadow-2xl p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Recorta la imagen del evento</h3>
                                            <button
                                                onClick={() => setShowImageCropperModal(false)}
                                                className="text-gray-400 hover:text-white"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="relative w-full h-[360px] rounded-xl overflow-hidden bg-black">
                                            <Cropper
                                                image={imageToCrop.url}
                                                crop={crop}
                                                zoom={zoom}
                                                aspect={16 / 9}
                                                onCropChange={setCrop}
                                                onZoomChange={setZoom}
                                                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                                                objectFit="cover"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-400 uppercase tracking-wider">Zoom</label>
                                            <input
                                                type="range"
                                                min="1"
                                                max="3"
                                                step="0.01"
                                                value={zoom}
                                                onChange={(e) => setZoom(Number(e.target.value))}
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="flex items-center justify-end gap-2">
                                            <Button type="button" variant="outline" onClick={() => setShowImageCropperModal(false)} className="border-white/15 text-gray-200 hover:bg-white/10">
                                                Cancelar
                                            </Button>
                                            <Button type="button" onClick={handleApplyImageCrop} className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold">
                                                Aplicar recorte
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showCertificatesModal && (
                                <div className="fixed inset-0 bg-black/60 z-[96] flex items-center justify-center p-4">
                                    <div className="w-full max-w-md bg-[#161c2d] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Generar certificados</h3>
                                            <button onClick={() => setShowCertificatesModal(false)} className="text-gray-400 hover:text-white">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-300">Evento seleccionado: <span className="text-white font-medium">{selectedEvent || 'Ninguno'}</span></p>
                                        <p className="text-xs text-gray-400">Se emitirán certificados para los asistentes marcados como presentes en este evento.</p>
                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            <Button type="button" variant="outline" onClick={() => setShowCertificatesModal(false)} className="border-white/15 text-gray-200 hover:bg-white/10">
                                                Cancelar
                                            </Button>
                                            <Button type="button" onClick={generateCertificatesForSelectedEvent} className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold" disabled={generatingCertificates}>
                                                {generatingCertificates ? 'Generando...' : 'Generar'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showAssignCreditsModal && (
                                <div className="fixed inset-0 bg-black/60 z-[96] flex items-center justify-center p-4">
                                    <div className="w-full max-w-md bg-[#161c2d] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Asignar créditos</h3>
                                            <button onClick={() => setShowAssignCreditsModal(false)} className="text-gray-400 hover:text-white">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-300">Evento seleccionado: <span className="text-white font-medium">{selectedEvent || 'Ninguno'}</span></p>

                                        <div className="space-y-1.5">
                                            <label className="text-xs text-gray-400 uppercase tracking-wider">Cantidad de créditos</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={creditsToAssign}
                                                onChange={(e) => setCreditsToAssign(e.target.value)}
                                                className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                            />
                                        </div>

                                        <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={onlyPresentForCredits}
                                                onChange={(e) => setOnlyPresentForCredits(e.target.checked)}
                                                className="accent-boreal-aqua w-4 h-4"
                                            />
                                            Aplicar solo a participantes presentes
                                        </label>
                                        <p className="text-xs text-gray-400">Referencia: 1 crédito equivale aproximadamente a 2 horas de voluntariado.</p>

                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            <Button type="button" variant="outline" onClick={() => setShowAssignCreditsModal(false)} className="border-white/15 text-gray-200 hover:bg-white/10">
                                                Cancelar
                                            </Button>
                                            <Button type="button" onClick={assignCreditsToEventParticipants} className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold" disabled={assigningCredits}>
                                                {assigningCredits ? 'Asignando...' : 'Asignar'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showEditEventModal && (
                                <div className="fixed inset-0 bg-black/60 z-[97] flex items-center justify-center p-4">
                                    <div className="w-full max-w-2xl bg-[#161c2d] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-white">Editar evento de voluntariado</h3>
                                            <button onClick={() => setShowEditEventModal(false)} className="text-gray-400 hover:text-white">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Título</label>
                                                <input
                                                    type="text"
                                                    value={eventEditForm.title}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Fecha</label>
                                                <input
                                                    type="date"
                                                    value={eventEditForm.date}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, date: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                />
                                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEventEditForm(prev => ({ ...prev, date: shiftDateValue(prev.date, 0) }))}
                                                        className="px-2 py-1 rounded-md text-xs border border-white/15 text-gray-200 hover:bg-white/10"
                                                    >
                                                        Hoy
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEventEditForm(prev => ({ ...prev, date: shiftDateValue(prev.date, 1) }))}
                                                        className="px-2 py-1 rounded-md text-xs border border-white/15 text-gray-200 hover:bg-white/10"
                                                    >
                                                        Manana
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEventEditForm(prev => ({ ...prev, date: shiftDateValue(prev.date, 7) }))}
                                                        className="px-2 py-1 rounded-md text-xs border border-white/15 text-gray-200 hover:bg-white/10"
                                                    >
                                                        +7 dias
                                                    </button>
                                                </div>
                                                {eventEditForm.date && (
                                                    <p className="text-xs text-boreal-aqua/90">{formatDatePreview(eventEditForm.date)}</p>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Hora</label>
                                                <input
                                                    type="text"
                                                    value={eventEditForm.time}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, time: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Cupo</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={eventEditForm.capacity}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, capacity: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Ubicación</label>
                                                <input
                                                    type="text"
                                                    value={eventEditForm.location}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, location: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Descripción</label>
                                                <textarea
                                                    rows="3"
                                                    value={eventEditForm.description}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                />
                                            </div>

                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Tipo de asistencia permitida</label>
                                                <div className="flex flex-wrap gap-4 bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2">
                                                    {['Presencial', 'Virtual'].map((opt) => (
                                                        <label key={opt} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={eventEditForm.attendanceOptions.includes(opt)}
                                                                onChange={(e) => {
                                                                    setEventEditForm(prev => {
                                                                        const next = e.target.checked
                                                                            ? [...prev.attendanceOptions, opt]
                                                                            : prev.attendanceOptions.filter((v) => v !== opt);
                                                                        return { ...prev, attendanceOptions: Array.from(new Set(next)) };
                                                                    });
                                                                }}
                                                                className="accent-boreal-aqua w-4 h-4"
                                                            />
                                                            {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="text-xs text-gray-400 uppercase tracking-wider">Mensaje de confirmación</label>
                                                <textarea
                                                    rows="3"
                                                    value={eventEditForm.confirmationMessage}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, confirmationMessage: e.target.value }))}
                                                    className="w-full bg-[#0a0f1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                                />
                                            </div>

                                            <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={eventEditForm.visible}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, visible: e.target.checked }))}
                                                    className="accent-boreal-aqua w-4 h-4"
                                                />
                                                Evento visible
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={eventEditForm.soldOut}
                                                    onChange={(e) => setEventEditForm(prev => ({ ...prev, soldOut: e.target.checked }))}
                                                    className="accent-boreal-aqua w-4 h-4"
                                                />
                                                Marcar como lleno
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            <Button type="button" variant="outline" onClick={() => setShowEditEventModal(false)} className="border-white/15 text-gray-200 hover:bg-white/10">
                                                Cancelar
                                            </Button>
                                            <Button type="button" onClick={saveEventChanges} className="bg-boreal-aqua hover:bg-emerald-500 text-black font-semibold">
                                                Guardar cambios
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VolunteerAdminPanel;
