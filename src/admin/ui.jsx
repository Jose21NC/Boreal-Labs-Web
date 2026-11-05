// Kit de UI del panel admin. Usa solo los tokens `adm-*` (tailwind.config.js) para que el tema
// claro/oscuro funcione en todo el panel. No usar aquí los componentes públicos de src/components/ui.
import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------- Botones ----------
const BUTTON_VARIANTS = {
  primary: 'bg-adm-accent text-adm-accent-fg hover:bg-adm-accent/90 shadow-sm',
  secondary: 'bg-adm-surface-2 text-adm-text hover:bg-adm-border/70 border border-adm-border',
  outline: 'border border-adm-border text-adm-text hover:bg-adm-surface-2',
  ghost: 'text-adm-muted hover:text-adm-text hover:bg-adm-surface-2',
  danger: 'bg-adm-danger text-white hover:bg-adm-danger/90',
  'danger-ghost': 'text-adm-danger hover:bg-adm-danger/10',
};
const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9 justify-center',
};

export const Button = React.forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent focus-visible:ring-offset-2 focus-visible:ring-offset-adm-bg',
        'disabled:opacity-50 disabled:pointer-events-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

// ---------- Formularios ----------
const fieldBase =
  'w-full rounded-lg border border-adm-border bg-adm-surface text-adm-text placeholder:text-adm-muted/70 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-adm-accent/60 focus:border-adm-accent disabled:opacity-60';

export const Input = React.forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-10 px-3', className)} {...props} />;
});

export const Textarea = React.forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, 'px-3 py-2 resize-y', className)} {...props} />;
});

export const Select = React.forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, 'h-10 px-3 pr-8 cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
});

export const Label = ({ className, ...props }) => (
  <label className={cn('text-xs font-semibold uppercase tracking-wide text-adm-muted', className)} {...props} />
);

/** Etiqueta + control + ayuda/error. El control recibe `id` automáticamente si no lo trae. */
export function Field({ label, hint, error, children, className }) {
  const autoId = useId();
  const child = React.Children.only(children);
  const id = child.props.id || autoId;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {React.cloneElement(child, { id, 'aria-invalid': error ? true : undefined })}
      {error ? <p className="text-xs text-adm-danger">{error}</p> : hint ? <p className="text-xs text-adm-muted">{hint}</p> : null}
    </div>
  );
}

export const Checkbox = ({ className, label, ...props }) => (
  <label className={cn('inline-flex items-center gap-2 text-sm text-adm-text cursor-pointer select-none', className)}>
    <input type="checkbox" className="h-4 w-4 rounded border-adm-border accent-[rgb(var(--adm-accent))]" {...props} />
    {label}
  </label>
);

/** Interruptor accesible (role=switch). */
export function Switch({ checked, onChange, label, disabled, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent disabled:opacity-50',
        checked ? 'bg-adm-accent' : 'bg-adm-border',
        className,
      )}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 [transition-timing-function:cubic-bezier(.34,1.36,.64,1)]', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className, inputRef, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-muted" aria-hidden="true" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
        {...props}
      />
    </div>
  );
}

// ---------- Superficies ----------
export const Card = ({ className, ...props }) => (
  <div className={cn('rounded-xl border border-adm-border bg-adm-surface', className)} {...props} />
);

export function CardHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-adm-border px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-adm-text">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-adm-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export const CardBody = ({ className, ...props }) => <div className={cn('p-5', className)} {...props} />;

export function StatCard({ label, value, hint, icon: Icon, tone = 'accent', onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'adm-fade-in rounded-xl border border-adm-border bg-adm-surface p-4 text-left',
        onClick && 'transition-[border-color,transform] duration-150 hover:border-adm-accent/60 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-adm-muted">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4', TONE_TEXT[tone])} aria-hidden="true" />}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-adm-text">{value}</div>
      {hint && <div className="mt-1 text-xs text-adm-muted">{hint}</div>}
    </Comp>
  );
}

const TONE_TEXT = {
  neutral: 'text-adm-muted',
  accent: 'text-adm-accent',
  success: 'text-adm-success',
  warning: 'text-adm-warning',
  danger: 'text-adm-danger',
  info: 'text-adm-info',
};
const TONE_BADGE = {
  neutral: 'bg-adm-surface-2 text-adm-muted border-adm-border',
  accent: 'bg-adm-accent/10 text-adm-accent border-adm-accent/30',
  success: 'bg-adm-success/10 text-adm-success border-adm-success/30',
  warning: 'bg-adm-warning/10 text-adm-warning border-adm-warning/30',
  danger: 'bg-adm-danger/10 text-adm-danger border-adm-danger/30',
  info: 'bg-adm-info/10 text-adm-info border-adm-info/30',
};

export const Badge = ({ tone = 'neutral', className, ...props }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', TONE_BADGE[tone], className)} {...props} />
);

export const Kbd = ({ children }) => (
  <kbd className="rounded border border-adm-border bg-adm-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-adm-muted">{children}</kbd>
);

export const Skeleton = ({ className }) => <div className={cn('animate-pulse rounded-md bg-adm-surface-2', className)} aria-hidden="true" />;

export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-adm-text">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-adm-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-3 rounded-full bg-adm-surface-2 p-3">
          <Icon className="h-6 w-6 text-adm-muted" aria-hidden="true" />
        </div>
      )}
      <p className="text-sm font-semibold text-adm-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-adm-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const EASE_OUT = [0.23, 1, 0.32, 1];

