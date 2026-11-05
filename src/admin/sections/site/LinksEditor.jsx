// Enlaces globales: Navbar (wallet, comunidad), Footer e Inicio (Instagram, comunidad).
import React from 'react';
import { Card, CardBody, CardHeader, Field, Input } from '@/admin/ui';

export const LINK_FIELDS = [
  { key: 'communityUrl', label: 'Comunidad (WhatsApp)', where: 'Navbar e Inicio', placeholder: 'https://chat.whatsapp.com/…' },
  { key: 'walletUrl', label: 'Boreal Wallet', where: 'Navbar', placeholder: 'https://wallet.borealabs.org' },
  { key: 'instagramUrl', label: 'Instagram', where: 'Inicio y Footer', placeholder: 'https://instagram.com/boreal.labs' },
  { key: 'youtubeVideoUrl', label: 'Video de YouTube', where: 'Reservado: hoy ninguna página lo muestra', placeholder: 'https://www.youtube.com/watch?v=…' },
];

export default function LinksEditor({ links, onChange, errors }) {
  return (
    <Card>
      <CardHeader title="Enlaces del sitio" description="Solo se aceptan URLs http(s). Si un campo queda vacío se usa el valor por defecto." />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {LINK_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={`Se usa en: ${f.where}`} error={errors[`links.${f.key}`]}>
            <Input type="url" value={links[f.key] || ''} onChange={(e) => onChange({ ...links, [f.key]: e.target.value })} placeholder={f.placeholder} />
          </Field>
        ))}
      </CardBody>
    </Card>
  );
}
