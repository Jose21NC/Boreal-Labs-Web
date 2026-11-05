// Contenido del sitio: siteConfig/home (impacto, aliados) y siteConfig/links.
// HomePage, Navbar y Footer leen estos documentos (src/lib/useSiteConfig.js).
import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RotateCcw, Save } from 'lucide-react';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { ImpactGrid, PartnerGrid } from '@/components/HomeConfigSections';
import { defaultHomeConfig, isHttpUrl, resolveHomeConfig, resolveLinks } from '@/lib/siteDefaults';
import { Badge, Button, Card, CardBody, CardHeader, PageHeader, Skeleton, Tabs, useConfirm } from '@/admin/ui';
import { formatDateTime, logActivity } from '@/admin/lib';
import ImpactsEditor from './ImpactsEditor';
import PartnersEditor from './PartnersEditor';
import ImagesEditor from './ImagesEditor';
import LinksEditor, { LINK_FIELDS } from './LinksEditor';

// Firestore rechaza `undefined`: JSON lo elimina.
const clean = (value) => JSON.parse(JSON.stringify(value));

function validate({ impacts, partners }, links) {
  const errors = {};
  impacts.forEach((it, i) => {
    if (!String(it.metric || '').trim()) errors[`impacts.${i}.metric`] = 'Obligatorio';
    if (!String(it.description || '').trim()) errors[`impacts.${i}.description`] = 'Obligatorio';
  });
  partners.forEach((p, i) => {
    if (!String(p.name || '').trim()) errors[`partners.${i}.name`] = 'Obligatorio';
    // Assets locales (/…) solo los de los aliados por defecto; lo nuevo debe ser http(s) o subido.
    if (!/^(https?:|blob:|\/)/i.test(String(p.imgSrc || '').trim())) errors[`partners.${i}.imgSrc`] = 'Sube un logo o pega una URL http(s).';
  });
  Object.keys(links).forEach((key) => {
    if (links[key] && !isHttpUrl(links[key])) errors[`links.${key}`] = 'Debe empezar con http:// o https://';
  });
  return errors;
}

const tabOf = (key) => key.split('.')[0];

function Preview({ children }) {
  // El sitio público siempre es oscuro: la vista previa replica ese fondo.
  return <div className="overflow-hidden rounded-xl bg-boreal-dark p-4 text-white sm:p-6">{children}</div>;
}

