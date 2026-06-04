import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody, Button, Field, Input, Modal, Badge } from '../components/ui';
import type { Cliente } from '../types/api';

function fmt(n: number) { return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2}).format(n??0); }

export default function Clientes() {
  const { showToast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente|null>(null);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // Modal cliente
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nombre:'', telefono:'', direccion:'', limite_credito:0 });

  // Modal pago
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoForma, setPagoForma] = useState('efectivo');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    setClientes(await window.api.clientes.getAll());
    setLoading(false);
  }

  async function verDetalle(c: Cliente) {
    setClienteDetalle(c); setDetalleLoading(true);
    const [t, p] = await Promise.all([window.api.clientes.getTransacciones(c.id), window.api.clientes.listarPagos(c.id)]);
    setTransacciones(t); setPagos(p); setDetalleLoading(false);
  }

  const filtrados = clientes.filter(c => !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || c.telefono?.includes(busqueda));

  function abrirNuevo() {
    setEditId(null); setError('');
    setForm({ nombre:'', telefono:'', direccion:'', limite_credito:0 });
    setModalOpen(true);
  }

  function abrirEditar(c: Cliente) {
    setEditId(c.id); setError('');
    setForm({ nombre:c.nombre, telefono:c.telefono??'', direccion:c.direccion??'', limite_credito:c.limite_credito??0 });
    setModalOpen(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) await window.api.clientes.update(editId, form);
      else await window.api.clientes.create(form);
      setModalOpen(false); cargar();
      showToast(editId ? 'Cliente actualizado.' : 'Cliente creado.', 'ok');
    } catch (err: any) { setError(err.message ?? 'Error.'); }
    finally { setSaving(false); }
  }

  async function eliminar(id: number) {
    await window.api.clientes.delete(id);
    cargar(); showToast('Cliente eliminado.', 'ok');
  }

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteDetalle) return;
    const monto = parseFloat(pagoMonto);
    if (isNaN(monto) || monto <= 0) return;
    await window.api.clientes.registrarPago(clienteDetalle.id, monto, pagoForma);
    setPagoOpen(false); setPagoMonto('');
    const updated = await window.api.clientes.getById(clienteDetalle.id);
    setClienteDetalle(updated);
    await verDetalle(updated);
    cargar();
    showToast('Pago registrado.', 'ok');
  }

  async function imprimirEstado() {
    if (!clienteDetalle) return;
    await window.api.printer.imprimirEstadoCuenta(clienteDetalle.id);
  }

  return (
    <div className="page-content">
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Clientes</h1>
        <Button variant="primary" size="sm" onClick={abrirNuevo}>+ Nuevo cliente</Button>
      </div>

      <div className="flex gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <Input className="max-w-xs" placeholder="Buscar por nombre o teléfono..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <span className="ml-auto text-[12px] text-text-muted self-center">{filtrados.length} cliente{filtrados.length!==1?'s':''}</span>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Lista */}
        <div className="flex-1 overflow-y-auto border-r border-border">
          {loading ? <div className="flex items-center justify-center h-full text-text-subtle text-sm">Cargando...</div> : (
            <table className="tbl">
              <thead><tr><th>Nombre</th><th>Teléfono</th><th>Dirección</th><th className="text-right">Límite CC</th><th className="text-right">Deuda</th><th/></tr></thead>
              <tbody>
                {filtrados.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-text-subtle text-[13px]">Sin clientes.</td></tr> :
                filtrados.map(c => (
                  <tr key={c.id} onClick={() => verDetalle(c)} className={`cursor-pointer ${clienteDetalle?.id===c.id?'bg-[rgba(79,142,245,.1)]':''}`}>
                    <td className="font-medium text-[13px]">{c.nombre}</td>
                    <td className="text-[12px] text-text-muted">{c.telefono||'—'}</td>
                    <td className="text-[12px] text-text-muted">{c.direccion||'—'}</td>
                    <td className="text-right font-mono text-[13px]">{c.limite_credito>0?fmt(c.limite_credito):'—'}</td>
                    <td className={`text-right font-mono text-[13px] ${c.saldo_vencido>0?'text-danger font-semibold':''}`}>{c.saldo_vencido>0?fmt(c.saldo_vencido):'—'}</td>
                    <td onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={()=>abrirEditar(c)} className="p-1 text-text-subtle hover:text-accent"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={()=>eliminar(c.id)} className="p-1 text-text-subtle hover:text-danger"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detalle */}
        {clienteDetalle && (
          <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden bg-surface">
            <div className="p-4 border-b border-border flex items-start justify-between">
              <div>
                <div className="font-bold text-[17px] leading-tight">{clienteDetalle.nombre}</div>
                <div className="text-[13px] text-text-muted mt-0.5">{clienteDetalle.telefono||'Sin teléfono'}</div>
              </div>
              <button onClick={() => setClienteDetalle(null)} className="text-text-subtle hover:text-text text-[20px] leading-none">×</button>
            </div>
            <div className="p-4 border-b border-border flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Deuda actual</div>
                <div className={`text-[26px] font-black font-mono tabular-nums leading-none ${clienteDetalle.saldo_vencido>0?'text-danger':'text-[#4ade80]'}`}>
                  {fmt(clienteDetalle.saldo_vencido)}
                </div>
              </div>
              {clienteDetalle.limite_credito>0 && (
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-text-muted">Límite de crédito</span>
                  <span className="font-mono font-semibold">{fmt(clienteDetalle.limite_credito)}</span>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                {clienteDetalle.saldo_vencido>0 && <Button variant="primary" size="sm" className="flex-1" onClick={()=>setPagoOpen(true)}>Registrar pago</Button>}
                <Button variant="ghost" size="sm" onClick={imprimirEstado} title="Imprimir estado de cuenta">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detalleLoading ? <div className="text-text-subtle text-[12px] text-center py-4">Cargando...</div> : (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle mb-2">Últimas transacciones</div>
                  {transacciones.slice(0,10).map(t => (
                    <div key={t.id} className="flex justify-between items-center py-1.5 border-b border-border-sub last:border-none text-[12px]">
                      <div>
                        <div className="text-text">{new Date(t.created_at).toLocaleDateString('es-AR')}</div>
                        <div className="text-text-subtle">{t.forma_pago}</div>
                      </div>
                      <span className={`font-mono font-semibold ${t.estado==='cancelada'?'text-danger line-through':''}`}>{fmt(t.monto_total)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal cliente */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar cliente' : 'Nuevo cliente'}
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button variant="primary" loading={saving} onClick={() => document.getElementById('form-cli')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}>Guardar</Button></>}
      >
        <form id="form-cli" onSubmit={guardar} className="flex flex-col gap-4">
          <Field label="Nombre *"><Input autoFocus value={form.nombre} onChange={e => setForm(p=>({...p,nombre:e.target.value}))} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono"><Input value={form.telefono} onChange={e => setForm(p=>({...p,telefono:e.target.value}))} placeholder="011-..." /></Field>
            <Field label="Límite de crédito ($)"><Input type="number" step="0.01" min="0" value={form.limite_credito} onChange={e => setForm(p=>({...p,limite_credito:parseFloat(e.target.value)||0}))} /></Field>
          </div>
          <Field label="Dirección"><Input value={form.direccion} onChange={e => setForm(p=>({...p,direccion:e.target.value}))} /></Field>
          {error && <div className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px] rounded-[var(--r-in)]">{error}</div>}
        </form>
      </Modal>

      {/* Modal pago */}
      <Modal open={pagoOpen} onClose={() => setPagoOpen(false)} title="Registrar pago"
        footer={<><Button variant="ghost" onClick={() => setPagoOpen(false)}>Cancelar</Button><Button variant="primary" onClick={() => document.getElementById('form-pago')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}>Registrar</Button></>}
      >
        <form id="form-pago" onSubmit={registrarPago} className="flex flex-col gap-4">
          <div className="px-3 py-2 bg-surface-2 rounded-[var(--r-in)] text-[13px]">
            Deuda de <strong>{clienteDetalle?.nombre}</strong>: <span className="text-danger font-mono">{fmt(clienteDetalle?.saldo_vencido??0)}</span>
          </div>
          <Field label="Monto del pago"><Input autoFocus type="number" step="0.01" min="0.01" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} placeholder="0,00" required /></Field>
          <Field label="Forma de pago">
            <select className="inp" value={pagoForma} onChange={e => setPagoForma(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta_debito">Débito</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
