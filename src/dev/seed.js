// Datos ficticios para el modo de prueba. Nombres y correos inventados (dominio example.com).
// Fechas relativas a "hoy" para que siempre haya eventos pasados y próximos.

import { DEFAULT_CONFIG, cycleBounds } from '../../functions/billing.js';

const DAY = 24 * 60 * 60 * 1000;
const at = (offsetDays, hour = 9) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const FIRST = ['Ana', 'Luis', 'María', 'Carlos', 'Sofía', 'Diego', 'Valeria', 'Jorge', 'Camila', 'Andrés', 'Lucía', 'Mateo', 'Isabel', 'Gabriel', 'Paula', 'Daniel', 'Elena', 'Ricardo', 'Fernanda', 'Tomás'];
const LAST = ['López', 'Martínez', 'Gutiérrez', 'Rivera', 'Castillo', 'Mendoza', 'Rojas', 'Herrera', 'Vargas', 'Morales'];
const UNIS = ['UNI', 'UCA', 'UAM', 'UNAN-Managua', 'UNICA', 'Keiser University'];
const DEPTS = ['Managua', 'León', 'Granada', 'Masaya', 'Estelí', 'Matagalpa'];

const person = (i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7) % LAST.length];
  const slug = `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return { name: `${first} ${last}`, email: `${slug}${i}@example.com`, phone: `+505 8${String(1000000 + i * 7919).slice(-7)}` };
};

// Evidencia ficticia: SVG inline (no depende de red).
const proofImage = (name, hours) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#2a6f6b"/><circle cx="240" cy="140" r="60" fill="#f4d35e"/><text x="240" y="260" font-family="sans-serif" font-size="22" fill="#fff" text-anchor="middle">${name}</text><text x="240" y="295" font-family="sans-serif" font-size="18" fill="#fff" text-anchor="middle">${hours} h de voluntariado</text></svg>`,
)}`;

export function seed() {
  const events = {
    'evt-ia': {
      title: 'Taller de IA Generativa',
      date: at(-20, 14), time: '2:00 PM', location: 'UNI, Managua',
      category: ['taller'], categoryName: 'Taller',
      description: 'Introducción práctica a modelos de lenguaje y prompting.',
      capacity: 40, registeredCount: 14, tipoAsistencia: ['Presencial', 'Virtual'],
      tipoAsistenciaOptions: ['Presencial', 'Virtual'], visible: true, soldOut: false,
      mensajeConfirmacion: 'Llega 15 minutos antes para registrarte.', createdAt: at(-40),
    },
    'evt-hack': {
      title: 'Boreal Hackathon 2026',
      date: at(12, 8), time: '8:00 AM', location: 'Hub de Innovación, Managua',
      category: ['hackathon'], categoryName: 'Hackathon',
      description: '36 horas para construir soluciones a retos reales de Nicaragua.',
      capacity: 30, registeredCount: 9, tipoAsistencia: ['Presencial'],
      tipoAsistenciaOptions: ['Presencial'], visible: true, soldOut: false,
      mensajeConfirmacion: '', createdAt: at(-10),
    },
    'evt-vol': {
      title: 'Jornada Voluntaria 2026',
      date: at(25, 7), time: '7:00 AM', location: 'Granada',
      category: ['voluntariado'], categoryName: 'Voluntariado',
      description: 'Jornada de apoyo comunitario.', capacity: null, registeredCount: 0,
      tipoAsistencia: ['Presencial'], tipoAsistenciaOptions: ['Presencial'], visible: true, soldOut: false,
      mensajeConfirmacion: '', createdAt: at(-5),
    },
    // Formulario con campos adicionales y código de inscripción (código en eventSecrets: BOREAL24).
    'evt-design': {
      title: 'Bootcamp de Diseño de Producto',
      date: at(8, 9), time: '9:00 AM', location: 'UCA, Managua',
      category: 'workshop', categoryName: 'Taller',
      description: 'Dos días para pasar de una idea a un prototipo validado con usuarios.',
      capacity: 25, registeredCount: 2, tipoAsistencia: ['Presencial'],
      tipoAsistenciaOptions: ['Presencial'], visible: true, soldOut: false,
      mensajeConfirmacion: 'Trae tu laptop con Figma instalado.', createdAt: at(-4),
      requiresCode: true,
      formFields: [
        { id: 'f_nivel1', type: 'select', label: 'Nivel de experiencia en diseño', required: true, options: ['Ninguna', 'Básica', 'Intermedia', 'Avanzada'] },
        { id: 'f_temas2', type: 'multiselect', label: '¿Qué temas te interesan?', required: true, options: ['Investigación con usuarios', 'Prototipado', 'Design systems', 'Accesibilidad', 'Métricas'], maxSelections: 3 },
        { id: 'f_portf3', type: 'url', label: 'Portafolio o LinkedIn', required: false, placeholder: 'https://' },
        { id: 'f_foto04', type: 'image', label: 'Captura de un proyecto tuyo', required: false, help: 'Opcional: nos ayuda a armar los equipos.' },
        { id: 'f_terms5', type: 'checkbox', label: 'Acepto compartir mis datos con los mentores del bootcamp', required: true },
      ],
    },
  };

  const registrations = {};
  const addRegs = (eventId, count, offset, attendedRatio) => {
    for (let i = 0; i < count; i += 1) {
      const p = person(i + offset);
      const tipo = i === 0 ? 'ponente' : i === 1 ? 'staff' : 'participante';
      registrations[`${eventId}_${p.email}`] = {
        eventName: events[eventId].title, eventId,
        userName: p.name, userEmail: p.email, userWhatsapp: p.phone,
        userUniversity: UNIS[i % UNIS.length], userCountry: 'Nicaragua', userDepartment: DEPTS[i % DEPTS.length],
        isCommunityMember: i % 3 !== 0, tipoAsistencia: i % 4 === 0 ? 'Virtual' : 'Presencial',
        tipo, registrationDate: at(-30 + i),
        ...(attendedRatio ? { statusAsistencia: i / count < attendedRatio } : {}),
      };
    }
  };
  addRegs('evt-ia', 14, 0, 0.7);
  addRegs('evt-hack', 9, 5, 0);
  addRegs('evt-design', 2, 30, 0);
  const designAnswers = [
    { f_nivel1: 'Intermedia', f_temas2: ['Prototipado', 'Accesibilidad'], f_portf3: 'https://www.linkedin.com/', f_terms5: true,
      f_foto04: { url: `${window.location.origin}/logoBoreal.svg`, path: 'registration-uploads/evt-design/demo-proyecto.svg', name: 'proyecto.svg' } },
    { f_nivel1: 'Ninguna', f_temas2: ['Investigación con usuarios'], f_terms5: true },
  ];
  Object.values(registrations).filter((r) => r.eventId === 'evt-design').forEach((r, i) => {
    r.answers = designAnswers[i];
    r.accessCode = 'BOREAL24';
  });

  const voluntarios2026 = {};
  for (let i = 0; i < 12; i += 1) {
    const p = person(i + 3);
    voluntarios2026[p.email] = {
      fullName: p.name, edad: String(18 + (i % 9)), email: p.email, whatsapp: p.phone,
      ciudad: DEPTS[i % DEPTS.length], talla: ['S', 'M', 'L', 'XL'][i % 4], procedencia: UNIS[i % UNIS.length],
      comentariosAdicionales: i % 5 === 0 ? 'Tengo experiencia en logística.' : '',
      creditos: i % 4, creditMinutesCarry: 0,
      turnos: [`${['Lunes', 'Miércoles', 'Sábado'][i % 3]}-Mañana`, `${['Martes', 'Jueves', 'Domingo'][i % 3]}-Tarde`],
      horariosPersonalizados: {}, fechaRegistro: at(-15 + i),
    };
  }

  const volunteerAttendanceLogs = {};
  Object.values(voluntarios2026).slice(0, 8).forEach((v, i) => {
    const processed = i < 3;
    const hours = 2 + (i % 4);
    volunteerAttendanceLogs[`log-${i}`] = {
      fullName: v.fullName, email: v.email, activityName: i % 2 ? 'Clasificación de donaciones' : 'Logística de evento',
      attendanceDate: at(-i - 1).toISOString().slice(0, 10), startTime: '08:00', endTime: `${String(8 + hours).padStart(2, '0')}:00`,
      startAtIso: at(-i - 1, 8).toISOString(), endAtIso: at(-i - 1, 8 + hours).toISOString(),
      proofImageUrl: i % 2 ? '' : proofImage(v.fullName, hours), proofImagePath: '', originalImageName: '', originalImageSizeBytes: 0,
      uploadedImageSizeBytes: 0, compressionApplied: false,
      registeredHours: hours, pendingCredits: hours / 2, creditsFormula: '1 credito = 2 horas',
      creditsProcessed: processed, createdAt: at(-i - 1, 18),
      ...(processed ? { creditsAssigned: hours / 2, creditsAssignedAt: at(-i), creditsAssignedBy: 'contacto@borealabs.org' } : {}),
    };
  });

  // Inscripción vieja con id aleatorio (antes el id no era el correo) y horario personalizado.
  const legacy = person(40);
  voluntarios2026['Xk3pLegacy9QaZ'] = {
    fullName: legacy.name, edad: '24', email: legacy.email, whatsapp: legacy.phone, ciudad: 'Managua', talla: 'M',
    procedencia: 'UCA', comentariosAdicionales: '', creditos: 1.5,
    turnos: ['Viernes-Mañana', 'Sábado-Personalizado'], horariosPersonalizados: { Sábado: { start: '14:00', end: '18:00' } },
    fechaRegistro: at(-90),
  };
  const logBase = { proofImagePath: '', originalImageName: '', originalImageSizeBytes: 0, uploadedImageSizeBytes: 0, compressionApplied: false, startAtIso: '', endAtIso: '' };
  volunteerAttendanceLogs['log-legacy'] = {
    ...logBase, fullName: legacy.name, email: legacy.email, activityName: 'Jornada de reforestación',
    attendanceDate: at(-3).toISOString().slice(0, 10), startTime: '07:00', endTime: '10:00', proofImageUrl: proofImage(legacy.name, 3),
    // Registro viejo: pendingCredits guardado en horas (fórmula 1h = 1 credito) → vale 1.5 créditos.
    registeredHours: 3, pendingCredits: 3, creditsFormula: '1h = 1 credito', creditsProcessed: false, createdAt: at(-3, 12),
  };
  volunteerAttendanceLogs['log-orphan'] = {
    ...logBase, fullName: 'Persona Sin Inscripción', email: 'sin.inscripcion@example.com', activityName: 'Logística de evento',
    attendanceDate: at(-2).toISOString().slice(0, 10), startTime: '13:00', endTime: '17:00', proofImageUrl: '',
    registeredHours: 4, pendingCredits: 2, creditsFormula: '1 credito = 2 horas', creditsProcessed: false, createdAt: at(-2, 19),
  };
  const rejectedBy = Object.values(voluntarios2026)[9];
  volunteerAttendanceLogs['log-rejected'] = {
    ...logBase, fullName: rejectedBy.fullName, email: rejectedBy.email, activityName: 'Clasificación de donaciones',
    attendanceDate: at(-6).toISOString().slice(0, 10), startTime: '08:00', endTime: '16:00', proofImageUrl: '',
    registeredHours: 8, pendingCredits: 4, creditsFormula: '1 credito = 2 horas', creditsProcessed: false, createdAt: at(-6, 18),
    creditStatus: 'rejected', rejectionReason: 'Las horas no coinciden', rejectedAt: at(-5), rejectedBy: 'contacto@borealabs.org',
  };

  const certificados = {};
  Object.values(registrations).filter((r) => r.eventId === 'evt-ia' && r.statusAsistencia).slice(0, 5).forEach((r, i) => {
    certificados[`cert-${i}`] = {
      correoUsuario: r.userEmail, nombreUsuario: r.userName, nombreEvento: r.eventName,
      tipo: r.tipo, modalidad: r.tipoAsistencia.toLowerCase(), idValidacion: `demo-${i}-0000-4000-8000-000000000000`,
      fechaEmision: at(-18), urlPdf: '',
    };
  });

  // Ids de 28 caracteres = cuenta de la Wallet (uid de Auth); de 20 = doc aleatorio escrito desde la web.
  const walletUid = (n) => `demoWalletUid${n}`.padEnd(28, 'Q');
  const autoId = (n) => `demoAutoId${n}`.padEnd(20, 'x');
  const userPoints = {};
  Object.values(certificados).forEach((c, i) => {
    userPoints[i < 3 ? walletUid(i) : autoId(i)] = { email: c.correoUsuario, balance: 10 * (i + 1), updatedAt: at(-18), lastEvent: c.nombreEvento };
  });
  // Duplicado: la persona 4 recibió puntos antes de abrir la Wallet y luego creó su cuenta.
  const dup = Object.values(certificados)[4];
  if (dup) userPoints[walletUid(4)] = { email: dup.correoUsuario, balance: 15, updatedAt: at(-2) };
  // Presente en el taller, sin certificado aún, pero ya usa la Wallet (el asistente le suma en su doc).
  userPoints[walletUid(5)] = { email: person(5).email, balance: 5, updatedAt: at(-4) };

  const pointCodes = {
    'BL-7KQ2-M9XD': { code: 'BL-7KQ2-M9XD', amount: 10, active: true, used: false, multiUse: false, redeemedCount: 0, event: 'Boreal Hackathon 2026', note: '', createdBy: 'contacto@borealabs.org', createdAt: at(-1), expiresAt: at(30, 23) },
    'BL-H4TW-8RNB': { code: 'BL-H4TW-8RNB', amount: 10, active: false, used: true, multiUse: false, redeemedCount: 0, event: 'Taller de IA Generativa', note: '', createdBy: 'contacto@borealabs.org', createdAt: at(-21), usedBy: walletUid(0), usedAt: at(-20, 15), userEmail: Object.values(certificados)[0]?.correoUsuario || null },
    'BL-ZP3C-6VYE': { code: 'BL-ZP3C-6VYE', amount: 5, active: true, used: false, multiUse: true, redeemedCount: 2, event: 'Taller de IA Generativa', note: 'QR proyectado al cierre', createdBy: 'jose@borealabs.org', createdAt: at(-20), lastUsedAt: at(-20, 16) },
    'BL-QD8F-2JSA': { code: 'BL-QD8F-2JSA', amount: 20, active: true, used: false, multiUse: false, redeemedCount: 0, event: '', note: 'Promo de lanzamiento', createdBy: 'admin@borealabs.org', createdAt: at(-40), expiresAt: at(-10, 23) },
    'BL-5GXR-T1KM': { code: 'BL-5GXR-T1KM', amount: 15, active: false, used: false, multiUse: false, redeemedCount: 0, event: 'Jornada Voluntaria 2026', note: 'Pausado', createdBy: 'contacto@borealabs.org', createdAt: at(-3) },
  };

  const teamMembers = {};
  [['Directiva General', 'Presidencia'], ['Directiva General', 'Coordinación de proyectos'], ['Staff', 'Diseño'], ['Staff', 'Comunicación']]
    .forEach(([teamTag, role], i) => {
      const p = person(i + 10);
      teamMembers[`tm-${i}`] = {
        name: p.name, role, description: `Responsable de ${role.toLowerCase()} en Boreal Labs.`,
        teamSection: i < 2 ? 'directiva' : 'staff', teamTag, email: p.email, imageUrl: null,
        linkedinUrl: 'https://www.linkedin.com/', instagramUrl: null, whatsappUrl: null, externalUrl: null, createdAt: at(-60),
      };
    });

  return {
    events,
    registrations,
    voluntarios2026,
    volunteerAttendanceLogs,
    certificados,
    userPoints,
    pointCodes,
    'pointCodes/BL-ZP3C-6VYE/uses': Object.fromEntries([0, 1].map((i) => [walletUid(i), {
      uid: walletUid(i), usedAt: at(-20, 16), userEmail: Object.values(certificados)[i]?.correoUsuario || null,
    }])),
    [`userPoints/${walletUid(0)}/redemptions`]: {
      'BL-H4TW-8RNB': { code: 'BL-H4TW-8RNB', amount: 10, redeemedAt: at(-20, 15), userEmail: Object.values(certificados)[0]?.correoUsuario || null },
      'BL-ZP3C-6VYE': { code: 'BL-ZP3C-6VYE', amount: 5, redeemedAt: at(-20, 16), userEmail: Object.values(certificados)[0]?.correoUsuario || null },
    },
    [`userPoints/${walletUid(0)}/purchases`]: {
      'rcpt-1': { receiptId: 'rcpt-1', productId: 'sticker', name: 'Stickers Boreal', price: 5, quantity: 1, total: 5, purchasedAt: at(-10), userEmail: Object.values(certificados)[0]?.correoUsuario || null },
    },
    // Historial de puntos (subcolección adminGrants) para la sección Puntos.
    ...Object.fromEntries(Object.entries(userPoints).slice(0, 2).map(([id, u]) => [`userPoints/${id}/adminGrants`, {
      [`${id}-g1`]: { amount: u.balance, email: u.email, grantedAt: at(-18), grantedBy: 'contacto@borealabs.org', note: u.lastEvent, type: 'manual-award' },
    }])),
    teamMembers,
    // Enlaces de perfil del equipo: abre /equipo/perfil/demo-invite-nuevo para probar el formulario público.
    teamInvites: {
      'demo-invite-nuevo': { mode: 'create', memberId: null, teamSection: 'STAFF', teamTag: 'Redes', active: true, expiresAt: at(14, 23), createdBy: 'admin@borealabs.org', createdAt: at(-1) },
      'demo-invite-pend-nuevo': { mode: 'create', memberId: null, teamSection: 'STAFF', teamTag: 'Voluntariado', active: true, expiresAt: at(7, 23), createdBy: 'admin@borealabs.org', createdAt: at(-3) },
      'demo-invite-pend-edit': { mode: 'edit', memberId: 'tm-2', memberName: teamMembers['tm-2'].name, teamSection: 'STAFF', teamTag: 'Staff', active: true, expiresAt: at(7, 23), createdBy: 'admin@borealabs.org', createdAt: at(-2) },
      'demo-invite-vencido': { mode: 'create', memberId: null, teamSection: 'DIRECTIVA', teamTag: 'Finanzas', active: true, expiresAt: at(-1), createdBy: 'admin@borealabs.org', createdAt: at(-20) },
    },
    teamSubmissions: {
      'demo-invite-pend-nuevo': {
        mode: 'create', teamSection: 'STAFF', teamTag: 'Voluntariado', name: 'Lucía Herrera', role: 'Coordinadora de voluntariado',
        description: 'Organiza jornadas y acompaña a nuevos voluntarios.', email: 'lucia.herrera@example.com',
        instagramUrl: 'https://instagram.com/lucia.demo', status: 'pending', submittedAt: at(-1, 15),
      },
      'demo-invite-pend-edit': {
        mode: 'edit', memberId: 'tm-2', teamSection: 'STAFF', teamTag: 'Staff', name: teamMembers['tm-2'].name, role: 'Diseño y marca',
        description: 'Lidera la identidad visual de Boreal Labs.', email: teamMembers['tm-2'].email, linkedinUrl: 'https://www.linkedin.com/',
        whatsappUrl: 'https://wa.me/50512345678', status: 'pending', submittedAt: at(-1, 17),
      },
    },
    eventSecrets: { 'evt-design': { code: 'BOREAL24', updatedAt: at(-4), updatedBy: 'contacto@borealabs.org' } },
    // Suscripciones (/claude): fechas relativas al ciclo actual (24 al 24) para reproducir el ejemplo del dueño.
    ...subsSeed(),
    adminEvents: { 'adm-1': { name: 'Charla de Emprendimiento (manual)', createdAt: at(-8) } },
    eventTemplates: {},
    adminActivity: Object.fromEntries([
      [-0.1, 'contacto@borealabs.org', 'Equipo Boreal', 'voluntariado.aprobadas', 'Aprobó 3 h de voluntariado de Valeria Mendoza'],
      [-0.3, 'jose@borealabs.org', 'José Obregón', 'eventos.editado', 'Editó el cupo de "Boreal Hackathon 2026" (25 → 30)'],
      [-0.9, 'admin@borealabs.org', null, 'sitio.home', 'Actualizó el texto principal del inicio'],
      [-1.2, 'jose@borealabs.org', 'José Obregón', 'eventos.creado', 'Creó el evento "Jornada Voluntaria 2026"'],
      [-1.4, 'contacto@borealabs.org', 'Equipo Boreal', 'equipo.editado', 'Actualizó la foto de un miembro del staff'],
      [-2.1, 'admin@borealabs.org', null, 'plantillas.guardada', 'Guardó la plantilla de certificado "Ponente"'],
      [-2.5, 'contacto@borealabs.org', 'Equipo Boreal', 'voluntariado.aprobadas', 'Aprobó 2 h de voluntariado de Diego Rojas'],
      [-3.2, 'jose@borealabs.org', 'José Obregón', 'puntos.ajuste', 'Sumó 10 puntos a ana.lopez0@example.com'],
      [-4.1, 'admin@borealabs.org', null, 'certificados.generados', 'Generó 5 certificados para "Taller de IA Generativa"'],
      [-4.3, 'contacto@borealabs.org', 'Equipo Boreal', 'eventos.asistencia', 'Marcó asistencia de 10 personas en "Taller de IA Generativa"'],
      [-5.6, 'jose@borealabs.org', 'José Obregón', 'sitio.enlaces', 'Cambió el enlace del grupo de WhatsApp de la comunidad'],
      [-6.2, 'admin@borealabs.org', null, 'equipo.agregado', 'Agregó a un nuevo miembro al staff de Comunicación'],
    ].map(([days, actorEmail, actorName, action, summary], i) => [`act-${i}`, {
      action, summary, meta: {}, actorEmail, actorName, at: new Date(Date.now() + days * DAY),
    }])),
  };
}

function subsSeed() {
  const start = cycleBounds(Date.now()).start;
  const d = (n) => new Date(start + n * DAY + 6 * 3600000); // mediodía de Managua, n días después del corte
  return {
    subsConfig: { main: { ...DEFAULT_CONFIG } },
    subsClients: {
      'sub-1': { name: 'Ana López', email: 'ana.lopez@example.com', phone: '+505 8123 4567', price: 300, joinedAt: d(5), status: 'activo', notes: '', createdAt: d(5), createdBy: 'contacto@borealabs.org' },
      'sub-2': { name: 'Luis Martínez', email: 'luis.martinez@example.com', phone: '+505 8234 5678', price: 300, joinedAt: d(5), status: 'activo', notes: '', createdAt: d(5), createdBy: 'contacto@borealabs.org' },
      'sub-3': { name: 'María Rivera', email: 'maria.rivera@example.com', phone: '+505 8345 6789', price: 220, joinedAt: d(11), status: 'activo', notes: 'Precio especial', createdAt: d(11), createdBy: 'contacto@borealabs.org' },
      'sub-4': { name: 'Carlos Rojas', email: 'carlos.rojas@example.com', phone: '+505 8456 7890', price: 250, joinedAt: d(14), status: 'activo', notes: '', createdAt: d(14), createdBy: 'contacto@borealabs.org' },
    },
    // Ana y Luis pagaron 300 por adelantado: cubiertos hasta 5 días después del próximo corte.
    subsPayments: Object.fromEntries(['sub-1', 'sub-2'].map((id, i) => [`pay-${i}`, {
      clientId: id, amount: 300, paidAt: d(5), cycleKey: cycleBounds(start).key, method: 'Transferencia', note: 'Pago adelantado', coversUntil: d(5 + 31), recordedBy: 'contacto@borealabs.org', createdAt: d(5),
    }])),
  };
}
