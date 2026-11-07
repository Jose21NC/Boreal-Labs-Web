// Prompts para generar textos de eventos con Claude (los usa la Function generateText).
// Puro (sin SDK) para poder probarlo sin llamar a la API.

export const AI_KINDS = {
  description: {
    label: 'descripción del evento',
    guide: 'Una descripción para la página pública del evento: 2 a 4 oraciones, qué se aprenderá o hará, a quién va dirigido y por qué vale la pena. Sin títulos ni listas.',
    maxChars: 1200,
  },
  confirmation: {
    label: 'mensaje de confirmación de inscripción',
    guide: 'Un mensaje breve que la persona ve (y recibe por correo) al inscribirse: agradece, confirma fecha, hora y lugar si los tienes, y da 1 o 2 indicaciones prácticas. Puedes usar los marcadores {nombre}, {evento}, {fecha}, {hora}, {lugar} y {meet} tal cual, entre llaves, donde corresponda.',
    maxChars: 1200,
  },
  certificate: {
    label: 'descripción para el certificado',
    guide: 'Una sola oración formal, en tercera persona, que se imprime en el certificado debajo del nombre del evento. Empieza con "Por" (p. ej. "Por su participación en…" o "Por completar…"). Máximo 220 caracteres. Sin comillas.',
    maxChars: 300,
  },
};

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/** System prompt fijo (cacheable) + pedido del usuario con los datos del evento. */
export function buildAiPrompt(kind, context = {}, instructions = '') {
  const spec = AI_KINDS[kind];
  if (!spec) throw new Error(`Tipo no válido: ${kind}`);
  const facts = [
    ['Evento', clip(context.title, 200)],
    ['Categoría', clip(context.category, 80)],
    ['Fecha', clip(context.date, 60)],
    ['Hora', clip(context.time, 40)],
    ['Lugar', clip(context.location, 200)],
    ['Modalidad', clip(context.modality, 80)],
    ['Cupo', clip(context.capacity, 20)],
    ['Descripción actual', clip(context.description, 1200)],
  ].filter(([, v]) => v);
  const system = [
    'Eres el equipo de comunicación de Boreal Labs, una organización juvenil sin fines de lucro de Nicaragua que impulsa la innovación, la tecnología y el emprendimiento.',
    'Escribes en español neutro centroamericano, cercano y profesional, con tuteo. No inventas datos que no te den (fechas, precios, ponentes, premios).',
    'Responde SOLO con el texto final listo para pegar: sin saludo al operador, sin explicaciones, sin comillas alrededor y sin formato Markdown.',
  ].join('\n');
  const user = [
    `Escribe la ${spec.label}.`,
    spec.guide,
    facts.length ? `Datos del evento:\n${facts.map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : 'No hay datos del evento todavía: escribe un texto genérico breve.',
    clip(instructions, 1000) ? `Indicaciones del equipo: ${clip(instructions, 1000)}` : '',
  ].filter(Boolean).join('\n\n');
  return { system, user, maxChars: spec.maxChars };
}
