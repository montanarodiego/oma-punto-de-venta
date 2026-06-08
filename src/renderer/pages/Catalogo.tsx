import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTableKeyboard } from '../hooks/useTableKeyboard';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { useSession } from '../context/SessionContext';
import { Button, Field, Input, Select, Modal, Badge, VirtualTable } from '../components/ui';
import type { Articulo, Departamento } from '../types/api';

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface KitComp {
  componente_id: number;
  nombre: string;
  codigo: string;
  unidad_medida: string;
  stock_actual: number;
  cantidad: number;
}

interface PromoRow {
  id: number;
  nombre: string;
  cantidad_desde: number;
  cantidad_hasta: number | null;
  precio_promocional: number;
  activa: number;
}

type ModalTab = 'datos' | 'componentes' | 'promociones';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n ?? 0);
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-[var(--r-in)] text-[12px] font-semibold transition-all ${
        active ? 'bg-accent text-white' : 'bg-surface-2 text-text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

// ── Fila de artículo memoizada ─────────────────────────────────────────────────

const ArticuloRow = React.memo(function ArticuloRow({
  a, idx, tableActiveIdx, depNombre, esAdmin, fmt, onVerHistorial, onEditar, onEliminar,
}: {
  a: Articulo;
  idx: number;
  tableActiveIdx: number;
  depNombre: string;
  esAdmin: boolean;
  fmt: (n: number) => string;
  onVerHistorial: (a: Articulo) => void;
  onEditar: (a: Articulo) => void;
  onEliminar: (id: number) => void;
}) {
  return (
    <tr
      data-tbl-sel={tableActiveIdx === idx ? 'true' : undefined}
      className={`group ${tableActiveIdx === idx ? 'bg-[rgba(79,142,245,.08)]' : ''}`}
    >
      <td className="font-mono text-[12px] text-text-muted">{a.codigo}</td>
      <td>
        <div className="flex items-center gap-2">
          <span className="font-medium text-[13px]">{a.nombre}</span>
          {!!a.es_kit && <Badge variant="purple">KIT</Badge>}
          {!!a.usa_inventario && a.stock_actual <= a.stock_minimo && a.stock_minimo > 0 && <Badge variant="red">Stock bajo</Badge>}
        </div>
      </td>
      <td className="text-[12px] text-text-muted">{depNombre}</td>
      <td className="text-right font-mono text-[13px]">{fmt(a.costo_unitario)}</td>
      <td className="text-right font-mono text-[13px] font-medium">{fmt(a.precio_unitario)}</td>
      <td className="text-right font-mono text-[13px] text-text-muted">{a.precio_mayoreo > 0 ? fmt(a.precio_mayoreo) : '—'}</td>
      <td className={`text-right font-mono text-[13px] ${a.usa_inventario && a.stock_actual <= 0 ? 'text-danger' : ''}`}>
        {a.usa_inventario ? a.stock_actual : '—'}
      </td>
      <td className="text-right text-[12px] text-text-muted">{a.usa_inventario ? a.stock_minimo : '—'}</td>
      <td className="text-right text-[12px] text-text-muted">{a.tasa_iva}%</td>
      <td>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onVerHistorial(a)} title="Historial de precios" className="p-1 text-text-subtle hover:text-accent rounded">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
          </button>
          {esAdmin && (
            <button onClick={() => onEditar(a)} title="Editar" className="p-1 text-text-subtle hover:text-accent rounded">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {esAdmin && (
            <button onClick={() => onEliminar(a.id)} title="Eliminar" className="p-1 text-text-subtle hover:text-danger rounded">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Catalogo() {
  const { showToast } = useToast();
  const { session }   = useSession();
  const esAdmin       = session?.rol === 'admin';

  const [articulos,     setArticulos]     = useState<Articulo[]>([]);
  const [total,         setTotal]         = useState(0);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [busqueda,      setBusqueda]      = useState('');
  const [filtroDep,     setFiltroDep]     = useState<number | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  // Mapa de departamentos para lookup O(1)
  const depMap = useMemo(
    () => new Map(departamentos.map(d => [d.id, d.nombre])),
    [departamentos],
  );

  // ── Modal artículo ─────────────────────────────────────────────────────────
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');
  const [modalTab,   setModalTab]   = useState<ModalTab>('datos');
  const [form, setForm] = useState<Partial<Articulo>>({
    codigo: '', nombre: '', precio_unitario: 0, precio_mayoreo: 0, costo_unitario: 0,
    stock_actual: 0, stock_minimo: 0, tasa_iva: 21, unidad_medida: 'unidad',
    departamento_id: null, usa_inventario: 1, es_kit: 0,
  });

  // ── Kit state ──────────────────────────────────────────────────────────────
  const [kitComps,   setKitComps]   = useState<KitComp[]>([]);
  const [kitSearch,  setKitSearch]  = useState('');
  const [kitResults, setKitResults] = useState<Articulo[]>([]);

  // ── Promo state ────────────────────────────────────────────────────────────
  const [promos,      setPromos]      = useState<PromoRow[]>([]);
  const [promoDesde,  setPromoDesde]  = useState('');
  const [promoHasta,  setPromoHasta]  = useState('');
  const [promoPrecio, setPromoPrecio] = useState('');
  const [promoNombre, setPromoNombre] = useState('');
  const [promoSaving, setPromoSaving] = useState(false);

  // ── Otros modals ───────────────────────────────────────────────────────────
  const [histOpen,   setHistOpen]   = useState(false);
  const [histData,   setHistData]   = useState<any[]>([]);
  const [histNombre, setHistNombre] = useState('');
  const [depOpen,    setDepOpen]    = useState(false);

  // ── Debounce para búsqueda backend ────────────────────────────────────────
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const cargar = useCallback(async (query: string, depId: number | null) => {
    setLoading(true); setError('');
    try {
      const [res, deps] = await Promise.all([
        window.api.articulos.searchPaged({ query: query.trim(), departamento_id: depId, limit: 500 }),
        window.api.departamentos.getAll(),
      ]);
      setArticulos(res.rows ?? []);
      setTotal(res.total ?? 0);
      setDepartamentos(deps ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Error al cargar el catálogo.');
    } finally { setLoading(false); }
  }, []);

  // Carga inicial
  useEffect(() => { cargar('', null); }, [cargar]);

  // Búsqueda con debounce: busqueda/filtroDep → backend
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => cargar(busqueda, filtroDep), 200);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [busqueda, filtroDep, cargar]);

  // ── Kit search (debounced) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!kitSearch.trim()) { setKitResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await window.api.articulos.search(kitSearch);
        setKitResults(r.filter(a => a.id !== editId && !kitComps.some(k => k.componente_id === a.id)));
      } catch { setKitResults([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [kitSearch, editId, kitComps]);

  // ── Modal handlers ─────────────────────────────────────────────────────────

  const resetModalState = () => {
    setFormError(''); setModalTab('datos');
    setKitComps([]); setKitSearch(''); setKitResults([]);
    setPromos([]); setPromoDesde(''); setPromoHasta(''); setPromoPrecio(''); setPromoNombre('');
  };

  const abrirNuevo = useCallback(() => {
    setEditId(null);
    setForm({ codigo: '', nombre: '', precio_unitario: 0, precio_mayoreo: 0, costo_unitario: 0, stock_actual: 0, stock_minimo: 0, tasa_iva: 21, unidad_medida: 'unidad', departamento_id: null, usa_inventario: 1, es_kit: 0 });
    resetModalState();
    setModalOpen(true);
  }, []);

  const abrirEditar = useCallback(async (a: Articulo) => {
    setEditId(a.id);
    setForm({ ...a });
    resetModalState();
    setModalOpen(true);
    try {
      const [comps, prms] = await Promise.all([
        a.es_kit ? window.api.kits.getComponentes(a.id) : Promise.resolve([]),
        window.api.promociones.listarPorArticulo(a.id),
      ]);
      setKitComps(comps ?? []);
      setPromos(prms ?? []);
    } catch {}
  }, []);

  const [tableActiveIdx, setTableActiveIdx] = useState(-1);
  useEffect(() => { setTableActiveIdx(-1); }, [busqueda, filtroDep]);
  useEffect(() => {
    document.querySelector('[data-tbl-sel="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [tableActiveIdx]);
  useTableKeyboard({
    items:        articulos,
    activeIdx:    tableActiveIdx,
    setActiveIdx: setTableActiveIdx,
    onOpen:       abrirEditar,
    enabled:      !modalOpen && !histOpen && !depOpen,
  });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.codigo?.trim() || !form.nombre?.trim()) { setFormError('Código y nombre son obligatorios.'); return; }
    setSaving(true); setFormError('');
    try {
      if (editId) {
        await window.api.articulos.update(editId, form);
        if (form.es_kit) {
          await window.api.kits.setComponentes(
            editId,
            kitComps.map(c => ({ componente_id: c.componente_id, cantidad: c.cantidad })),
          );
        }
      } else {
        await window.api.articulos.create(form);
      }
      setModalOpen(false);
      cargar(busqueda, filtroDep);
      showToast(editId ? 'Artículo actualizado.' : 'Artículo creado.', 'ok');
    } catch (err: any) { setFormError(err.message ?? 'Error al guardar.'); }
    finally { setSaving(false); }
  }

  async function eliminar(id: number) {
    try {
      await window.api.articulos.delete(id);
      cargar(busqueda, filtroDep);
      showToast('Artículo eliminado.', 'ok');
    } catch (err: any) { showToast(err.message ?? 'No se pudo eliminar.', 'error'); }
  }

  async function verHistorial(a: Articulo) {
    const h = await window.api.articulos.precioHistorial(a.id);
    setHistData(h ?? []); setHistNombre(a.nombre); setHistOpen(true);
  }

  const setField = useCallback((k: keyof Articulo, v: any) => setForm(p => ({ ...p, [k]: v })), []);
  const limpiarBusqueda = useCallback(() => { setBusqueda(''); setFiltroDep(null); }, []);
  const hayFiltro = busqueda.trim() !== '' || filtroDep !== null;

  // Callbacks estables para ArticuloRow
  const onVerHistorial = useCallback((a: Articulo) => verHistorial(a), []);
  const onEditar       = useCallback((a: Articulo) => abrirEditar(a), [abrirEditar]);
  const onEliminar     = useCallback((id: number) => eliminar(id), []);

  // ── Kit component handlers ─────────────────────────────────────────────────

  function agregarComponente(art: Articulo) {
    setKitComps(prev => [...prev, {
      componente_id: art.id,
      nombre:        art.nombre,
      codigo:        art.codigo,
      unidad_medida: art.unidad_medida,
      stock_actual:  art.stock_actual,
      cantidad:      1,
    }]);
    setKitSearch(''); setKitResults([]);
  }

  function quitarComponente(id: number) {
    setKitComps(prev => prev.filter(c => c.componente_id !== id));
  }

  function setCantComp(id: number, cant: number) {
    setKitComps(prev => prev.map(c => c.componente_id === id ? { ...c, cantidad: cant } : c));
  }

  // ── Promo handlers ─────────────────────────────────────────────────────────

  async function agregarPromo() {
    if (!editId || !promoDesde || !promoPrecio) return;
    const desde = parseInt(promoDesde);
    const precio = parseFloat(promoPrecio);
    if (isNaN(desde) || desde <= 0 || isNaN(precio) || precio <= 0) return;
    setPromoSaving(true);
    try {
      const nueva = await window.api.promociones.crear({
        articulo_id:        editId,
        nombre:             promoNombre || `Promo ≥${desde}u`,
        cantidad_desde:     desde,
        cantidad_hasta:     promoHasta ? parseInt(promoHasta) : null,
        precio_promocional: precio,
      });
      setPromos(p => [...p, nueva]);
      setPromoDesde(''); setPromoHasta(''); setPromoPrecio(''); setPromoNombre('');
    } catch (err: any) { showToast(err.message ?? 'Error al crear promo.', 'error'); }
    finally { setPromoSaving(false); }
  }

  async function eliminarPromo(id: number) {
    try {
      await window.api.promociones.eliminar(id);
      setPromos(p => p.filter(x => x.id !== id));
    } catch (err: any) { showToast(err.message ?? 'Error al eliminar.', 'error'); }
  }

  // ── Tabs disponibles ───────────────────────────────────────────────────────
  const showTabComponentes = !!form.es_kit && editId !== null;
  const showTabPromociones  = editId !== null;

  const activeTab: ModalTab =
    (modalTab === 'componentes' && !showTabComponentes) ? 'datos' :
    (modalTab === 'promociones' && !showTabPromociones)  ? 'datos' :
    modalTab;

  // ── Table header ───────────────────────────────────────────────────────────
  const tableHeader = (
    <tr>
      <th style={{ width: 100 }}>Código</th>
      <th>Nombre</th>
      <th>Departamento</th>
      <th className="text-right">Costo</th>
      <th className="text-right">Precio venta</th>
      <th className="text-right">Mayoreo</th>
      <th className="text-right">Stock</th>
      <th className="text-right">Mín.</th>
      <th className="text-right">IVA</th>
      <th style={{ width: 80 }}/>
    </tr>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">

      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Catálogo</h1>
        <div className="flex items-center gap-2">
          {esAdmin && <Button variant="ghost" size="sm" onClick={() => setDepOpen(true)}>Departamentos</Button>}
          {esAdmin && <Button variant="primary" size="sm" onClick={abrirNuevo}>+ Nuevo artículo</Button>}
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <div className="relative max-w-xs w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="inp pl-8 pr-8"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        <Select className="max-w-[180px]" value={filtroDep ?? ''} onChange={e => setFiltroDep(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Todos los departamentos</option>
          {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </Select>
        <span className="text-[12px] text-text-muted ml-auto flex-shrink-0">
          {loading ? '…' : (
            total > articulos.length
              ? `${articulos.length} de ${total} artículo${total !== 1 ? 's' : ''}`
              : `${articulos.length} artículo${articulos.length !== 1 ? 's' : ''}`
          )}
        </span>
      </div>

      {/* Tabla virtualizada */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-text-subtle text-sm gap-2">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          Cargando catálogo…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-32 gap-3">
          <p className="text-[13px] text-[#fca5a5]">{error}</p>
          <Button size="sm" onClick={() => cargar(busqueda, filtroDep)}>Reintentar</Button>
        </div>
      ) : (
        <VirtualTable
          items={articulos}
          estimateSize={40}
          colSpan={10}
          header={tableHeader}
          emptyState={
            <div className="text-center py-12 text-text-subtle text-[13px]">
              {hayFiltro ? (
                <span>
                  Sin resultados.{' '}
                  <button onClick={limpiarBusqueda} className="text-accent underline-offset-2 hover:underline">Limpiar filtros</button>
                </span>
              ) : 'Sin artículos. Creá el primero con "+ Nuevo artículo".'}
            </div>
          }
          renderRow={(a, idx) => (
            <ArticuloRow
              key={a.id}
              a={a}
              idx={idx}
              tableActiveIdx={tableActiveIdx}
              depNombre={depMap.get(a.departamento_id ?? -1) ?? '—'}
              esAdmin={esAdmin}
              fmt={fmt}
              onVerHistorial={onVerHistorial}
              onEditar={onEditar}
              onEliminar={onEliminar}
            />
          )}
        />
      )}

      {/* ── Modal artículo ───────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar artículo' : 'Nuevo artículo'}
        maxWidth="660px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={() => document.getElementById('form-art')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))}
            >
              Guardar
            </Button>
          </>
        }
      >
        {/* Tabs */}
        {(showTabComponentes || showTabPromociones) && (
          <div className="flex gap-1.5 mb-4">
            <TabBtn active={activeTab === 'datos'} onClick={() => setModalTab('datos')}>Datos</TabBtn>
            {showTabComponentes && (
              <TabBtn active={activeTab === 'componentes'} onClick={() => setModalTab('componentes')}>
                Componentes{kitComps.length > 0 ? ` (${kitComps.length})` : ''}
              </TabBtn>
            )}
            {showTabPromociones && (
              <TabBtn active={activeTab === 'promociones'} onClick={() => setModalTab('promociones')}>
                Promociones{promos.length > 0 ? ` (${promos.length})` : ''}
              </TabBtn>
            )}
          </div>
        )}

        <form id="form-art" onSubmit={guardar} className="flex flex-col gap-4">

          {/* ── Tab: Datos ──────────────────────────────────────────────────── */}
          {activeTab === 'datos' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Código *">
                  <Input value={form.codigo ?? ''} onChange={e => setField('codigo', e.target.value)} placeholder="Ej: 7790001"/>
                </Field>
                <Field label="Nombre *">
                  <Input value={form.nombre ?? ''} onChange={e => setField('nombre', e.target.value)} placeholder="Ej: Coca Cola 500ml"/>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Costo">
                  <Input type="number" step="0.01" min="0" value={form.costo_unitario ?? 0} onChange={e => setField('costo_unitario', parseFloat(e.target.value) || 0)} onKeyDown={handleNumericKeyDown}/>
                </Field>
                <Field label="Precio venta">
                  <Input type="number" step="0.01" min="0" value={form.precio_unitario ?? 0} onChange={e => setField('precio_unitario', parseFloat(e.target.value) || 0)} onKeyDown={handleNumericKeyDown}/>
                </Field>
                <Field label="Precio mayoreo">
                  <Input type="number" step="0.01" min="0" value={form.precio_mayoreo ?? 0} onChange={e => setField('precio_mayoreo', parseFloat(e.target.value) || 0)} onKeyDown={handleNumericKeyDown}/>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Stock actual">
                  <Input type="number" step="any" value={form.stock_actual ?? 0} onChange={e => setField('stock_actual', parseFloat(e.target.value) || 0)} onKeyDown={handleNumericKeyDown}/>
                </Field>
                <Field label="Stock mínimo">
                  <Input type="number" step="any" min="0" value={form.stock_minimo ?? 0} onChange={e => setField('stock_minimo', parseFloat(e.target.value) || 0)} onKeyDown={handleNumericKeyDown}/>
                </Field>
                <Field label="IVA (%)">
                  <Select value={form.tasa_iva ?? 21} onChange={e => setField('tasa_iva', parseFloat(e.target.value))}>
                    <option value={21}>21%</option>
                    <option value={10.5}>10,5%</option>
                    <option value={0}>0%</option>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unidad de medida">
                  <Select value={form.unidad_medida ?? 'unidad'} onChange={e => setField('unidad_medida', e.target.value)}>
                    {['unidad','kg','g','litro','ml','metro','cm'].map(u => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </Field>
                <Field label="Departamento">
                  <Select value={form.departamento_id ?? ''} onChange={e => setField('departamento_id', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— Sin departamento —</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-[13px]">
                  <input type="checkbox" checked={!!form.usa_inventario} onChange={e => setField('usa_inventario', e.target.checked ? 1 : 0)} className="accent-accent"/>
                  Controlar inventario
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[13px]">
                  <input
                    type="checkbox"
                    checked={!!form.es_kit}
                    onChange={e => {
                      setField('es_kit', e.target.checked ? 1 : 0);
                      if (e.target.checked && editId) setModalTab('componentes');
                    }}
                    className="accent-accent"
                  />
                  Es un kit
                </label>
              </div>
              {!editId && !!form.es_kit && (
                <p className="text-[11px] text-text-muted bg-surface-2 rounded-[var(--r-in)] px-3 py-2">
                  Guardá el artículo primero. Después lo editás para asignar los componentes del kit.
                </p>
              )}
            </>
          )}

          {/* ── Tab: Componentes del kit ─────────────────────────────────────── */}
          {activeTab === 'componentes' && showTabComponentes && (
            <div className="flex flex-col gap-3">
              <p className="text-[12px] text-text-muted">
                Definí qué artículos componen este kit y en qué cantidad.
              </p>
              <div className="relative">
                <Input
                  placeholder="Buscar artículo para agregar como componente..."
                  value={kitSearch}
                  onChange={e => setKitSearch(e.target.value)}
                />
                {kitResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] overflow-hidden">
                    {kitResults.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => agregarComponente(a)}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface-2 border-b border-border-sub last:border-0 flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="text-[13px] font-semibold text-text">{a.nombre}</span>
                          <span className="text-[11px] text-text-muted ml-2">{a.codigo} · {a.unidad_medida}</span>
                        </div>
                        <span className="text-[11px] text-text-muted">Stock: {a.stock_actual}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {kitComps.length > 0 ? (
                <div className="border border-border rounded-[var(--r)] overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-text-muted">Artículo</th>
                        <th className="text-right px-3 py-2 font-semibold text-text-muted" style={{ width: 60 }}>Stock</th>
                        <th className="text-right px-3 py-2 font-semibold text-text-muted" style={{ width: 100 }}>Cantidad</th>
                        <th style={{ width: 32 }}/>
                      </tr>
                    </thead>
                    <tbody>
                      {kitComps.map(c => (
                        <tr key={c.componente_id} className="border-b border-border-sub last:border-0">
                          <td className="px-3 py-2">
                            <span className="font-medium text-text">{c.nombre}</span>
                            <span className="text-[10px] text-text-muted ml-1.5">{c.codigo} · {c.unidad_medida}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-text-muted">{c.stock_actual}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number" min="0.001" step="0.001"
                              className="inp py-1 text-[12px] text-right w-20"
                              value={c.cantidad}
                              onChange={e => setCantComp(c.componente_id, parseFloat(e.target.value) || 1)}
                              onKeyDown={handleNumericKeyDown}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <button type="button" onClick={() => quitarComponente(c.componente_id)} className="text-text-subtle hover:text-danger p-0.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-[12px] text-text-subtle border border-dashed border-border rounded-[var(--r)]">
                  Buscá artículos arriba para agregar componentes al kit.
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                Los cambios se guardan al hacer clic en <strong>Guardar</strong>.
              </p>
            </div>
          )}

          {/* ── Tab: Promociones ─────────────────────────────────────────────── */}
          {activeTab === 'promociones' && showTabPromociones && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-text-muted">
                  Precio especial por volumen. Precio regular: <strong className="text-text">{fmt(form.precio_unitario ?? 0)}</strong>
                </p>
              </div>
              <div className="bg-surface-2 border border-border rounded-[var(--r)] p-3 flex flex-col gap-3">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Nueva promoción</div>
                <div className="grid grid-cols-4 gap-2">
                  <Field label="Cant. desde">
                    <Input type="number" min="1" step="1" placeholder="Ej: 6" value={promoDesde} onChange={e => setPromoDesde(e.target.value)} onKeyDown={handleNumericKeyDown}/>
                  </Field>
                  <Field label="Cant. hasta (opcional)">
                    <Input type="number" min="1" step="1" placeholder="Vacío = sin límite" value={promoHasta} onChange={e => setPromoHasta(e.target.value)} onKeyDown={handleNumericKeyDown}/>
                  </Field>
                  <Field label="Precio promo *">
                    <Input type="number" min="0.01" step="0.01" placeholder="Ej: 750" value={promoPrecio} onChange={e => setPromoPrecio(e.target.value)} onKeyDown={handleNumericKeyDown}/>
                  </Field>
                  <Field label="Etiqueta (opcional)">
                    <Input placeholder="Ej: 6x1" value={promoNombre} onChange={e => setPromoNombre(e.target.value)}/>
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="primary" size="sm" loading={promoSaving} onClick={agregarPromo} disabled={!promoDesde || !promoPrecio}>
                    Agregar promoción
                  </Button>
                </div>
              </div>
              {promos.length > 0 ? (
                <div className="border border-border rounded-[var(--r)] overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-text-muted">Etiqueta</th>
                        <th className="text-center px-3 py-2 font-semibold text-text-muted" style={{ width: 120 }}>Cantidad</th>
                        <th className="text-right px-3 py-2 font-semibold text-text-muted" style={{ width: 100 }}>Precio promo</th>
                        <th className="text-right px-3 py-2 font-semibold text-text-muted" style={{ width: 80 }}>Descuento</th>
                        <th style={{ width: 32 }}/>
                      </tr>
                    </thead>
                    <tbody>
                      {promos.map(p => {
                        const desc = form.precio_unitario
                          ? ((form.precio_unitario - p.precio_promocional) / form.precio_unitario * 100)
                          : 0;
                        const rango = p.cantidad_hasta
                          ? `${p.cantidad_desde} – ${p.cantidad_hasta}`
                          : `≥ ${p.cantidad_desde}`;
                        return (
                          <tr key={p.id} className="border-b border-border-sub last:border-0">
                            <td className="px-3 py-2 font-medium text-text">{p.nombre || '—'}</td>
                            <td className="px-3 py-2 text-center text-text-muted">{rango}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-[#4ade80]">{fmt(p.precio_promocional)}</td>
                            <td className="px-3 py-2 text-right text-text-muted">{desc > 0 ? `-${desc.toFixed(1)}%` : '—'}</td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => eliminarPromo(p.id)} className="text-text-subtle hover:text-danger p-0.5">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-[12px] text-text-subtle border border-dashed border-border rounded-[var(--r)]">
                  Sin promociones. Usá el formulario de arriba para crear la primera.
                </div>
              )}
            </div>
          )}

          <AnimatePresence>
            {formError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px] rounded-[var(--r-in)]"
              >
                {formError}
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </Modal>

      {/* Modal historial de precios */}
      <Modal open={histOpen} onClose={() => setHistOpen(false)} title={`Historial de precios — ${histNombre}`} maxWidth="480px">
        {histData.length === 0 ? (
          <p className="text-text-muted text-[13px]">Sin historial de cambios de precio.</p>
        ) : (
          <table className="tbl text-[12px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="text-right">Anterior</th>
                <th className="text-right">Nuevo</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {histData.map((h, i) => (
                <tr key={i}>
                  <td>{new Date(h.created_at).toLocaleString('es-AR')}</td>
                  <td className="text-right font-mono">{fmt(h.precio_anterior)}</td>
                  <td className="text-right font-mono font-semibold">{fmt(h.precio_nuevo)}</td>
                  <td>{h.usuario ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      {/* Modal departamentos */}
      {depOpen && (
        <DepartamentosModal departamentos={departamentos} onClose={() => { setDepOpen(false); cargar(busqueda, filtroDep); }}/>
      )}
    </div>
  );
}

// ── DepartamentosModal ────────────────────────────────────────────────────────

function DepartamentosModal({ departamentos, onClose }: { departamentos: Departamento[]; onClose: () => void }) {
  const { showToast } = useToast();
  const [nombre, setNombre] = useState('');
  const [color, setColor]   = useState('#4f8ef5');
  const [lista, setLista]   = useState(departamentos);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    try {
      const d = await window.api.departamentos.create({ nombre: nombre.trim(), color });
      setLista(p => [...p, d]); setNombre('');
      showToast('Departamento creado.', 'ok');
    } catch (err: any) { showToast(err.message ?? 'Error al crear.', 'error'); }
  }

  async function eliminar(id: number) {
    const dep = lista.find(d => d.id === id);
    if (!window.confirm(`¿Eliminar el departamento "${dep?.nombre}"?\nLos artículos asignados quedarán sin departamento.`)) return;
    try {
      await window.api.departamentos.delete(id);
      setLista(p => p.filter(d => d.id !== id));
      showToast('Departamento eliminado.', 'ok');
    } catch (err: any) { showToast(err.message ?? 'No se pudo eliminar.', 'error'); }
  }

  return (
    <Modal open onClose={onClose} title="Departamentos" footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}>
      <form onSubmit={crear} className="flex gap-2 mb-4">
        <Input className="flex-1" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del departamento"/>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-9 rounded border border-border cursor-pointer"/>
        <Button type="submit" variant="primary" size="sm">Agregar</Button>
      </form>
      <div className="flex flex-col gap-1.5">
        <AnimatePresence>
          {lista.map(d => (
            <motion.div key={d.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
              className="flex items-center gap-2 p-2 bg-surface-2 rounded-[var(--r-in)]"
            >
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: d.color }}/>
              <span className="flex-1 text-[13px]">{d.nombre}</span>
              <button onClick={() => eliminar(d.id)} className="text-text-subtle hover:text-danger transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