export default function SiteSection() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('impacts');
  const [saved, setSaved] = useState(null); // { home, links, meta }
  const [home, setHome] = useState(null);
  const [links, setLinks] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [h, l] = db
          ? await Promise.all([getDoc(doc(db, 'siteConfig', 'home')), getDoc(doc(db, 'siteConfig', 'links'))])
          : [null, null];
        const hData = h?.exists() ? h.data() : {};
        const lData = l?.exists() ? l.data() : {};
        const state = {
          home: resolveHomeConfig(hData),
          links: Object.fromEntries(LINK_FIELDS.map(({ key }) => [key, resolveLinks(lData)[key] || ''])),
          meta: { home: hData, links: lData },
        };
        if (!alive) return;
        setSaved(state);
        setHome(state.home);
        setLinks(state.links);
      } catch (error) {
        console.error('Error cargando siteConfig:', error);
        toast({ title: 'No se pudo cargar la configuración', description: error.message, variant: 'destructive' });
      }
    })();
    return () => { alive = false; };
  }, [toast]);

  const homeDirty = !!saved && JSON.stringify(home) !== JSON.stringify(saved.home);
  const linksDirty = !!saved && JSON.stringify(links) !== JSON.stringify(saved.links);
  const errors = useMemo(() => (home && links ? validate(home, links) : {}), [home, links]);
  const visibleErrors = showErrors ? errors : {};
  const errorTabs = new Set(Object.keys(visibleErrors).map(tabOf));

  const save = async () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      setTab(tabOf(Object.keys(errors)[0]));
      toast({ title: 'Revisa los campos marcados', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const meta = { updatedAt: serverTimestamp(), updatedBy: auth?.currentUser?.email || null };
      const batch = writeBatch(db);
      const homeDoc = clean({
        impacts: home.impacts.map((it) => ({ icon: it.icon || 'Heart', metric: it.metric.trim(), description: it.description.trim() })),
        partners: home.partners.map((p) => ({ ...p, name: p.name.trim(), alt: (p.alt || '').trim() || `Logo ${p.name.trim()}`, imgSrc: p.imgSrc.trim() })),
        images: home.images,
      });
      if (homeDirty) batch.set(doc(db, 'siteConfig', 'home'), { ...homeDoc, ...meta });
      if (linksDirty) batch.set(doc(db, 'siteConfig', 'links'), { ...clean(links), ...meta });
      await batch.commit();
      if (homeDirty) logActivity('sitio.home', `Actualizó el inicio: ${homeDoc.impacts.length} métricas, ${homeDoc.partners.length} aliados y ${Object.values(home.images).filter(Boolean).length} imágenes personalizadas`);
      if (linksDirty) {
        const changed = LINK_FIELDS.filter((f) => links[f.key] !== saved.links[f.key]).map((f) => f.label);
        logActivity('sitio.enlaces', `Cambió enlaces del sitio: ${changed.join(', ')}`);
      }
      import('@/lib/configService').then((m) => m.invalidateSiteConfig());
      const now = { updatedAt: new Date(), updatedBy: meta.updatedBy };
      setSaved((prev) => ({
        home: homeDirty ? homeDoc : prev.home,
        links,
        meta: { home: homeDirty ? now : prev.meta.home, links: linksDirty ? now : prev.meta.links },
      }));
      setHome(homeDirty ? homeDoc : home);
      setShowErrors(false);
      toast({ title: 'Cambios publicados', description: 'El sitio público ya muestra la nueva versión.' });
    } catch (error) {
      console.error('Error guardando siteConfig:', error);
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    if (!(await confirm({ title: '¿Descartar cambios?', description: 'Se perderán las ediciones que no guardaste.', confirmLabel: 'Descartar', tone: 'danger' }))) return;
    setHome(saved.home);
    setLinks(saved.links);
    setShowErrors(false);
  };

  const restoreDefaults = async () => {
    const what = tab === 'impacts' ? 'las métricas' : 'los aliados';
    if (!(await confirm({ title: `¿Restaurar ${what} por defecto?`, description: 'Se reemplaza la lista actual. No se publica hasta que guardes.', confirmLabel: 'Restaurar' }))) return;
    setHome((prev) => ({ ...prev, [tab]: defaultHomeConfig[tab] }));
  };

  if (!home || !links) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const lastEdit = (m) => (m?.updatedAt ? `Última edición ${formatDateTime(m.updatedAt)}${m.updatedBy ? ` por ${m.updatedBy}` : ''}` : 'Sin cambios guardados: se muestran los valores por defecto');
  const dirty = homeDirty || linksDirty;

  return (
    <>
      <PageHeader
        title="Contenido del sitio"
        description="Métricas de impacto, aliados, imágenes y enlaces que muestra el sitio público."
        actions={(
          <>
            <Button variant="ghost" onClick={() => window.open('/', '_blank', 'noopener')}><ExternalLink className="h-4 w-4" />Ver inicio</Button>
            {dirty && <Button onClick={discard}>Descartar</Button>}
            <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}><Save className="h-4 w-4" />Guardar y publicar</Button>
          </>
        )}
      >
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'impacts', label: `Impacto${errorTabs.has('impacts') ? ' ⚠' : ''}`, count: home.impacts.length },
            { value: 'partners', label: `Aliados${errorTabs.has('partners') ? ' ⚠' : ''}`, count: home.partners.length },
            { value: 'images', label: 'Imágenes', count: Object.values(home.images).filter(Boolean).length },
            { value: 'links', label: `Enlaces${errorTabs.has('links') ? ' ⚠' : ''}` },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-adm-muted">
          {dirty && <Badge tone="warning">Cambios sin publicar</Badge>}
          <span>{lastEdit(tab === 'links' ? saved.meta.links : saved.meta.home)}</span>
        </div>
      </PageHeader>

      {tab === 'links' ? (
        <LinksEditor links={links} onChange={setLinks} errors={visibleErrors} />
      ) : tab === 'images' ? (
        <ImagesEditor images={home.images} onChange={(images) => setHome((p) => ({ ...p, images }))} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Vista previa" description={tab === 'impacts' ? 'Sección “Nuestro impacto en números” del inicio.' : 'Sección “Nuestros aliados estratégicos” del inicio.'} />
            <CardBody>
              <Preview>
                {tab === 'impacts'
                  ? <ImpactGrid impacts={home.impacts} />
                  : <PartnerGrid partners={home.partners.filter((p) => p.imgSrc)} />}
              </Preview>
            </CardBody>
          </Card>
          <div>
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="ghost" onClick={restoreDefaults}><RotateCcw className="h-3.5 w-3.5" />Restaurar por defecto</Button>
            </div>
            {tab === 'impacts'
              ? <ImpactsEditor impacts={home.impacts} onChange={(impacts) => setHome((p) => ({ ...p, impacts }))} errors={visibleErrors} />
              : <PartnersEditor partners={home.partners} onChange={(partners) => setHome((p) => ({ ...p, partners }))} errors={visibleErrors} />}
          </div>
        </div>
      )}
    </>
  );
}
