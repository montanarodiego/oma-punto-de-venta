import { useState, useEffect, useRef, useCallback } from 'react';
import { useTableKeyboard } from '../hooks/useTableKeyboard';
import { useToast } from '../context/ToastContext';
import { Button, Field, Input, Modal, VirtualTable } from '../components/ui';
import type { Proveedor } from '../types/api';

export default function Proveedores() {
  const { showToast } = useToast();

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [total,       setTotal]       = useState(0);
  const [busqueda,    setBusqueda]    = useState('');
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editId,      setEditId]      = useState<number | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', direccion: '', notas: '' });

  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const cargar = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await window.api.proveedores.searchPaged({ query: query.trim(), limit: 500 });
      setProveedores(res.rows ?? []);
      setTotal(res.total ?? 0);
    } catch (err: any) {
      showToast('Error al cargar proveedores: ' + (err.message ?? 'Error.'), 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { cargar(''); }, [cargar]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => cargar(busqueda), 200);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [busqueda, cargar]);

  const [tableActiveIdx, setTableActiveIdx] = useState(-1);
  useEffect(() => { setTableActiveIdx(-1); }, [busqueda]);
  useEffect(() => {
    document.querySelector('[data-tbl-sel="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [tableActiveIdx]);

  function abrirNuevo() {
    setEditId(null); setError('');
    setForm({ nombre: '', telefono: '', email: '', direccion: '', notas: '' });
    setModalOpen(true);
  }

  function abrirEditar(p: Proveedor) {
    setEditId(p.id); setError('');
    setForm({ nombre: p.nombre, telefono: p.telefono ?? '', email: p.email ?? '', direccion: p.direccion ?? '', notas: p.notas ?? '' });
    setModalOpen(true);
  }

  useTableKeyboard({
    items:        proveedores,
    activeIdx:    tableActiveIdx,
    setActiveIdx: setTableActiveIdx,
    onOpen:       abrirEditar,
    enabled:      !modalOpen,
  });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) await window.api.proveedores.update(editId, form);
      else        await window.api.proveedores.create(form);
      setModalOpen(false);
      cargar(busqueda);
      showToast(editId ? 'Proveedor actualizado.' : 'Proveedor creado.', 'ok');
    } catch (err: any) { setError(err.message ?? 'Error.'); }
    finally { setSaving(false); }
  }

  async function eliminar(id: number) {
    try {
      await window.api.proveedores.delete(id);
      cargar(busqueda);
      showToast('Proveedor eliminado.', 'ok');
    } catch (err: any) { showToast('No se pudo eliminar.', 'error'); }
  }

  const tableHeader = (
    <tr>
      <th>Nombre</th>
      <th>Teléfono</th>
      <th>Email</th>
      <th>Dirección</th>
      <th>Notas</th>
      <th style={{ width: 60 }}/>
    </tr>
  );

  return (
    <div className="page-content">
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Proveedores</h1>
        <Button variant="primary" size="sm" onClick={abrirNuevo}>+ Nuevo proveedor</Button>
      </div>

      <div className="flex gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <div className="relative max-w-xs w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="inp pl-8 pr-8"
            placeholder="Buscar proveedor..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        <span className="ml-auto text-[12px] text-text-muted self-center">
          {loading ? '…' : (
            total > proveedores.length
              ? `${proveedores.length} de ${total} proveedor${total !== 1 ? 'es' : ''}`
              : `${proveedores.length} proveedor${proveedores.length !== 1 ? 'es' : ''}`
          )}
        </span>
      </div>

      <VirtualTable
          items={loading ? [] : proveedores}
          estimateSize={42}
          colSpan={6}
          header={tableHeader}
          emptyState={
            loading ? (
              <div className="flex items-center justify-center h-32 text-text-subtle text-sm gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                Cargando…
              </div>
            ) : (
              <div className="text-center py-12 text-text-subtle text-[13px]">
                {busqueda ? (
                  <span>Sin resultados. <button onClick={() => setBusqueda('')} className="text-accent hover:underline underline-offset-2">Limpiar</button></span>
                ) : 'Sin proveedores. Creá el primero con "+ Nuevo proveedor".'}
              </div>
            )
          }
          renderRow={(p, idx) => (
            <tr
              key={p.id}
              data-tbl-sel={tableActiveIdx === idx ? 'true' : undefined}
              className={`group ${tableActiveIdx === idx ? 'bg-[rgba(79,142,245,.08)]' : ''}`}
            >
              <td className="font-medium text-[13px]">{p.nombre}</td>
              <td className="text-[12px] text-text-muted">{p.telefono || '—'}</td>
              <td className="text-[12px] text-text-muted">{p.email || '—'}</td>
              <td className="text-[12px] text-text-muted">{p.direccion || '—'}</td>
              <td className="text-[12px] text-text-muted truncate max-w-[200px]">{p.notas || '—'}</td>
              <td>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => abrirEditar(p)} className="p-1 text-text-subtle hover:text-accent">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => eliminar(p.id)} className="p-1 text-text-subtle hover:text-danger">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          )}
        />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar proveedor' : 'Nuevo proveedor'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={() => document.getElementById('form-prov')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))}>Guardar</Button>
          </>
        }
      >
        <form id="form-prov" onSubmit={guardar} className="flex flex-col gap-4">
          <Field label="Nombre *"><Input autoFocus value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono"><Input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}/></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}/></Field>
          </div>
          <Field label="Dirección"><Input value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))}/></Field>
          <Field label="Notas"><Input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}/></Field>
          {error && <div className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px] rounded-[var(--r-in)]">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
