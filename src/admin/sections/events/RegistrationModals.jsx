// Alta manual (individual o pegando desde Excel) y ficha/edición de un inscrito.
import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Checkbox, Field, Input, Modal, Select, Switch, Tabs, Textarea, useConfirm } from '@/admin/ui';
import { formatDateTime, isPresent, logActivity } from '@/admin/lib';
import { EMAIL_RE } from '@/lib/antiSpam';
import { answerText } from '@/lib/eventForms';
import { safeUrl } from '@/lib/team';
import { useToast } from '@/components/ui/use-toast';
import { useEventsStore } from './store';
import { MODALIDADES, ROLES, labelOf, modalidadOf, roleOf } from './data';
import { addRegistrations, deleteRegistrations, updateRegistration } from './actions';

/** Filas pegadas desde Excel/Sheets (tabuladas) o CSV, con encabezados NOMBRE y CORREO. */
export function parsePasted(text) {
  const rows = String(text || '').trim().split(/\r?\n/).filter(Boolean)
    .map((line) => line.split(line.includes('\t') ? '\t' : ',').map((c) => c.trim()));
  if (!rows.length) return { items: [], error: null };
  const header = rows[0].map((h) => h.toLowerCase());
  const nameIdx = header.findIndex((h) => h.includes('nombre'));
  const emailIdx = header.findIndex((h) => h.includes('correo') || h.includes('email'));
  if (nameIdx === -1 || emailIdx === -1) return { items: [], error: 'La primera fila debe tener columnas NOMBRE y CORREO.' };
  const items = rows.slice(1).map((r) => ({ name: r[nameIdx] || '', email: r[emailIdx] || '' })).filter((r) => r.name && r.email);
  const invalid = items.filter((r) => !EMAIL_RE.test(r.email));
  return { items: items.filter((r) => EMAIL_RE.test(r.email)), error: invalid.length ? `${invalid.length} fila(s) con correo inválido se omitirán.` : null };
}

const RoleFields = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-3">
    <Field label="Rol">
      <Select value={value.tipo} onChange={(e) => onChange({ tipo: e.target.value })}>
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </Select>
    </Field>
    <Field label="Modalidad">
      <Select value={value.modalidad} onChange={(e) => onChange({ modalidad: e.target.value })}>
        {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </Select>
    </Field>
    {value.tipo === 'ponente' && (
      <Field label="Tema / título de la ponencia" hint="Aparece en el certificado en lugar del nombre del evento." className="col-span-2">
        <Input value={value.customEventName || ''} onChange={(e) => onChange({ customEventName: e.target.value })} />
      </Field>
    )}
  </div>
);

const EMPTY = { name: '', email: '', tipo: 'participante', modalidad: 'presencial', customEventName: '', present: true };

