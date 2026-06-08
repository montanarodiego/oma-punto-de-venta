import { useState, useEffect, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import { useSession } from '../context/SessionContext';
import { Button, Field, Input, Modal, Badge } from '../components/ui';

function handleNumericKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const modal = (e.currentTarget as HTMLElement).closest('[data-modal]');
  if (!modal) return;
  const sel = 'button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled])';
  const els = Array.from(modal.querySelectorAll<HTMLElement>(sel));
  const idx = els.indexOf(e.currentTarget as HTMLElement);
  if (idx < 0) return;
  els[e.key === 'ArrowDown' ? Math.min(idx + 1, els.length - 1) : Math.max(idx - 1, 0)]?.focus();
}

// ── Types ────────────────────────────────────────────────────────────────────

type EstadoPedido = 'borrador' | 'enviado' | 'recibido' | 'cancelado';

interface PedidoItemDB {
  id: number;
  articulo_id: number | null;
  articulo_nombre: string | null;
  articulo_codigo: string | null;
  unidad_medida: string | null;
  descripcion_libre: string | null;
  cantidad_pedida: number;
  cantidad_recibida: number | null;
  costo_unitario: number;
}

interface PedidoDB {
  id: number;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  proveedor_label: string;
  estado: EstadoPedido;
  notas: string | null;
  fecha_creacion: string;
  fecha_envio: string | null;
  fecha_recepcion: string | null;
  total_items: number;
  items?: PedidoItemDB[];
}

interface FormItem {
  _key: number;
  articulo_id: number | null;
  display_nombre: string;
  descripcion_libre: string;
  cantidad_pedida: number;
  costo_unitario: number;
}

interface ArtResult {
  id: number;
  nombre: string;
  codigo: string;
  costo_unitario: number;
  unidad_medida: string;
}

interface ProveedorMin {
  id: number;
  nombre: string;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<EstadoPedido, { label: string; variant: 'yellow' | 'blue' | 'green' | 'red' }> = {
  borrador:  { label: 'Borrador',  variant: 'yellow' },
  enviado:   { label: 'Enviado',   variant: 'blue'   },
  recibido:  { label: 'Recibido',  variant: 'green'  },
  cancelado: { label: 'Cancelado', variant: 'red'    },
};

const FILTROS: { value: EstadoPedido | 'todos'; label: string }[] = [
  { value: 'todos',     label: 'Todos'     },
  { value: 'borrador',  label: 'Borrador'  },
  { value: 'enviado',   label: 'Enviado'   },
  { value: 'recibido',  label: 'Recibido'  },
  { value: 'cancelado', label: 'Cancelado' },
];

// ── Utilidades ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(s: string | null) {
  if (!s) return '—';
  return new Date(s.includes('T') ? s : s + 'Z').toLocaleDateString('es-AR');
}

function totalItems(items: Pick<PedidoItemDB, 'cantidad_pedida' | 'costo_unitario'>[]) {
  return items.reduce((sum, i) => sum + i.cantidad_pedida * i.costo_unitario, 0);
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function ErrBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px] rounded-[var(--r-in)]">
      {msg}
    </div>
  );
}