/** Pestañas controladas: items = [{ value, label, count? }]. El subrayado activo se desliza (layoutId). */
export function Tabs({ items, value, onChange, className }) {
  const indicatorId = useId();
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-adm-border', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-adm-accent rounded-t',
              active ? 'text-adm-text' : 'text-adm-muted hover:text-adm-text',
            )}
          >
            {item.label}
            {item.count != null && <span className="rounded-full bg-adm-surface-2 px-1.5 text-xs tabular-nums text-adm-muted">{item.count}</span>}
            {active && (
              <motion.span
                layoutId={indicatorId}
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-adm-accent"
                transition={{ duration: 0.2, ease: EASE_OUT }}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Tabla ----------
/** `sticky`: cabecera fija dentro de un contenedor con scroll propio (tablas largas). */
export const Table = ({ className, sticky, children }) => (
  <div className={cn('overflow-x-auto', sticky && 'max-h-[min(70vh,760px)] overflow-y-auto overscroll-contain')} data-sticky={sticky || undefined}>
    <table className={cn('w-full text-sm', className)}>{children}</table>
  </div>
);
export const THead = ({ children }) => (
  <thead className="border-b border-adm-border bg-adm-surface-2/60 text-left text-xs font-semibold uppercase tracking-wide text-adm-muted [[data-sticky]_&]:sticky [[data-sticky]_&]:top-0 [[data-sticky]_&]:z-[1] [[data-sticky]_&]:bg-adm-surface-2 [[data-sticky]_&]:shadow-[inset_0_-1px_0_rgb(var(--adm-border))]">{children}</thead>
);
export const TH = ({ className, sort, onSort, children, ...props }) => (
  <th className={cn('px-4 py-3 font-semibold', className)} aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined} {...props}>
    {onSort ? (
      <button type="button" onClick={onSort} className="inline-flex items-center gap-1 uppercase transition-colors duration-150 hover:text-adm-text">
        {children}
        <span aria-hidden="true">{sort === 'asc' ? '↑' : sort === 'desc' ? '↓' : '↕'}</span>
      </button>
    ) : children}
  </th>
);
// adm-fade-in corre solo al montar la fila (filas nuevas o al pasar de skeleton a datos), no en cada render.
export const TR = ({ className, selected, ...props }) => (
  <tr className={cn('adm-fade-in border-b border-adm-border/70 last:border-0 transition-colors duration-150 hover:bg-adm-surface-2/50', selected && 'bg-adm-accent/5', className)} {...props} />
);
export const TD = ({ className, ...props }) => <td className={cn('px-4 py-3 align-middle text-adm-text', className)} {...props} />;

// ---------- Modal ----------
// Pila de modales abiertos: Escape cierra solo el de arriba (p. ej. una confirmación sobre un formulario).
const openModals = [];
const smUp = () => window.matchMedia?.('(min-width: 640px)').matches ?? true;

/**
 * Mientras sale (animación de cierre) muestra el último contenido abierto: así un modal con
 * `open={!!item}` no parpadea vacío al cerrarse.
 */
export function Modal({ open, ...props }) {
  const last = useRef(props);
  if (open) last.current = props;
  return <AnimatePresence>{open && <ModalPanel key="modal" {...last.current} />}</AnimatePresence>;
}

function ModalPanel({ onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  // onClose suele ser una función nueva en cada render: con un ref el efecto corre solo al abrir y no roba el foco.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [desktop] = useState(smUp);

  useEffect(() => {
    const token = {};
    openModals.push(token);
    const previous = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape' && openModals[openModals.length - 1] === token) onCloseRef.current?.(); };
    document.addEventListener('keydown', onKey);
    const focusable = panelRef.current?.querySelector('input, select, textarea, button:not([data-close])');
    (focusable || panelRef.current)?.focus();
    return () => {
      openModals.splice(openModals.indexOf(token), 1);
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }[size];
  // Escritorio: escala .98→1 + fade. Móvil: hoja que sube desde abajo. La salida es más corta que la entrada.
  const hidden = desktop ? { opacity: 0, scale: 0.98 } : { opacity: 1, y: '100%' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => onCloseRef.current?.()}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.2 } }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-adm-border bg-adm-surface shadow-2xl outline-none sm:rounded-2xl', width)}
        initial={hidden}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: desktop ? 0.2 : 0.28, ease: desktop ? EASE_OUT : [0.32, 0.72, 0, 1] } }}
        exit={{ ...hidden, transition: { duration: desktop ? 0.12 : 0.2, ease: 'easeOut' } }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-adm-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-adm-text">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-adm-muted">{description}</p>}
          </div>
          <Button data-close variant="ghost" size="icon" onClick={() => onCloseRef.current?.()} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-adm-border px-5 py-3">{footer}</div>}
      </motion.div>
    </div>
  );
}

// ---------- Confirmación (reemplaza window.confirm) ----------
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((options) => new Promise((resolve) => setState({ ...options, resolve })), []);
  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title || '¿Confirmar?'}
        description={state?.description}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => close(false)}>{state?.cancelLabel || 'Cancelar'}</Button>
            <Button variant={state?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
              {state?.confirmLabel || 'Confirmar'}
            </Button>
          </>
        )}
      >
        {state?.body || null}
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** `const confirm = useConfirm(); if (await confirm({ title, description, tone: 'danger' })) …` */
export const useConfirm = () => useContext(ConfirmContext);