export function AddRegistrationModal({ group, open, onClose }) {
  const { reload } = useEventsStore();
  const { toast } = useToast();
  const [mode, setMode] = useState('individual');
  const [form, setForm] = useState(EMPTY);
  const [pasted, setPasted] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const parsed = useMemo(() => parsePasted(pasted), [pasted]);
  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  const close = () => { setForm(EMPTY); setPasted(''); setError(null); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    let items;
    if (mode === 'individual') {
      if (!form.name.trim() || !EMAIL_RE.test(form.email.trim())) { setError('Nombre y un correo válido son obligatorios.'); return; }
      items = [form];
    } else {
      if (!parsed.items.length) { setError(parsed.error || 'No hay filas válidas.'); return; }
      items = parsed.items.map((it) => ({ ...form, ...it, customEventName: '' }));
    }
    setError(null);
    setSaving(true);
    try {
      const { added, skipped } = await addRegistrations(group, items);
      await reload();
      if (added) {
        await logActivity('eventos.registros_agregados', added === 1 && items.length === 1 ? `Agregó a ${items[0].name.trim()} en "${group.name}"` : `Importó ${added} registros en "${group.name}"`, { event: group.name, added, skipped });
      }
      toast({
        title: added ? `${added} registro(s) agregados` : 'No se agregó ningún registro',
        description: skipped ? `${skipped} omitido(s): el correo ya estaba inscrito.` : undefined,
        variant: added ? undefined : 'destructive',
      });
      if (added) close();
    } catch (err) {
      console.error(err);
      toast({ title: 'No se pudo agregar', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Agregar inscritos"
      description={group.kind === 'public' ? 'Cuentan para el cupo del evento.' : undefined}
      footer={(
        <>
          <Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button type="submit" form="add-reg-form" variant="primary" loading={saving}>
            {mode === 'individual' ? 'Agregar' : `Importar ${parsed.items.length || ''}`}
          </Button>
        </>
      )}
    >
      <Tabs className="mb-4" value={mode} onChange={setMode} items={[{ value: 'individual', label: 'Individual' }, { value: 'masivo', label: 'Pegar desde Excel' }]} />
      <form id="add-reg-form" onSubmit={submit} className="space-y-4">
        {mode === 'individual' ? (
          <>
            <Field label="Nombre completo"><Input value={form.name} onChange={(e) => patch({ name: e.target.value })} required maxLength={200} /></Field>
            <Field label="Correo"><Input type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} required maxLength={200} /></Field>
          </>
        ) : (
          <Field label="Filas" hint={parsed.error || `Copia las columnas desde Excel con encabezados NOMBRE y CORREO. ${parsed.items.length} fila(s) válidas.`}>
            <Textarea rows={7} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'NOMBRE\tCORREO\nAna López\tana@example.com'} className="font-mono text-xs" />
          </Field>
        )}
        <RoleFields value={form} onChange={patch} />
        <Checkbox label="Marcar como presente" checked={form.present} onChange={(e) => patch({ present: e.target.checked })} />
        {error && <p role="alert" className="text-sm text-adm-danger">{error}</p>}
      </form>
    </Modal>
  );
}

/** Respuesta a un campo adicional; las imágenes se muestran como miniatura enlazada (solo URLs http/https). */
export function AnswerValue({ value, small }) {
  const url = value && typeof value === 'object' && !Array.isArray(value) ? safeUrl(value.url) : null;
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent" title={value.name || 'Ver imagen'}>
        <img src={url} alt={value.name || 'Imagen adjunta'} className={small ? 'h-8 w-8 rounded object-cover' : 'h-24 w-24 rounded-md border border-adm-border object-cover'} loading="lazy" />
      </a>
    );
  }
  const link = typeof value === 'string' ? safeUrl(value.trim()) : null;
  if (link) return <a href={link} target="_blank" rel="noopener noreferrer" className="text-adm-accent underline-offset-2 hover:underline">{value}</a>;
  return answerText(value) || null;
}

const Row = ({ label, children }) => (
  <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-adm-border/60 py-2 text-sm last:border-0">
    <dt className="text-adm-muted">{label}</dt>
    <dd className="break-words text-adm-text">{children || '—'}</dd>
  </div>
);

