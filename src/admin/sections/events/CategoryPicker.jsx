// Selector de categoría con alta rápida y gestor de categorías personalizadas (siteConfig/eventCategories).
// Las integradas no se renombran ni se borran. La clave de una categoría nueva no cambia al renombrarla.
import React, { useState } from 'react';
import { Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';
import { Button, Input, Label, Modal, Select, useConfirm } from '@/admin/ui';
import { logActivity, normalize } from '@/admin/lib';
import { useToast } from '@/components/ui/use-toast';
import { useEventsStore } from './store';
import { categoryOf } from './data';
import { saveCategories } from './actions';

const slug = (label) => normalize(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'categoria';

/** Guarda la lista, actualiza el estado local y registra la actividad. Devuelve true si se guardó. */
function useSaveCategories() {
  const { setCatItems } = useEventsStore();
  const { toast } = useToast();
  return async (items, action, summary, success) => {
    try {
      await saveCategories(items);
      setCatItems(items);
      await logActivity(action, summary);
      toast({ title: success });
      return true;
    } catch (e) {
      console.error(e);
      toast({ title: 'No se pudo guardar la categoría', description: e?.message, variant: 'destructive' });
      return false;
    }
  };
}

const onEnter = (fn) => (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };

export default function CategoryPicker({ id, value, onChange }) {
  const { categories, catItems } = useEventsStore();
  const save = useSaveCategories();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [managing, setManaging] = useState(false);

  const add = async () => {
    const clean = label.trim();
    if (!clean) return;
    if (categories.some((c) => normalize(c.label) === normalize(clean))) { onChange(categories.find((c) => normalize(c.label) === normalize(clean)).value); setAdding(false); setLabel(''); return; }
    let key = slug(clean);
    for (let i = 2; categories.some((c) => c.value === key); i += 1) key = `${slug(clean)}-${i}`;
    if (await save([...catItems, { key, label: clean.slice(0, 40) }], 'eventos.categoria_creada', `Creó la categoría "${clean}"`, 'Categoría creada')) {
      onChange(key);
      setLabel('');
      setAdding(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>Categoría</Label>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setManaging(true)} aria-label="Gestionar categorías" title="Gestionar categorías">
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      {adding ? (
        <div className="flex gap-1.5">
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              // Escape cancela el alta sin cerrar el modal del evento (su listener está en document).
              if (e.key === 'Escape') { e.nativeEvent.stopPropagation(); setAdding(false); setLabel(''); } else onEnter(add)(e);
            }}
            maxLength={40}
            placeholder="Nombre"
            aria-label="Nombre de la nueva categoría"
          />
          <Button size="icon" variant="primary" onClick={add} disabled={!label.trim()} aria-label="Crear categoría"><Plus className="h-4 w-4" aria-hidden="true" /></Button>
          <Button size="icon" variant="ghost" onClick={() => { setAdding(false); setLabel(''); }} aria-label="Cancelar nueva categoría"><X className="h-4 w-4" aria-hidden="true" /></Button>
        </div>
      ) : (
        <Select
          id={id}
          value={value}
          onChange={(e) => (e.target.value === '__new' ? setAdding(true) : onChange(e.target.value))}
        >
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          {!categories.some((c) => c.value === value) && <option value={value}>{value}</option>}
          <option value="__new">+ Nueva categoría…</option>
        </Select>
      )}
      <CategoryManager open={managing} onClose={() => setManaging(false)} />
    </div>
  );
}

function CategoryManager({ open, onClose }) {
  const { categories, catItems, events } = useEventsStore();
  const save = useSaveCategories();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // { key, label }

  const rename = async () => {
    const clean = editing.label.trim();
    const old = catItems.find((c) => c.key === editing.key);
    if (!clean || clean === old.label) { setEditing(null); return; }
    if (await save(catItems.map((c) => (c.key === editing.key ? { ...c, label: clean.slice(0, 40) } : c)), 'eventos.categoria_renombrada', `Renombró la categoría "${old.label}" a "${clean}"`, 'Categoría renombrada')) setEditing(null);
  };

  const remove = async (c) => {
    const used = events.filter((ev) => categoryOf(ev) === c.value).length;
    const ok = await confirm({
      title: `¿Eliminar la categoría "${c.label}"?`,
      description: used ? `${used} evento(s) la usan: seguirán mostrando "${c.value}" hasta que les asignes otra.` : 'Ningún evento la usa.',
      confirmLabel: 'Eliminar', tone: 'danger',
    });
    if (ok) await save(catItems.filter((x) => x.key !== c.value), 'eventos.categoria_eliminada', `Eliminó la categoría "${c.label}"`, 'Categoría eliminada');
  };

  return (
    <Modal open={open} onClose={onClose} title="Categorías de eventos" description="Las integradas no se pueden editar. Las nuevas aparecen como filtro en /eventos." size="sm">
      <ul className="divide-y divide-adm-border">
        {categories.map((c) => (
          <li key={c.value} className="flex items-center gap-2 py-2">
            {editing?.key === c.value ? (
              <>
                <Input autoFocus value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} onKeyDown={onEnter(rename)} maxLength={40} aria-label={`Nuevo nombre de ${c.label}`} className="h-8" />
                <Button size="sm" variant="primary" onClick={rename}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-adm-text">{c.label} <span className="text-xs text-adm-muted">· {c.custom ? c.value : 'integrada'}</span></span>
                {c.custom && (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing({ key: c.value, label: c.label })} aria-label={`Renombrar ${c.label}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                    <Button size="icon" variant="danger-ghost" className="h-7 w-7" onClick={() => remove(c)} aria-label={`Eliminar ${c.label}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-adm-muted">Para crear una, elige “+ Nueva categoría…” en el selector.</p>
    </Modal>
  );
}
