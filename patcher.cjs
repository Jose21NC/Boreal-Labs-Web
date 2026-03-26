const fs = require('fs');

const pathAdmin = 'src/pages/AdminPanel.jsx';
let adminCode = fs.readFileSync(pathAdmin, 'utf8');

adminCode = adminCode.replace(
    "const [editParticipantEmail, setEditParticipantEmail] = useState('');",
    "const [editParticipantEmail, setEditParticipantEmail] = useState('');\n    const [editParticipantCustomEventName, setEditParticipantCustomEventName] = useState('');"
);

adminCode = adminCode.replace(
    "        setEditParticipantEmail(activeParticipant.userEmail || '');\n        setEditParticipantOpen(true);",
    "        setEditParticipantEmail(activeParticipant.userEmail || '');\n        setEditParticipantCustomEventName(activeParticipant.customEventName || '');\n        setEditParticipantOpen(true);"
);

let oldSave = `    const handleSaveParticipant = async (e) => {
        e?.preventDefault?.();
        if (!activeParticipant?.id) return;
        const nextName = (editParticipantName || '').trim();
        const nextEmail = (editParticipantEmail || '').trim();
        if (!nextName || !nextEmail) {
            toast({ title: 'Nombre y email son obligatorios', variant: 'destructive' });
            return;
        }
        await updateRegistration(activeParticipant, { userName: nextName, userEmail: nextEmail });
        setActiveParticipant((prev) => prev ? { ...prev, userName: nextName, userEmail: nextEmail } : prev);
        setEditParticipantOpen(false);
        toast({ title: 'Registro actualizado' });
    };`;

let newSave = `    const handleSaveParticipant = async (e) => {
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
    };`;
adminCode = adminCode.replace(oldSave, newSave);

let oldView = `{normalizeTipo(activeParticipant.tipo || activeParticipant.tipoAsistencia) === 'participante' && (
                                <div><span className="opacity-70">Modalidad:</span> <strong>{normalizeModalidad(activeParticipant.modalidad, activeParticipant.tipoAsistencia) === 'virtual' ? 'Virtual' : 'Presencial'}</strong></div>
                            )}`;
let newView = `{normalizeTipo(activeParticipant.tipo || activeParticipant.tipoAsistencia) === 'participante' && (
                                <div><span className="opacity-70">Modalidad:</span> <strong>{normalizeModalidad(activeParticipant.modalidad, activeParticipant.tipoAsistencia) === 'virtual' ? 'Virtual' : 'Presencial'}</strong></div>
                            )}
                            {normalizeTipo(activeParticipant.tipo || activeParticipant.tipoAsistencia) === 'ponente' && activeParticipant.customEventName && (
                                <div><span className="opacity-70">Nombre Evento (Ponente):</span> <strong>{activeParticipant.customEventName}</strong></div>
                            )}`;
adminCode = adminCode.replace(oldView, newView);

let oldForm = `                            <div>
                                <Label className="block text-sm opacity-80 mb-1">Correo</Label>
                                <Input type="email" value={editParticipantEmail} onChange={(e) => setEditParticipantEmail(e.target.value)} />
                            </div>
                            <DialogFooter>`;
let newForm = `                            <div>
                                <Label className="block text-sm opacity-80 mb-1">Correo</Label>
                                <Input type="email" value={editParticipantEmail} onChange={(e) => setEditParticipantEmail(e.target.value)} />
                            </div>
                            {activeParticipant && normalizeTipo(activeParticipant.tipo || activeParticipant.tipoAsistencia) === 'ponente' && (
                                <div className="pt-2">
                                    <Label className="block text-sm opacity-80 mb-1">Nombre de evento (para Ponente)</Label>
                                    <Input value={editParticipantCustomEventName} onChange={(e) => setEditParticipantCustomEventName(e.target.value)} placeholder="Ej. Ponente invitado en …" />
                                </div>
                            )}
                            <DialogFooter>`;
adminCode = adminCode.replace(oldForm, newForm);

fs.writeFileSync(pathAdmin, adminCode);

// --- Now for functions/index.js ---
const pathFunctions = 'functions/index.js';
let funcCode = fs.readFileSync(pathFunctions, 'utf8');

let oldFunc = `    // Soportar 'modalidad' o 'tipoParticipacion' según el layout (solo para participantes)
    const modalidadBox = L.modalidad || L.tipoParticipacion;
    const modalidadText = (r.modalidad || r.tipoParticipacion || r.tipoAsistencia || '').toString();
    // Solo dibujar modalidad para los participantes
    if (modalidadBox?.rel && modalidadText && isParticipante) drawTextBox(modalidadText, modalidadBox.rel, modalidadBox.style || {});`;

let newFunc = `    // Soportar 'modalidad' o 'tipoParticipacion' según el layout
    const modalidadBox = L.modalidad || L.tipoParticipacion;
    let modalidadTextToDraw = '';
    
    if (isPonente) {
      modalidadTextToDraw = 'SPEAKER';
    } else if (isStaff) {
      modalidadTextToDraw = 'STAFF';
    } else if (isParticipante) {
      modalidadTextToDraw = (r.modalidad || r.tipoParticipacion || r.tipoAsistencia || '').toString();
    }
    
    if (modalidadBox?.rel && modalidadTextToDraw) {
      drawTextBox(modalidadTextToDraw, modalidadBox.rel, modalidadBox.style || {});
    }`;

funcCode = funcCode.replace(oldFunc, newFunc);
fs.writeFileSync(pathFunctions, funcCode);
console.log("PATCH DONE");
