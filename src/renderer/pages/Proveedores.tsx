import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { Button, Field, Input, Modal, Badge } from '../components/ui';
import type { Proveedor } from '../types/api';

export default function Proveedores() {
  const { showToast } = useToast();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nombre:'', telefono:'', email:'', direccion:'', notas:'' });

  useEffect(() => { cargar(); }, []);
  async function cargar() { setLoading(true); setProveedores(await window.api.proveedores.getAll()); setLoading(false); }

  const filtrados = proveedores.filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  function abrirNuevo() { setEditId(null); setError(''); setForm({nombre:'',telefono:'',email:'',direccion:'',notas:''}); setModalOpen(true); }
  function abrirEditar(p: Proveedor) { setEditId(p.id); setError(''); setForm({nombre:p.nombre,telefono:p.telefono??'',email:p.email??'',direccion:p.direccion??'',notas:p.notas??''}); setModalOpen(true); }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) await window.api.proveedores.update(editId, form);
      else await window.api.proveedores.create(form);
      setModalOpen(false); cargar(); showToast(editId?'Proveedor actualizado.':'Proveedor creado.','ok');
    } catch (err: any) { setError(err.message??'Error.'); }
    finally { setSaving(false); }
  }

  async function eliminar(id: number) {
    await window.api.proveedores.delete(id);
    cargar(); showToast('Proveedor eliminado.','ok');
  }

  return (
    <div className="page-content">
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Proveedores</h1>
        <Button variant="primary" size="sm" onClick={abrirNuevo}>+ Nuevo proveedor</Button>
      </div>
      <div className="flex gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <Input className="max-w-xs" placeholder="Buscar proveedor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <span className="ml-auto text-[12px] text-text-muted self-center">{filtrados.length} proveedor{filtrados.length!==1?'es':''}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? <div className="flex items-center justify-center h-full text-text-subtle text-sm">Cargando...</div> : (
          <table className="tbl">
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th>Notas</th><th style={{width:60}}/></tr></thead>
            <tbody>
              {filtrados.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-text-subtle text-[13px]">Sin proveedores.</td></tr> :
              filtrados.map(p => (
                <tr key={p.id} className="group">
                  <td className="font-medium text-[13px]">{p.nombre}</td>
                  <td className="text-[12px] text-text-muted">{p.telefono||'—'}</td>
                  <td className="text-[12px] text-text-muted">{p.email||'—'}</td>
                  <td className="text-[12px] text-text-muted">{p.direccion||'—'}</td>
                  <td className="text-[12px] text-text-muted truncate max-w-[200px]">{p.notas||'—'}</td>
                  <td>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={()=>abrirEditar(p)} className="p-1 text-text-subtle hover:text-accent"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                      <button onClick={()=>eliminar(p.id)} className="p-1 text-text-subtle hover:text-danger"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar proveedor' : 'Nuevo proveedor'}
        footer={<><Button variant="ghost" onClick={()=>setModalOpen(false)}>Cancelar</Button><Button variant="primary" loading={saving} onClick={()=>document.getElementById('form-prov')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}>Guardar</Button></>}
      >
        <form id="form-prov" onSubmit={guardar} className="flex flex-col gap-4">
          <Field label="Nombre *"><Input autoFocus value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono"><Input value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} /></Field>
          </div>
          <Field label="Dirección"><Input value={form.direccion} onChange={e=>setForm(p=>({...p,direccion:e.target.value}))} /></Field>
          <Field label="Notas"><Input value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} /></Field>
          {error && <div className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[12px] rounded-[var(--r-in)]">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