/** Editor admin de una respuesta personalizada según el tipo de campo del evento (formFields). */
function AnswerInput({ field, value, onChange }) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  const options = field.options || [];
  switch (field.type) {
    case 'textarea':
      return <Field label={label}><Textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></Field>;
    case 'select':
    case 'radio':
      return (
        <Field label={label}>
          <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">Sin respuesta</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        </Field>
      );
    case 'multiselect': {
      const list = Array.isArray(value) ? value : [];
      return (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold uppercase tracking-wide text-adm-muted">{label}</legend>
          {options.map((o) => (
            <Checkbox key={o} className="flex" label={o} checked={list.includes(o)} onChange={(e) => onChange(e.target.checked ? [...list, o] : list.filter((x) => x !== o))} />
          ))}
        </fieldset>
      );
    }
    case 'checkbox':
      return <Checkbox className="flex" label={field.label} checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case 'image': {
      const url = safeUrl(value?.url);
      return (
        <Field label={label}>
          {url ? (
            <div className="flex items-center gap-3">
              <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" className="h-16 w-16 rounded-lg border border-adm-border object-cover" /></a>
              <Button size="sm" variant="danger-ghost" onClick={() => onChange(null)}>Quitar imagen</Button>
            </div>
          ) : <p className="text-sm text-adm-muted">Sin imagen</p>}
        </Field>
      );
    }
    default: {
      const type = { number: 'number', date: 'date', email: 'email', phone: 'tel', url: 'url' }[field.type] || 'text';
      return (
        <Field label={label}>
          <Input type={type} value={value ?? ''} onChange={(e) => onChange(field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
        </Field>
      );
    }
  }
}

export function RegistrationDetailModal({ group, reg, onClose, onToggleAttendance }) {
  const { reload } = useEventsStore();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  if (!reg) return null;

  const tipo = roleOf(reg);
  const present = isPresent(reg.statusAsistencia);
  const close = () => { setEdit(null); onClose(); };

  const startEdit = () => setEdit({
    name: reg.userName || '', email: reg.userEmail || '', tipo, modalidad: modalidadOf(reg), customEventName: reg.customEventName || '',
    whatsapp: reg.userWhatsapp || '', university: reg.userUniversity || '', country: reg.userCountry || '', department: reg.userDepartment || '',
    isCommunityMember: reg.isCommunityMember === true ? 'yes' : reg.isCommunityMember === false ? 'no' : '',
    answers: { ...(reg.answers || {}) },
  });

  const save = async (e) => {
    e.preventDefault();
    if (!edit.name.trim() || !EMAIL_RE.test(edit.email.trim())) { toast({ title: 'Nombre y un correo válido son obligatorios', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await updateRegistration(reg.id, {
        userName: edit.name.trim(),
        userEmail: edit.email.trim(),
        tipo: edit.tipo,
        modalidad: edit.modalidad,
        // Los registros públicos guardan la modalidad en tipoAsistencia (la usan correos y Meet).
        ...(reg.tipoAsistencia && !['ponente', 'staff', 'participante'].includes(String(reg.tipoAsistencia).toLowerCase())
          ? { tipoAsistencia: labelOf(MODALIDADES, edit.modalidad) } : {}),
        ...(edit.tipo === 'ponente' ? { customEventName: edit.customEventName.trim() } : {}),
        userWhatsapp: edit.whatsapp.trim(),
        userUniversity: edit.university.trim(),
        userCountry: edit.country.trim(),
        userDepartment: edit.department.trim(),
        ...(edit.isCommunityMember ? { isCommunityMember: edit.isCommunityMember === 'yes' } : {}),
        ...(fields.length || Object.keys(edit.answers).length ? { answers: edit.answers } : {}),
      });
      await reload();
      await logActivity('eventos.registro_editado', `Editó el registro de ${edit.name.trim()} en "${group.name}"`, { id: reg.id, event: group.name });
      toast({ title: 'Registro actualizado' });
      close();
    } catch (err) {
      console.error(err);
      toast({ title: 'No se pudo guardar', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: `¿Eliminar a ${reg.userName || reg.userEmail}?`, description: 'Se borra su registro de este evento y se libera su cupo.', confirmLabel: 'Eliminar', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteRegistrations([reg], new Set(group.kind === 'public' ? [group.id] : []));
      await reload();
      await logActivity('eventos.registros_eliminados', `Eliminó el registro de ${reg.userName || reg.userEmail} en "${group.name}"`, { ids: [reg.id], event: group.name });
      toast({ title: 'Registro eliminado' });
      close();
    } catch (err) {
      console.error(err);
      toast({ title: 'No se pudo eliminar', description: err?.message, variant: 'destructive' });
    }
  };

  const fields = group.doc?.formFields || [];
  const orphanAnswers = Object.entries(reg.answers || {}).filter(([id]) => !fields.some((f) => f.id === id));
  const university = reg.userUniversity || reg.university || reg.cargo || reg.userCargo;
  return (
    <Modal
      open
      onClose={close}
      title={edit ? 'Editar registro' : reg.userName || 'Inscrito'}
      description={edit ? undefined : reg.userEmail}
      footer={edit ? (
        <>
          {/* keys distintas: si React reutiliza el botón "Editar" como este submit, el mismo clic envía el formulario */}
          <Button key="cancel-edit" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
          <Button key="save-edit" type="submit" form="edit-reg-form" variant="primary" loading={saving}>Guardar</Button>
        </>
      ) : (
        <>
          <Button key="remove" variant="danger-ghost" onClick={remove} className="mr-auto"><Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar</Button>
          <Button key="start-edit" variant="secondary" onClick={startEdit}>Editar</Button>
        </>
      )}
    >
      {edit ? (
        <form id="edit-reg-form" onSubmit={save} className="space-y-4">
          <Field label="Nombre completo"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
          <Field label="Correo" hint="El certificado se busca por este correo."><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required /></Field>
          <RoleFields value={edit} onChange={(p) => setEdit({ ...edit, ...p })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp"><Input value={edit.whatsapp} onChange={(e) => setEdit({ ...edit, whatsapp: e.target.value })} /></Field>
            <Field label="Universidad / procedencia"><Input value={edit.university} onChange={(e) => setEdit({ ...edit, university: e.target.value })} /></Field>
            <Field label="País"><Input value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /></Field>
            <Field label="Departamento"><Input value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></Field>
            <Field label="Comunidad Boreal">
              <Select value={edit.isCommunityMember} onChange={(e) => setEdit({ ...edit, isCommunityMember: e.target.value })}>
                <option value="">Sin dato</option>
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </Select>
            </Field>
          </div>
          {fields.length > 0 && (
            <div className="space-y-4 border-t border-adm-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-adm-muted">Preguntas del evento</p>
              {fields.map((f) => (
                <AnswerInput key={f.id} field={f} value={edit.answers[f.id]} onChange={(v) => setEdit({ ...edit, answers: { ...edit.answers, [f.id]: v } })} />
              ))}
            </div>
          )}
        </form>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between rounded-lg border border-adm-border bg-adm-surface-2/50 px-3 py-2">
            <span className="text-sm font-medium text-adm-text">Asistencia</span>
            <span className="flex items-center gap-3">
              <Badge tone={present ? 'success' : 'neutral'}>{present ? 'Presente' : 'Ausente'}</Badge>
              <Switch checked={present} onChange={() => onToggleAttendance(reg)} label="Marcar asistencia" />
            </span>
          </div>
          <dl>
            <Row label="WhatsApp">{reg.userWhatsapp || reg.whatsapp}</Row>
            <Row label={reg.cargo || reg.userCargo ? 'Cargo / profesión' : 'Universidad'}>{university}</Row>
            <Row label="País">{reg.userCountry || reg.country}</Row>
            <Row label="Departamento">{reg.userDepartment || reg.department}</Row>
            {(reg.edad || reg.userAge) && <Row label="Edad">{reg.edad || reg.userAge}</Row>}
            <Row label="Comunidad Boreal">{reg.isCommunityMember == null ? null : reg.isCommunityMember ? 'Sí' : 'No'}</Row>
            <Row label="Rol">{labelOf(ROLES, tipo)}</Row>
            {tipo === 'ponente' && <Row label="Ponencia">{reg.customEventName}</Row>}
            <Row label="Modalidad">{labelOf(MODALIDADES, modalidadOf(reg))}</Row>
            <Row label="Registrado">{reg.registrationDate ? formatDateTime(reg.registrationDate) : null}{reg.createdBy ? ` · por ${reg.createdBy}` : ''}</Row>
            {reg.updatedAt && <Row label="Última edición">{formatDateTime(reg.updatedAt)}{reg.updatedBy ? ` · por ${reg.updatedBy}` : ''}</Row>}
          </dl>
          {(fields.length > 0 || orphanAnswers.length > 0) && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-adm-muted">Respuestas adicionales</p>
              <dl>
                {fields.map((f) => <Row key={f.id} label={f.label}><AnswerValue value={reg.answers?.[f.id]} /></Row>)}
                {orphanAnswers.map(([id, v]) => <Row key={id} label={`${id} (campo eliminado)`}><AnswerValue value={v} /></Row>)}
              </dl>
            </div>
          )}
          {(reg.motivo || reg.whyAttend) && (
            <div className="mt-4 rounded-lg border border-adm-border bg-adm-surface-2/50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-adm-muted">¿Por qué quiere asistir?</p>
              <p className="text-sm italic text-adm-text">“{reg.motivo || reg.whyAttend}”</p>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
