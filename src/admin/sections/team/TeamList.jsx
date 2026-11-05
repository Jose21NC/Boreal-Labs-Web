// Listado del equipo publicado en /equipo: filtros, orden, edición y borrado.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, ExternalLink, Link2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { TEAM_TAG_OPTIONS, normalizeSection, normalizeTag, resolveMemberImage } from '@/lib/team';
import {
  Badge, Button, Card, EmptyState, PageHeader, SearchInput, Select, Skeleton, TD, TH, THead, TR, Table, Tabs, useConfirm,
} from '@/admin/ui';
import { downloadCsv, formatRelative, logActivity, normalize, toDate } from '@/admin/lib';
import { GenerateLinkModal, LinkModal } from './Invites';

const SORTERS = {
  name: (m) => normalize(m.name),
  role: (m) => normalize(m.role),
  tag: (m) => normalize(m.memberTag),
  updated: (m) => toDate(m.updatedAt || m.createdAt)?.getTime() || 0,
};

const initials = (name) => String(name || '').split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export default function TeamList() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [members, setMembers] = useState(null);
  const [images, setImages] = useState({});
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [linkFor, setLinkFor] = useState(null); // { member } o {} para nuevo perfil
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!db) { setMembers([]); return undefined; }
    return onSnapshot(collection(db, 'teamMembers'), (snap) => {
      const list = snap.docs.map((d) => {
        const data = { id: d.id, ...d.data() };
        return { ...data, memberSection: normalizeSection(data), memberTag: normalizeTag(data) };
      });
      setMembers(list);
      list.forEach(async (m) => {
        const url = await resolveMemberImage(m);
        setImages((prev) => (prev[m.id] === url ? prev : { ...prev, [m.id]: url }));
      });
    }, (error) => {
      console.error('Error cargando equipo:', error);
      toast({ title: 'No se pudo cargar el equipo', description: error.message, variant: 'destructive' });
      setMembers([]);
    });
  }, [toast]);

  const tags = useMemo(() => [...new Set([...TEAM_TAG_OPTIONS, ...(members || []).map((m) => m.memberTag)])], [members]);

  const counts = useMemo(() => {
    const list = members || [];
    return { all: list.length, DIRECTIVA: list.filter((m) => m.memberSection === 'DIRECTIVA').length, STAFF: list.filter((m) => m.memberSection === 'STAFF').length };
  }, [members]);

  const rows = useMemo(() => {
    const q = normalize(search);
    const get = SORTERS[sort.key];
    return (members || [])
      .filter((m) => section === 'all' || m.memberSection === section)
      .filter((m) => !tag || m.memberTag === tag)
      .filter((m) => !q || normalize(`${m.name} ${m.role} ${m.email} ${m.memberTag}`).includes(q))
      .sort((a, b) => {
        const [x, y] = [get(a), get(b)];
        const r = x < y ? -1 : x > y ? 1 : 0;
        return sort.dir === 'asc' ? r : -r;
      });
  }, [members, search, section, tag, sort]);

  const sortBy = (key) => ({
    sort: sort.key === key ? sort.dir : undefined,
    onSort: () => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' })),
  });

  const remove = async (m) => {
    const ok = await confirm({
      title: `¿Eliminar a ${m.name}?`,
      description: 'Dejará de aparecer en la página pública /equipo. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'teamMembers', m.id));
      logActivity('equipo.eliminado', `Eliminó a ${m.name} del equipo`, { id: m.id });
      toast({ title: 'Integrante eliminado', description: m.name });
    } catch (error) {
      console.error('Error eliminando integrante:', error);
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
    }
  };

  const exportCsv = () => downloadCsv(`equipo-${new Date().toISOString().slice(0, 10)}`, [
    { key: 'name', label: 'Nombre' },
    { key: 'role', label: 'Cargo' },
    { key: 'memberSection', label: 'Grupo' },
    { key: 'memberTag', label: 'Etiqueta' },
    { key: 'email', label: 'Email' },
    { key: 'linkedinUrl', label: 'LinkedIn' },
    { key: 'instagramUrl', label: 'Instagram' },
    { key: 'whatsappUrl', label: 'WhatsApp' },
    { key: 'externalUrl', label: 'Enlace externo' },
  ], rows);

  return (
    <>
      <PageHeader
        title="Equipo"
        description="Integrantes publicados en la página /equipo. Los cambios se reflejan al instante."
        actions={(
          <>
            <Button variant="ghost" onClick={() => window.open('/equipo', '_blank', 'noopener')}><ExternalLink className="h-4 w-4" />Ver página</Button>
            <Button onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" />CSV</Button>
            <Button onClick={() => setLinkFor({})} disabled={!db}><Link2 className="h-4 w-4" />Generar enlace</Button>
            <Button variant="primary" onClick={() => navigate('nuevo')}><Plus className="h-4 w-4" />Nuevo integrante</Button>
          </>
        )}
      >
        <Tabs
          value={section}
          onChange={setSection}
          items={[
            { value: 'all', label: 'Todos', count: counts.all },
            { value: 'DIRECTIVA', label: 'Directiva', count: counts.DIRECTIVA },
            { value: 'STAFF', label: 'Staff', count: counts.STAFF },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, cargo o email…" className="sm:max-w-sm sm:flex-1" />
          <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por etiqueta" className="sm:w-60">
            <option value="">Todas las etiquetas</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </PageHeader>

      <Card>
        {members === null ? (
          <div className="space-y-3 p-5" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={members.length ? 'Sin resultados' : 'Aún no hay integrantes'}
            description={members.length ? 'Prueba con otra búsqueda o filtro.' : 'Agrega al primer integrante para que aparezca en /equipo.'}
            action={members.length
              ? <Button onClick={() => { setSearch(''); setTag(''); setSection('all'); }}>Limpiar filtros</Button>
              : <Button variant="primary" onClick={() => navigate('nuevo')}><Plus className="h-4 w-4" />Nuevo integrante</Button>}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH {...sortBy('name')}>Integrante</TH>
                <TH {...sortBy('role')} className="hidden md:table-cell">Cargo</TH>
                <TH {...sortBy('tag')} className="hidden sm:table-cell">Etiqueta</TH>
                <TH {...sortBy('updated')} className="hidden lg:table-cell">Actualizado</TH>
                <TH className="text-right"><span className="sr-only">Acciones</span></TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <Link to={m.id} className="flex min-w-0 items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-adm-surface-2 text-xs font-semibold text-adm-muted">
                        {images[m.id] ? <img src={images[m.id]} alt="" className="h-full w-full object-cover" loading="lazy" /> : initials(m.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{m.name}</span>
                        <span className="block truncate text-xs text-adm-muted md:hidden">{m.role}</span>
                        <span className="hidden truncate text-xs text-adm-muted md:block">{m.email || 'Sin email'}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD className="hidden md:table-cell">{m.role}</TD>
                  <TD className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={m.memberSection === 'DIRECTIVA' ? 'accent' : 'neutral'}>{m.memberSection === 'DIRECTIVA' ? 'Directiva' : 'Staff'}</Badge>
                      <Badge tone="info">{m.memberTag}</Badge>
                    </div>
                  </TD>
                  <TD className="hidden whitespace-nowrap text-xs text-adm-muted lg:table-cell">
                    {formatRelative(m.updatedAt || m.createdAt)}
                    {m.updatedBy && <span className="block">{m.updatedBy}</span>}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setLinkFor({ member: m })} aria-label={`Enlace de edición para ${m.name}`} title="Enlace de edición"><Link2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(m.id)} aria-label={`Editar a ${m.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="danger-ghost" size="icon" onClick={() => remove(m)} aria-label={`Eliminar a ${m.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <GenerateLinkModal
        key={linkFor?.member?.id || 'nuevo'}
        open={!!linkFor}
        member={linkFor?.member}
        onClose={() => setLinkFor(null)}
        onCreated={(inv) => { setLinkFor(null); setShown(inv); }}
      />
      <LinkModal invite={shown} onClose={() => setShown(null)} />
    </>
  );
}
