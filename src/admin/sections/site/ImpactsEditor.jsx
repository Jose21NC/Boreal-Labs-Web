// Métricas de "Nuestro impacto en números".
import React from 'react';
import { Plus } from 'lucide-react';
import { IMPACT_ICONS } from '@/components/HomeConfigSections';
import { Button, Card, CardBody, Field, Input, Label } from '@/admin/ui';
import { cn } from '@/lib/utils';
import ItemControls, { moveItem } from './ItemControls';

const ICON_LABELS = {
  Heart: 'Corazón', Award: 'Premio', University: 'Educación', Zap: 'Energía', Building: 'Institución',
  Mic: 'Charlas', Instagram: 'Redes', Star: 'Estrella', Users: 'Comunidad',
};

export default function ImpactsEditor({ impacts, onChange, errors }) {
  const update = (i, field, value) => onChange(impacts.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  return (
    <div className="space-y-3">
      {impacts.map((impact, i) => (
        <Card key={i}>
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-[140px_1fr]">
                <Field label="Métrica" error={errors[`impacts.${i}.metric`]}>
                  <Input value={impact.metric || ''} onChange={(e) => update(i, 'metric', e.target.value)} placeholder="+850" />
                </Field>
                <Field label="Descripción" error={errors[`impacts.${i}.description`]}>
                  <Input value={impact.description || ''} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Jóvenes impactados a nivel nacional." />
                </Field>
              </div>
              <ItemControls
                index={i}
                total={impacts.length}
                label={`métrica ${impact.metric || i + 1}`}
                onMove={(from, to) => onChange(moveItem(impacts, from, to))}
                onRemove={(idx) => onChange(impacts.filter((_, k) => k !== idx))}
              />
            </div>
            <div>
              <Label>Ícono</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Ícono de la métrica">
                {Object.entries(IMPACT_ICONS).map(([name, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    title={ICON_LABELS[name]}
                    aria-label={ICON_LABELS[name]}
                    aria-pressed={impact.icon === name}
                    onClick={() => update(i, 'icon', name)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
                      impact.icon === name ? 'border-adm-accent bg-adm-accent/10 text-adm-accent' : 'border-adm-border text-adm-muted hover:text-adm-text',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
      <Button className="w-full" onClick={() => onChange([...impacts, { icon: 'Star', metric: '', description: '' }])}>
        <Plus className="h-4 w-4" />Agregar métrica
      </Button>
    </div>
  );
}
