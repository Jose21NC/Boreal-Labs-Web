// Plantillas de texto para "Descripción" y "Mensaje de confirmación" del evento.
import { formatEventTime } from '../../../../functions/eventTime.js';
// Marcadores: {evento} {fecha} {hora} {lugar} {enlace} (= página /eventos) {meet} (= enlace de Google Meet); los vacíos se dejan tal cual para completarlos a mano.

export const PLACEHOLDERS = ['{evento}', '{fecha}', '{hora}', '{lugar}', '{enlace}', '{meet}'];

export const BUILTIN_TEMPLATES = {
  description: [
    { id: 'b-taller', name: 'Taller presencial', text: '¡Te esperamos en {evento}! 🛠️\n\nUn taller práctico para aprender haciendo junto a la comunidad de Boreal Labs. Trae tu laptop, tus ganas de experimentar y tus preguntas.\n\n📅 {fecha} · {hora}\n📍 {lugar}\n\nCupos limitados: inscríbete y asegura tu lugar.' },
    { id: 'b-virtual', name: 'Taller virtual', text: '{evento} llega en formato virtual 💻\n\nConéctate desde donde estés y aprende con ejemplos prácticos y espacio para preguntas en vivo.\n\n📅 {fecha} · {hora}\n🔗 El enlace de la sesión se comparte con las personas inscritas.\n\nSolo necesitas buena conexión y curiosidad.' },
    { id: 'b-charla', name: 'Charla / conferencia', text: 'En {evento} conversamos con personas que están construyendo tecnología e innovación desde la región. 🎤\n\nUna charla para inspirarte, hacer preguntas y conectar con la comunidad.\n\n📅 {fecha} · {hora}\n📍 {lugar}\n\nEntrada libre con inscripción previa.' },
    { id: 'b-hackathon', name: 'Hackathon', text: '🚀 {evento}: equipos, retos reales y muchas ideas.\n\nForma tu equipo (o súmate a uno), construye un prototipo y preséntalo ante mentores y jurado. No necesitas ser experto: buscamos perfiles técnicos, de diseño y de negocio.\n\n📅 {fecha} · {hora}\n📍 {lugar}\n\nHabrá comida, mentorías y premios. ¡Inscríbete!' },
    { id: 'b-voluntariado', name: 'Voluntariado', text: '¿Quieres aportar a tu comunidad? Súmate a {evento} 💚\n\nUna jornada de voluntariado con el equipo de Boreal Labs. Tus horas cuentan para tus créditos de voluntariado.\n\n📅 {fecha} · {hora}\n📍 {lugar}\n\nUsa ropa cómoda y trae tu botella de agua.' },
    { id: 'b-cupo', name: 'Cupo limitado / con código', text: '{evento} es un espacio con cupo limitado. 🔒\n\nPara inscribirte necesitas el código de acceso que compartimos con las personas invitadas. Si no lo tienes, escríbenos y te contamos cómo participar.\n\n📅 {fecha} · {hora}\n📍 {lugar}' },
  ],
  confirmation: [
    { id: 'b-taller', name: 'Taller presencial', text: '¡Listo! Tu lugar en {evento} está reservado. Te esperamos el {fecha} a las {hora} en {lugar}. Llega 15 minutos antes para el registro y trae tu laptop.' },
    { id: 'b-virtual', name: 'Taller virtual', text: '¡Gracias por inscribirte a {evento}! La sesión es el {fecha} a las {hora}; conéctate por Google Meet: {meet}. Detalles del evento: {enlace}' },
    { id: 'b-charla', name: 'Charla / conferencia', text: '¡Nos vemos en {evento}! Te esperamos el {fecha} a las {hora} en {lugar}. Si la sigues en línea, entra por Google Meet: {meet}. Prepara tus preguntas para el espacio de conversación.' },
    { id: 'b-hackathon', name: 'Hackathon', text: '¡Ya eres parte de {evento}! 🚀 Te esperamos el {fecha} a las {hora} en {lugar}. Pronto te escribiremos con los retos, la agenda y cómo formar tu equipo.' },
    { id: 'b-voluntariado', name: 'Voluntariado', text: '¡Gracias por sumarte a {evento}! 💚 Nos vemos el {fecha} a las {hora} en {lugar}. Recuerda registrar tus horas al terminar la jornada.' },
    { id: 'b-cupo', name: 'Cupo limitado / con código', text: 'Tu código fue validado y tu cupo en {evento} está confirmado. Te esperamos el {fecha} a las {hora} en {lugar}. Si no puedes asistir, avísanos para liberar tu lugar.' },
  ],
};

const longDate = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });

/** Reemplaza los marcadores con los valores del formulario; los que no tienen valor quedan visibles. */
export function fillTemplate(text, form) {
  const date = form.date ? longDate.format(new Date(`${form.date}T00:00:00`)) : '';
  const values = {
    evento: form.title?.trim(),
    fecha: date,
    hora: formatEventTime(form.time || form.timeLegacy),
    lugar: form.location?.trim(),
    enlace: `${window.location.origin}/eventos`,
    meet: form.meetLink?.trim() || '[agrega el enlace de Google Meet]',
  };
  return text.replace(/\{(evento|fecha|hora|lugar|enlace|meet)\}/g, (m, k) => values[k] || m);
}