function AccionBtn({
  title, onClick, disabled = false, variant = 'default', children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'success';
  children: React.ReactNode;
}) {
  const cls = variant === 'danger'
    ? 'text-text-subtle hover:text-danger'
    : variant === 'success'
      ? 'text-text-subtle hover:text-[#4ade80]'
      : 'text-text-subtle hover:text-accent';
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

// ── Modal: Nuevo / Editar pedido ──────────────────────────────────────────────

function ModalNuevoPedido({
  open, pedido, proveedores, usuarioId, onClose, onGuardado,
}: {
  open: boolean;
  pedido: PedidoDB | null;
  proveedores: ProveedorMin[];
  usuarioId: number | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [provId, setProvId]         = useState<number | ''>('');
  const [provNombre, setProvNombre] = useState('');
  const [notas, setNotas]           = useState('');
  const [items, setItems]           = useState<FormItem[]>([]);
  const [artQ, setArtQ]             = useState('');
  const [artRes, setArtRes]         = useState<ArtResult[]>([]);
  const [artLoading, setArtLoading] = useState(false);
  const [nextKeyVal, setNextKeyVal] = useState(0);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setError(''); setArtQ(''); setArtRes([]);
    if (pedido) {
      setProvId(pedido.proveedor_id ?? '');
      setProvNombre(pedido.proveedor_nombre ?? '');
      setNotas(pedido.notas ?? '');
      const mapped = (pedido.items ?? []).map((i, idx) => ({
        _key: idx,
        articulo_id:      i.articulo_id,
        display_nombre:   i.articulo_nombre ?? i.descripcion_libre ?? '',
        descripcion_libre: i.descripcion_libre ?? '',
        cantidad_pedida:  i.cantidad_pedida,
        costo_unitario:   i.costo_unitario,
      }));
      setItems(mapped);
      setNextKeyVal(mapped.length);
    } else {
      setProvId(''); setProvNombre(''); setNotas(''); setItems([]); setNextKeyVal(0);
    }
  }, [open, pedido]);

  // Búsqueda de artículos (debounced)
  useEffect(() => {
    if (!artQ.trim()) { setArtRes([]); return; }
    const t = setTimeout(async () => {
      setArtLoading(true);
      try { setArtRes((await window.api.articulos.search(artQ)).slice(0, 8)); }
      catch { setArtRes([]); }
      finally { setArtLoading(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [artQ]);

  function agregarArticulo(art: ArtResult) {
    const k = nextKeyVal;
    setNextKeyVal(k + 1);
    setItems(prev => [...prev, {
      _key: k,
      articulo_id:      art.id,
      display_nombre:   art.nombre,
      descripcion_libre: '',
      cantidad_pedida:  1,
      costo_unitario:   art.costo_unitario,
    }]);
    setArtQ(''); setArtRes([]);
  }

  function agregarLibre() {
    const k = nextKeyVal;
    setNextKeyVal(k + 1);
    setItems(prev => [...prev, {
      _key: k,
      articulo_id:      null,
      display_nombre:   '',
      descripcion_libre: '',
      cantidad_pedida:  1,
      costo_unitario:   0,
    }]);
  }

  function upd(key: number, ch: Partial<FormItem>) {
    setItems(prev => prev.map(i => i._key === key ? { ...i, ...ch } : i));
  }

  async function guardar() {
    if (!provId && !provNombre.trim()) { setError('Elegí o escribí un proveedor.'); return; }
    if (items.length === 0)           { setError('Agregá al menos un ítem.');       return; }
    for (const it of items) {
      if (!it.articulo_id && !it.descripcion_libre.trim()) { setError('Los ítems libres necesitan descripción.'); return; }
      if (!(it.cantidad_pedida > 0))                       { setError('Las cantidades deben ser mayores a 0.');   return; }
    }
    setSaving(true); setError('');
    try {
      const payload = {
        proveedor_id:     provId || null,
        proveedor_nombre: provId ? null : provNombre.trim() || null,
        notas:            notas.trim() || null,
        usuario_id:       usuarioId,
        items: items.map(i => ({
          articulo_id:      i.articulo_id,
          descripcion_libre: i.articulo_id ? null : (i.descripcion_libre.trim() || null),
          cantidad_pedida:  i.cantidad_pedida,
          costo_unitario:   i.costo_unitario,
        })),
      };
      if (pedido) {
        await window.api.pedidosCompra.actualizar(pedido.id, payload);
        showToast('Pedido actualizado.', 'ok');
      } else {
        await window.api.pedidosCompra.crear(payload);
        showToast('Pedido creado.', 'ok');
      }
      onGuardado(); onClose();
    } catch (err: any) { setError(err.message ?? 'Error al guardar.'); }
    finally { setSaving(false); }
  }

  const totalEst = items.reduce((s, i) => s + i.cantidad_pedida * i.costo_unitario, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pedido ? `Editar pedido #${pedido.id}` : 'Nueva orden de compra'}
      maxWidth="680px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={guardar}>
            {pedido ? 'Guardar cambios' : 'Crear pedido'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">

        {/* Proveedor */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Proveedor (de la lista)">
            <select
              className="inp"
              value={provId}
              onChange={e => { setProvId(e.target.value ? Number(e.target.value) : ''); if (e.target.value) setProvNombre(''); }}
            >
              <option value="">— seleccioná —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Field>
          <Field label="O escribí el nombre">
            <Input
              placeholder="Proveedor libre"
              value={provNombre}
              disabled={!!provId}
              onChange={e => { setProvNombre(e.target.value); if (e.target.value) setProvId(''); }}
            />
          </Field>
        </div>

        <Field label="Notas">
          <textarea
            className="inp"
            rows={2}
            placeholder="Observaciones del pedido..."
            value={notas}
            onChange={e => setNotas(e.target.value)}
          />
        </Field>

        {/* Buscador de artículos */}
        <div>
          <div className="text-[11px] font-semibold text-text-muted mb-2 uppercase tracking-wider">Artículos del pedido</div>
          <div className="relative">
            <Input
              placeholder="Buscá artículo por nombre o código para agregar..."
              value={artQ}
              onChange={e => setArtQ(e.target.value)}
            />
            {(artRes.length > 0 || artLoading) && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] overflow-hidden">
                {artLoading
                  ? <div className="px-4 py-3 text-[12px] text-text-subtle">Buscando...</div>
                  : artRes.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => agregarArticulo(a)}
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-2 border-b border-border-sub last:border-0 flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="text-[13px] font-semibold text-text">{a.nombre}</span>
                        <span className="text-[11px] text-text-muted ml-2">{a.codigo} · {a.unidad_medida}</span>
                      </div>
                      <span className="text-[12px] text-text-muted font-mono">{fmt(a.costo_unitario)}</span>
                    </button>
                  ))
                }
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={agregarLibre}
            className="mt-1.5 text-[12px] text-accent hover:text-accent-hover font-medium"
          >
            + Ítem con descripción libre
          </button>
        </div>

        {/* Tabla de ítems */}
        {items.length > 0 && (
          <div className="border border-border rounded-[var(--r)] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th className="text-left px-3 py-2 text-text-muted font-semibold">Artículo / Descripción</th>
                  <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 90 }}>Cantidad</th>
                  <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 110 }}>Costo unit.</th>
                  <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 90 }}>Total</th>
                  <th style={{ width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item._key} className="border-b border-border-sub last:border-0">
                    <td className="px-3 py-2">
                      {item.articulo_id
                        ? <span className="text-text font-medium">{item.display_nombre}</span>
                        : <input
                            className="inp py-1 text-[12px] w-full"
                            placeholder="Descripción..."
                            value={item.descripcion_libre}
                            onChange={e => upd(item._key, { descripcion_libre: e.target.value, display_nombre: e.target.value })}
                          />
                      }
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number" min="0.01" step="0.01"
                        className="inp py-1 text-[12px] text-right w-20"
                        value={item.cantidad_pedida}
                        onChange={e => upd(item._key, { cantidad_pedida: parseFloat(e.target.value) || 0 })}
                        onKeyDown={handleNumericKeyDown}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number" min="0" step="0.01"
                        className="inp py-1 text-[12px] text-right w-24"
                        value={item.costo_unitario}
                        onChange={e => upd(item._key, { costo_unitario: parseFloat(e.target.value) || 0 })}
                        onKeyDown={handleNumericKeyDown}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">
                      {fmt(item.cantidad_pedida * item.costo_unitario)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setItems(prev => prev.filter(i => i._key !== item._key))}
                        className="text-text-subtle hover:text-danger p-0.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-2">
                  <td colSpan={3} className="px-3 py-2 text-right text-[12px] font-semibold text-text-muted">Total estimado:</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-text">{fmt(totalEst)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <ErrBox msg={error} />
      </div>
    </Modal>
  );
}

