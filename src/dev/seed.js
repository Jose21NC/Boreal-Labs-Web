// Datos ficticios para el modo de prueba. Nombres y correos inventados (dominio example.com).
// Fechas relativas a "hoy" para que siempre haya eventos pasados y próximos.

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
      proofImageUrl: '', proofImagePath: '', originalImageName: '', originalImageSizeBytes: 0,
      uploadedImageSizeBytes: 0, compressionApplied: false,
      registeredHours: hours, pendingCredits: hours / 2, creditsFormula: '1 credito = 2 horas',
      creditsProcessed: processed, createdAt: at(-i - 1, 18),
      ...(processed ? { creditsAssigned: hours / 2, creditsAssignedAt: at(-i), creditsAssignedBy: 'contacto@borealabs.org' } : {}),
    };
  });

  const certificados = {};
  Object.values(registrations).filter((r) => r.eventId === 'evt-ia' && r.statusAsistencia).slice(0, 5).forEach((r, i) => {
    certificados[`cert-${i}`] = {
      correoUsuario: r.userEmail, nombreUsuario: r.userName, nombreEvento: r.eventName,
      tipo: r.tipo, modalidad: r.tipoAsistencia.toLowerCase(), idValidacion: `demo-${i}-0000-4000-8000-000000000000`,
      fechaEmision: at(-18), urlPdf: '',
    };
  });

  const userPoints = {};
  Object.values(certificados).forEach((c, i) => {
    userPoints[`pts-${i}`] = { email: c.correoUsuario, balance: 10 * (i + 1), updatedAt: at(-18), lastEvent: c.nombreEvento };
  });

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
    teamMembers,
    adminEvents: { 'adm-1': { name: 'Charla de Emprendimiento (manual)', createdAt: at(-8) } },
    eventTemplates: {},
    adminActivity: {},
  };
}
