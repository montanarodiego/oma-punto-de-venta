import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody, Button, Field, Input, Modal } from '../components/ui';
import type { Turno, MovimientoCaja } from '../types/api';

const CAT_LABELS: Record<string,string> = {
  fondo_cambio:'Fondo de cambio', retiro_banco:'Retiro de banco', cobro_deuda:'Cobro de deuda',
  devol_proveedor:'Devol. proveedor', retiro_dueno:'Retiro del dueño', pago_proveedor:'Pago proveedor',
  gasto_operativo:'Gasto operativo', pago_servicio:'Pago servicio', deposito_banco:'Depósito banco',
  devol_cliente:'Devol. cliente', otro:'Otro',
};

function fmt(n: number) { return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2}).format(n??0); }
function fmtFecha(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ','T')+'Z');
  return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
}

export default function TurnoPage() {
  const { showToast } = useToast();
  const [turno, setTurno] = useState<Turno|null>(null);
  const [historial, setHistorial] = useState<Turno[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(true);

  // Abrir turno
  const [efectivoInicial, setEfectivoInicial] = useState('0');
  const [abriendo, setAbriendo] = useState(false);

  // Cerrar turno
  const [efectivoReal, setEfectivoReal] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [confirmCierreOpen, setConfirmCierreOpen] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState('');

  // Cancelar movimiento
  const [cancelMovId, setCancelMovId] = useState<number|null>(null);
  const [cancelMovMotivo, setCancelMovMotivo] = useState('');
  const [cancelMovError, setCancelMovError] = useState('');
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const [t, h] = await Promise.all([window.api.turnos.getActivo(), window.api.turnos.historial(30)]);
    setTurno(t);
    setHistorial(h);
    if (t) {
      const [r, m] = await Promise.all([window.api.turnos.calcularResumen(t.id), window.api.movimientos.listarPorTurno(t.id)]);
      setResumen(r); setMovimientos(m);
    }
    setLoading(false);
  }

  async function abrirTurno(e: React.FormEvent) {
    e.preventDefault();
    setAbriendo(true);
    try {
      const t = await window.api.turnos.abrir(parseFloat(efectivoInicial) || 0);
      setTurno(t);
      await cargar();
      showToast('Turno abierto.', 'ok');
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
    finally { setAbriendo(false); }
  }

  async function cerrarTurno() {
    const ef = parseFloat(efectivoReal);
    if (isNaN(ef) || ef < 0) { setErrorCierre('Ingresá el efectivo real en caja (puede ser $0).'); return; }
    setConfirmCierreOpen(true);
  }

  async function ejecutarCierre() {
    if (!turno) return;
    setCerrando(true); setConfirmCierreOpen(false);
    try {
      await window.api.turnos.cerrar(turno.id, parseFloat(efectivoReal) || 0, notasCierre);
      window.api.printer.imprimirCorteZ(turno.id).catch(() => {});
      setEfectivoReal(''); setNotasCierre(''); setTurno(null); setResumen(null); setMovimientos([]);
      await cargar();
      showToast('Turno cerrado correctamente.', 'ok');
    } catch (err: any) { setErrorCierre(err.message ?? 'Error al cerrar.'); }
    finally { setCerrando(false); }
  }

  const diferencia = (() => {
    const real = parseFloat(efectivoReal);
    if (isNaN(real) || !resumen) return null;
    return real - resumen.efectivo_esperado;
  })();

  async function cancelarMov() {
    if (!cancelMovId || !cancelMovMotivo.trim()) { setCancelMovError('El motivo es obligatorio.'); return; }
    setCancelando(true); setCancelMovError('');
    try {
      await window.api.movimientos.cancelar(cancelMovId, cancelMovMotivo);
      setCancelMovId(null); setCancelMovMotivo('');
      const [r, m] = await Promise.all([window.api.turnos.calcularResumen(turno!.id), window.api.movimientos.listarPorTurno(turno!.id)]);
      setResumen(r); setMovimientos(m);
      showToast('Movimiento cancelado.', 'ok');
    } catch (err: any) { setCancelMovError(err.message ?? 'Error al cancelar. Intentá de nuevo.'); }
    finally { setCancelando(false); }
  }

  const mediosPago = resumen ? [
    { label:'Efectivo', valor:resumen.ventas_efectivo },
    { label:'Débito', valor:resumen.ventas_debito },
    { label:'Crédito', valor:resumen.ventas_credito },
    { label:'Transferencia', valor:resumen.ventas_transferencia },
    { label:'Cuenta corriente', valor:resumen.ventas_cuenta_corriente },
    { label:'Propinas', valor:resumen.total_propinas??0, color:'#a78bfa' },
  ].filter(m => m.valor > 0) : [];

  return (
    <div className="page-content">
      <div className="page-header"><h1 className="page-title">Turno / Cierre de caja</h1></div>
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? <div className="flex items-center justify-center h-full text-text-subtle text-sm">Cargando...</div> : (
        <div className="max-w-[680px] mx-auto flex flex-col gap-5">

          {/* ── Sin turno ── */}
          {!turno && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
            <Card>
              <CardHeader>Sin turno activo</CardHeader>
              <CardBody>
                <p className="text-[13px] text-text-muted mb-4">No hay ningún turno abierto. Ingresá el efectivo inicial para comenzar.</p>
                <form onSubmit={abrirTurno} className="flex gap-3 items-end">
                  <Field label="Efectivo inicial en caja" className="flex-1">
                    <Input type="number" step="0.01" min="0" value={efectivoInicial} onChange={e => setEfectivoInicial(e.target.value)} placeholder="0,00" />
                  </Field>
                  <Button type="submit" variant="primary" loading={abriendo}>Abrir turno</Button>
                </form>
              </CardBody>
            </Card>
            </motion.div>
          )}

          {/* ── Turno activo ── */}
          {turno && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
            <Card>
              <CardHeader actions={<span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[rgba(34,197,94,.15)] text-[#4ade80]">ABIERTO</span>}>Turno en curso</CardHeader>
              <CardBody className="flex flex-col gap-5">
                {/* Info apertura */}
                <div className="grid grid-cols-3 gap-4">
                  {[['Apertura', fmtFecha(turno.fecha_apertura)], ['Efectivo inicial', fmt(turno.efectivo_inicial)], ['Transacciones', String(resumen?.total_transacciones ?? '—')]].map(([l,v]) => (
                    <div key={l}>
                      <div className="text-[11px] text-text-subtle uppercase tracking-wider mb-1">{l}</div>
                      <div className="text-[14px] font-medium">{v}</div>
                    </div>
                  ))}
                </div>

                {/* Ventas por medio */}
                {mediosPago.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <div className="text-[12px] font-bold uppercase tracking-wider text-text-subtle mb-3">Ventas del turno</div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {mediosPago.map(m => (
                        <div key={m.label} className="bg-surface-2 rounded-[var(--r-in)] px-4 py-3">
                          <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-1">{m.label}</div>
                          <div className="text-[20px] font-black font-mono tabular-nums" style={m.color?{color:m.color}:{}}>{fmt(m.valor)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totales */}
                {resumen && (
                  <div className="border-t border-border pt-4 flex flex-col gap-2.5">
                    <div className="flex justify-between items-baseline text-[14px] text-text-muted">
                      <span>Total vendido</span>
                      <span className="font-mono font-semibold text-[16px] text-text">{fmt(resumen.total_ventas)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-[14px] text-text-muted">
                      <span>Ventas en efectivo</span>
                      <span className="font-mono font-semibold text-[16px]">{fmt(resumen.ventas_efectivo)}</span>
                    </div>
                    {(resumen.total_propinas??0) > 0 && (
                      <div className="flex justify-between items-baseline text-[14px]">
                        <span className="text-text-muted">Propinas</span>
                        <span className="font-mono font-bold text-[16px] text-[#a78bfa]">{fmt(resumen.total_propinas)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline text-[16px] font-bold pt-2 border-t border-border">
                      <span>Efectivo esperado en caja</span>
                      <span className="font-mono text-[22px] font-black text-accent">{fmt(resumen.efectivo_esperado)}</span>
                    </div>
                  </div>
                )}

                {/* Actualizar */}
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={async () => { const [r,m] = await Promise.all([window.api.turnos.calcularResumen(turno.id), window.api.movimientos.listarPorTurno(turno.id)]); setResumen(r); setMovimientos(m); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
                    Actualizar
                  </Button>
                </div>

                {/* Cerrar turno */}
                <div className="border-t border-border pt-4">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-text-subtle mb-3">Cerrar turno</div>
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Efectivo real en caja">
                        <Input type="number" step="0.01" min="0" value={efectivoReal} onChange={e => setEfectivoReal(e.target.value)} placeholder="0,00" />
                      </Field>
                      <div className="flex flex-col justify-end">
                        <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-1">Diferencia</div>
                        <div className={`text-[24px] font-black font-mono tabular-nums ${diferencia === null ? 'text-text-subtle' : diferencia >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                          {diferencia === null ? '—' : (diferencia >= 0 ? '+' : '') + fmt(diferencia)}
                        </div>
                      </div>
                    </div>
                    <Field label="Notas (opcional)">
                      <textarea rows={2} value={notasCierre} onChange={e => setNotasCierre(e.target.value)} className="inp resize-y" placeholder="Observaciones del cierre..." />
                    </Field>
                    {errorCierre && <div className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] text-[#fca5a5] text-[13px] rounded-[var(--r-in)]">{errorCierre}</div>}
                    <Button
                      variant="danger"
                      loading={cerrando}
                      onClick={cerrarTurno}
                      style={{ border: '1px solid rgba(239,68,68,.3)', fontWeight:600 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Cerrar turno
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
            </motion.div>
          )}

          {/* ── Movimientos ── */}
          {turno && movimientos.length > 0 && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.05}}>
            <Card>
              <CardHeader actions={
                <span className="text-[12px] text-text-subtle">
                  Entradas: {fmt(movimientos.filter(m=>!m.cancelado&&m.tipo==='entrada').reduce((s,m)=>s+m.monto,0))} · Salidas: {fmt(movimientos.filter(m=>!m.cancelado&&m.tipo==='salida').reduce((s,m)=>s+m.monto,0))}
                </span>
              }>Movimientos del turno</CardHeader>
              <CardBody className="p-0">
                {movimientos.map(m => (
                  <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-none ${m.cancelado ? 'opacity-55' : ''}`}>
                    <span className={`text-[18px] font-bold w-5 text-center flex-shrink-0 ${m.cancelado ? 'text-text-subtle' : m.tipo==='entrada' ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>{m.tipo==='entrada'?'↓':'↑'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[13px] font-semibold font-mono ${m.cancelado?'line-through text-text-subtle':m.tipo==='entrada'?'text-[#4ade80]':'text-[#f87171]'}`}>{fmt(m.monto)}</span>
                        <span className="text-[11px] text-text-subtle">{m.tipo==='entrada'?'Entrada':'Salida'}</span>
                        {m.categoria && <span className="text-[10px] px-1.5 rounded-full bg-[rgba(99,102,241,.12)] text-[#a5b4fc]">{CAT_LABELS[m.categoria]??m.categoria}</span>}
                        {m.cancelado && <span className="text-[10px] px-1.5 rounded-full bg-[rgba(239,68,68,.12)] text-[#f87171] font-bold">CANCELADO</span>}
                      </div>
                      <div className={`text-[12px] text-text-muted mt-0.5 ${m.cancelado?'line-through':''}`}>{m.descripcion}</div>
                      {m.cancelado && m.cancelado_motivo && <div className="text-[11px] text-text-subtle">Motivo: {m.cancelado_motivo}</div>}
                      <div className="text-[11px] text-text-subtle">{fmtFecha(m.created_at)}</div>
                    </div>
                    {!m.cancelado && (
                      <button onClick={() => { setCancelMovId(m.id); setCancelMovMotivo(''); setCancelMovError(''); }} className="text-[11px] px-2 py-0.5 rounded border border-[rgba(239,68,68,.3)] bg-[rgba(239,68,68,.06)] text-[#f87171] hover:bg-[rgba(239,68,68,.15)] whitespace-nowrap">Cancelar</button>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>
            </motion.div>
          )}

          {/* ── Historial ── */}
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.1}}>
          <Card>
            <CardHeader>Historial de turnos</CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr>
                    <th>#</th><th>Apertura</th><th>Cierre</th>
                    <th className="text-right">Total ventas</th>
                    <th className="text-right">Ef. esperado</th>
                    <th className="text-right">Ef. real</th>
                    <th className="text-right">Diferencia</th>
                    <th className="text-center">Estado</th>
                  </tr></thead>
                  <tbody>
                    {historial.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-8 text-text-subtle text-[13px]">Sin turnos registrados.</td></tr>
                    ) : historial.map(t => {
                      const diff = t.diferencia ?? null;
                      return (
                        <tr key={t.id}>
                          <td className="font-mono text-[12px]">#{t.id}</td>
                          <td className="whitespace-nowrap text-[12px]">{fmtFecha(t.fecha_apertura)}</td>
                          <td className="whitespace-nowrap text-[12px]">{t.fecha_cierre ? fmtFecha(t.fecha_cierre) : '—'}</td>
                          <td className="text-right font-mono text-[12px]">{t.total_ventas!=null?fmt(t.total_ventas):'—'}</td>
                          <td className="text-right font-mono text-[12px]">{t.efectivo_esperado!=null?fmt(t.efectivo_esperado):'—'}</td>
                          <td className="text-right font-mono text-[12px]">{t.efectivo_real!=null?fmt(t.efectivo_real):'—'}</td>
                          <td className={`text-right font-mono text-[12px] ${diff!==null?diff>=0?'text-[#4ade80]':'text-[#f87171]':''}`}>{diff===null?'—':(diff>=0?'+':'')+fmt(diff)}</td>
                          <td className="text-center">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.estado==='abierto'?'bg-[rgba(34,197,94,.15)] text-[#4ade80]':'bg-[rgba(100,116,139,.12)] text-text-muted'}`}>
                              {t.estado.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
          </motion.div>

        </div>
        )}
      </main>

      {/* ── Modal confirmar cierre ── */}
      <Modal
        open={confirmCierreOpen}
        onClose={() => setConfirmCierreOpen(false)}
        title="Cerrar turno"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCierreOpen(false)}>Cancelar</Button>
            <Button variant="danger" loading={cerrando} onClick={ejecutarCierre} style={{ fontWeight:600 }}>Confirmar cierre</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-text-muted leading-relaxed">Esta acción <strong className="text-text">no se puede deshacer</strong>. El turno quedará cerrado y el resumen se guardará en el historial.</p>
          <div className="bg-surface-2 rounded-[var(--r-in)] p-3 flex flex-col gap-2">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="text-text-muted">Efectivo real ingresado</span>
              <span className="font-medium">{fmt(parseFloat(efectivoReal)||0)}</span>
            </div>
            {notasCierre && <div className="flex justify-between gap-3 text-[13px]">
              <span className="text-text-muted">Notas</span>
              <span className="font-medium">{notasCierre}</span>
            </div>}
          </div>
        </div>
      </Modal>

      {/* ── Modal cancelar movimiento ── */}
      <Modal
        open={cancelMovId !== null}
        onClose={() => setCancelMovId(null)}
        title="Cancelar movimiento"
        footer={
          <>
            <Button variant="ghost" disabled={cancelando} onClick={() => setCancelMovId(null)}>Cancelar</Button>
            <Button variant="danger" loading={cancelando} onClick={cancelarMov} style={{ fontWeight:600 }}>Confirmar cancelación</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Motivo de cancelación *">
            <Input autoFocus value={cancelMovMotivo} onChange={e => setCancelMovMotivo(e.target.value)} placeholder="Ej: error de carga, duplicado..." />
          </Field>
          {cancelMovError && <p className="text-[12px] text-danger">{cancelMovError}</p>}
        </div>
      </Modal>
    </div>
  );
}