// ── Modal: Recibir pedido ─────────────────────────────────────────────────────

function ModalRecibir({
  open, pedido, onClose, onRecibido,
}: {
  open: boolean;
  pedido: PedidoDB | null;
  onClose: () => void;
  onRecibido: () => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [filas, setFilas]   = useState<{
    item_id: number; articulo_id: number | null; nombre: string;
    cant_pedida: number; cant_recibida: number; costo: number;
  }[]>([]);

  useEffect(() => {
    if (!open || !pedido?.items) return;
    setError('');
    setFilas(pedido.items.map(i => ({
      item_id:       i.id,
      articulo_id:   i.articulo_id,
      nombre:        i.articulo_nombre ?? i.descripcion_libre ?? '—',
      cant_pedida:   i.cantidad_pedida,
      cant_recibida: i.cantidad_pedida,
      costo:         i.costo_unitario,
    })));
  }, [open, pedido]);

  function upd(item_id: number, ch: Partial<typeof filas[0]>) {
    setFilas(prev => prev.map(f => f.item_id === item_id ? { ...f, ...ch } : f));
  }

  async function confirmar() {
    if (!pedido) return;
    if (filas.some(f => f.cant_recibida < 0)) { setError('Las cantidades recibidas no pueden ser negativas.'); return; }
    setSaving(true); setError('');
    try {
      await window.api.pedidosCompra.recibir(
        pedido.id,
        filas.map(f => ({
          item_id:           f.item_id,
          articulo_id:       f.articulo_id,
          cantidad_recibida: f.cant_recibida,
          costo_unitario:    f.costo,
        })),
      );
      showToast(`Pedido #${pedido.id} recibido. Stock actualizado.`, 'ok');
      onRecibido(); onClose();
    } catch (err: any) { setError(err.message ?? 'Error al recibir.'); }
    finally { setSaving(false); }
  }

  if (!pedido) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Recibir pedido #${pedido.id}`}
      maxWidth="620px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="success" loading={saving} onClick={confirmar}>Confirmar recepción</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-text-muted">
          Ajustá las cantidades y costos según lo que llegó. Al confirmar se actualiza el stock de cada artículo vinculado.
        </p>
        <div className="border border-border rounded-[var(--r)] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left px-3 py-2 text-text-muted font-semibold">Artículo</th>
                <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 70 }}>Pedido</th>
                <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 90 }}>Recibido</th>
                <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 110 }}>Costo unit.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.item_id} className="border-b border-border-sub last:border-0">
                  <td className="px-3 py-2 text-text font-medium">{f.nombre}</td>
                  <td className="px-3 py-2 text-right text-text-muted">{f.cant_pedida}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number" min="0" step="0.01"
                      className={`inp py-1 text-[12px] text-right w-20 ${f.cant_recibida < f.cant_pedida ? 'border-yellow-500/50' : ''}`}
                      value={f.cant_recibida}
                      onChange={e => upd(f.item_id, { cant_recibida: parseFloat(e.target.value) || 0 })}
                      onKeyDown={handleNumericKeyDown}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number" min="0" step="0.01"
                      className="inp py-1 text-[12px] text-right w-24"
                      value={f.costo}
                      onChange={e => upd(f.item_id, { costo: parseFloat(e.target.value) || 0 })}
                      onKeyDown={handleNumericKeyDown}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-2">
                <td colSpan={3} className="px-3 py-2 text-right text-[12px] font-semibold text-text-muted">Total recepción:</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-text">
                  {fmt(filas.reduce((s, f) => s + f.cant_recibida * f.costo, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <ErrBox msg={error} />
      </div>
    </Modal>
  );
}

// ── Modal: Detalle (solo lectura) ─────────────────────────────────────────────

function ModalDetalle({ open, pedido, onClose, onExportarPDF, onExportarCSV, exportando }: {
  open: boolean;
  pedido: PedidoDB | null;
  onClose: () => void;
  onExportarPDF: () => void;
  onExportarCSV: () => void;
  exportando: boolean;
}) {
  if (!pedido) return null;
  const { label, variant } = ESTADO_BADGE[pedido.estado] ?? { label: pedido.estado, variant: 'gray' as const };
  const total = pedido.items ? totalItems(pedido.items) : 0;
  const esRecibido = pedido.estado === 'recibido';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pedido #${pedido.id}`}
      maxWidth="620px"
      footer={
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={onExportarPDF}
            disabled={exportando}
            className="btn btn-ghost text-[12px] gap-1.5 disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            PDF
          </button>
          <button
            onClick={onExportarCSV}
            disabled={exportando}
            className="btn btn-ghost text-[12px] gap-1.5 disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            CSV
          </button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Info del pedido */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
          <div className="text-text-muted">Proveedor</div>
          <div className="font-semibold text-text">{pedido.proveedor_label || '—'}</div>
          <div className="text-text-muted">Estado</div>
          <div><Badge variant={variant as any}>{label}</Badge></div>
          <div className="text-text-muted">Creado</div>
          <div className="text-text">{fmtFecha(pedido.fecha_creacion)}</div>
          {pedido.fecha_envio && (
            <><div className="text-text-muted">Enviado</div><div className="text-text">{fmtFecha(pedido.fecha_envio)}</div></>
          )}
          {pedido.fecha_recepcion && (
            <><div className="text-text-muted">Recibido</div><div className="text-text">{fmtFecha(pedido.fecha_recepcion)}</div></>
          )}
          {pedido.notas && (
            <><div className="text-text-muted">Notas</div><div className="text-text">{pedido.notas}</div></>
          )}
        </div>

        {/* Ítems */}
        {pedido.items && pedido.items.length > 0 && (
          <div className="border border-border rounded-[var(--r)] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th className="text-left px-3 py-2 text-text-muted font-semibold">Artículo</th>
                  <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 70 }}>Pedido</th>
                  {esRecibido && (
                    <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 70 }}>Recibido</th>
                  )}
                  <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 90 }}>Costo</th>
                  <th className="text-right px-3 py-2 text-text-muted font-semibold" style={{ width: 90 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {pedido.items.map(i => {
                  const recibOK = esRecibido && (i.cantidad_recibida ?? 0) >= i.cantidad_pedida;
                  return (
                    <tr key={i.id} className="border-b border-border-sub last:border-0">
                      <td className="px-3 py-2 font-medium text-text">
                        {i.articulo_nombre ?? i.descripcion_libre ?? '—'}
                        {i.articulo_codigo && (
                          <span className="text-[10px] text-text-muted ml-1.5">{i.articulo_codigo}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-text-muted">{i.cantidad_pedida}</td>
                      {esRecibido && (
                        <td className={`px-3 py-2 text-right font-semibold ${recibOK ? 'text-[#4ade80]' : 'text-yellow-400'}`}>
                          {i.cantidad_recibida ?? 0}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-mono text-text-muted">{fmt(i.costo_unitario)}</td>
                      <td className="px-3 py-2 text-right font-mono text-text">{fmt(i.cantidad_pedida * i.costo_unitario)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-2">
                  <td colSpan={esRecibido ? 4 : 3} className="px-3 py-2 text-right text-[12px] font-semibold text-text-muted">Total:</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-text">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PedidosCompra() {
  const { showToast }  = useToast();
  const { session }    = useSession();
  const isAdmin        = session?.rol === 'admin';

  const [pedidos,      setPedidos]      = useState<PedidoDB[]>([]);
  const [proveedores,  setProveedores]  = useState<ProveedorMin[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [busqueda,     setBusqueda]     = useState('');
  const [filtro,       setFiltro]       = useState<EstadoPedido | 'todos'>('todos');
  const [exportando,   setExportando]   = useState<number | null>(null);

  // Modals
  const [modalNuevo,    setModalNuevo]    = useState(false);
  const [editando,      setEditando]      = useState<PedidoDB | null>(null);
  const [modalRecibir,  setModalRecibir]  = useState(false);
  const [recibiendo,    setRecibiendo]    = useState<PedidoDB | null>(null);
  const [modalDetalle,  setModalDetalle]  = useState(false);
  const [detalle,       setDetalle]       = useState<PedidoDB | null>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const [ps, pvs] = await Promise.all([
        window.api.pedidosCompra.listar(),
        window.api.proveedores.getAll(),
      ]);
      setPedidos(ps);
      setProveedores(pvs);
    } catch (err: any) {
      showToast('Error al cargar: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtrados = useMemo(() =>
    pedidos.filter(p => {
      const matchEstado = filtro === 'todos' || p.estado === filtro;
      const q = busqueda.toLowerCase();
      const matchBusq = !q || (p.proveedor_label ?? '').toLowerCase().includes(q) || String(p.id).includes(q);
      return matchEstado && matchBusq;
    }),
  [pedidos, filtro, busqueda]);

  // ── Acciones ─────────────────────────────────────────────────────────────

  async function abrirEditar(p: PedidoDB) {
    try {
      const full = await window.api.pedidosCompra.getById(p.id);
      setEditando(full); setModalNuevo(true);
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
  }

  async function abrirRecibir(p: PedidoDB) {
    try {
      const full = await window.api.pedidosCompra.getById(p.id);
      setRecibiendo(full); setModalRecibir(true);
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
  }

  async function abrirDetalle(p: PedidoDB) {
    try {
      const full = await window.api.pedidosCompra.getById(p.id);
      setDetalle(full); setModalDetalle(true);
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
  }

  async function enviar(p: PedidoDB) {
    try {
      await window.api.pedidosCompra.marcarEnviado(p.id);
      showToast(`Pedido #${p.id} marcado como enviado.`, 'ok');
      cargar();
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
  }

  async function cancelar(p: PedidoDB) {
    try {
      await window.api.pedidosCompra.cancelar(p.id);
      showToast(`Pedido #${p.id} cancelado.`, 'ok');
      cargar();
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
  }

  async function exportarPDF(p: PedidoDB) {
    setExportando(p.id);
    try {
      const res = await window.api.pedidosCompra.exportarPDF(p.id);
      if (res?.ok)         showToast('PDF guardado correctamente.', 'ok');
      else if (!res?.canceled) showToast('No se pudo exportar el PDF: ' + (res?.error ?? ''), 'error');
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
    finally { setExportando(null); }
  }

  async function exportarCSV(p: PedidoDB) {
    setExportando(p.id);
    try {
      const res = await window.api.pedidosCompra.exportarCSV(p.id);
      if (res?.ok)         showToast('CSV guardado correctamente.', 'ok');
      else if (!res?.canceled) showToast('No se pudo exportar el CSV: ' + (res?.error ?? ''), 'error');
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
    finally { setExportando(null); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">

      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Órdenes de compra</h1>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setEditando(null); setModalNuevo(true); }}
          >
            + Nueva orden
          </Button>
        )}
      </div>

      {/* Barra de filtros */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0 flex-wrap">
        <Input
          className="max-w-xs"
          placeholder="Buscar por proveedor o número..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <div className="flex items-center gap-1">
          {FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                filtro === f.value
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-text-muted self-center">
          {filtrados.length} orden{filtrados.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Tabla / estado vacío */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-subtle text-sm">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-subtle text-[13px] gap-2">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="opacity-25">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <line x1="9"  y1="14" x2="15" y2="14"/>
            </svg>
            {busqueda || filtro !== 'todos'
              ? 'Sin resultados para ese filtro.'
              : 'Todavía no hay órdenes de compra.'
            }
            {isAdmin && !busqueda && filtro === 'todos' && (
              <button
                className="text-accent hover:text-accent-hover text-[12px] font-medium mt-1"
                onClick={() => { setEditando(null); setModalNuevo(true); }}
              >
                Crear la primera orden →
              </button>
            )}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Proveedor</th>
                <th style={{ width: 110 }}>Estado</th>
                <th style={{ width: 60 }} className="text-center">Ítems</th>
                <th style={{ width: 100 }}>Creado</th>
                <th style={{ width: 100 }}>Enviado</th>
                <th style={{ width: 100 }}>Recibido</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const { label, variant } = ESTADO_BADGE[p.estado] ?? { label: p.estado, variant: 'gray' as const };
                return (
                  <tr
                    key={p.id}
                    className="group cursor-pointer"
                    onClick={() => abrirDetalle(p)}
                  >
                    <td className="font-mono text-[12px] text-text-muted">#{p.id}</td>
                    <td className="font-medium text-[13px]">
                      {p.proveedor_label || <span className="italic text-text-subtle">Sin proveedor</span>}
                    </td>
                    <td><Badge variant={variant as any}>{label}</Badge></td>
                    <td className="text-center text-[12px] text-text-muted">{p.total_items}</td>
                    <td className="text-[12px] text-text-muted">{fmtFecha(p.fecha_creacion)}</td>
                    <td className="text-[12px] text-text-muted">{fmtFecha(p.fecha_envio)}</td>
                    <td className="text-[12px] text-text-muted">{fmtFecha(p.fecha_recepcion)}</td>

                    {/* Acciones inline */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">

                        {/* Borrador: editar + enviar */}
                        {p.estado === 'borrador' && isAdmin && (
                          <>
                            <AccionBtn title="Editar" onClick={() => abrirEditar(p)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </AccionBtn>
                            <AccionBtn title="Marcar como enviado" onClick={() => enviar(p)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                              </svg>
                            </AccionBtn>
                          </>
                        )}

                        {/* Enviado: recibir */}
                        {p.estado === 'enviado' && isAdmin && (
                          <AccionBtn title="Registrar recepción" variant="success" onClick={() => abrirRecibir(p)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/>
                              <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </AccionBtn>
                        )}

                        {/* Borrador o enviado: cancelar */}
                        {(p.estado === 'borrador' || p.estado === 'enviado') && isAdmin && (
                          <AccionBtn title="Cancelar pedido" variant="danger" onClick={() => cancelar(p)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                          </AccionBtn>
                        )}

                        {/* Exportar PDF */}
                        <AccionBtn
                          title="Exportar PDF"
                          onClick={() => exportarPDF(p)}
                          disabled={exportando === p.id}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="9" y1="13" x2="15" y2="13"/>
                            <line x1="9" y1="17" x2="15" y2="17"/>
                          </svg>
                        </AccionBtn>

                        {/* Exportar CSV */}
                        <AccionBtn
                          title="Exportar CSV"
                          onClick={() => exportarCSV(p)}
                          disabled={exportando === p.id}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <line x1="3" y1="9" x2="21" y2="9"/>
                            <line x1="3" y1="15" x2="21" y2="15"/>
                            <line x1="9" y1="3" x2="9" y2="21"/>
                          </svg>
                        </AccionBtn>

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <ModalNuevoPedido
        open={modalNuevo}
        pedido={editando}
        proveedores={proveedores}
        usuarioId={session?.id ?? null}
        onClose={() => { setModalNuevo(false); setEditando(null); }}
        onGuardado={cargar}
      />

      <ModalRecibir
        open={modalRecibir}
        pedido={recibiendo}
        onClose={() => { setModalRecibir(false); setRecibiendo(null); }}
        onRecibido={cargar}
      />

      <ModalDetalle
        open={modalDetalle}
        pedido={detalle}
        onClose={() => { setModalDetalle(false); setDetalle(null); }}
        onExportarPDF={() => detalle && exportarPDF(detalle)}
        onExportarCSV={() => detalle && exportarCSV(detalle)}
        exportando={exportando === detalle?.id}
      />
    </div>
  );
}
