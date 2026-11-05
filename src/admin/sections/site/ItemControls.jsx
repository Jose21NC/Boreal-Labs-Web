// Subir / bajar / quitar un elemento de una lista editable (el orden es el de la página pública).
import React from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button } from '@/admin/ui';

export const moveItem = (list, from, to) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export default function ItemControls({ index, total, label, onMove, onRemove }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Subir ${label}`}><ArrowUp className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Bajar ${label}`}><ArrowDown className="h-4 w-4" /></Button>
      <Button variant="danger-ghost" size="icon" onClick={() => onRemove(index)} aria-label={`Quitar ${label}`}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}
