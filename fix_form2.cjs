const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.jsx', 'utf8');

const anchor = '<Input type="email" value={editParticipantEmail} onChange={(e) => setEditParticipantEmail(e.target.value)} />';

const insertion = anchor + `
                            </div>
                            {activeParticipant && normalizeTipo(activeParticipant.tipo || activeParticipant.tipoAsistencia) === 'ponente' && (
                                <div className="pt-2">
                                    <Label className="block text-sm opacity-80 mb-1">Nombre de evento (para Ponente)</Label>
                                    <Input value={editParticipantCustomEventName} onChange={(e) => setEditParticipantCustomEventName(e.target.value)} placeholder="Ej. Ponente invitado en …" />
                                </div>
                            )}`;

if (!code.includes('Nombre de evento (para Ponente)')) {
    code = code.replace(new RegExp(anchor.replace(/[-[\\]{}()*+?.,\\\\^$|#\\s]/g, '\\\\$&') + "\\\\s*<\\\\/div>"), insertion);
    fs.writeFileSync('src/pages/AdminPanel.jsx', code);
    console.log("FORM FIXED");
}