import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useSession } from '../../context/SessionContext';
import { fmt } from './types';

interface ModalAnularProps {
  open: boolean;
  onClose: () => void;
  turnoActivo: any;
  showToast: (msg: string, type?: 'ok' | 'error' | 'warning') => void;
}

export function ModalAnular({ open, onClose, turnoActivo, showToast }: ModalAnularProps) {
  const { session } = useSession();
  const esAdmin = session?.rol === 'admin';

  const [transList,  setTransList]  = useState<any[]>([]);
  const [selTrans,   setSelTrans]   = useState<any | null>(null);
  const [tipo,       setTipo]       = useState<'total' | 'parcial'>('parcial');
  const [motivo,     setMotivo]     = useState('');
  const [itemQtys,   setItemQtys]   = useState<Record<number, number>>({});
  const [maxQtys,    setMaxQtys]    = useState<Record<number, number>>({});
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open, onClose);

  // Inicializa al abrir
  useEffect(() => {
    if (!open) return;
    setSelTrans(null);
    setMotivo('');
    setError('');
    setTipo(esAdmin ? 'total' : 'parcial');
    setItemQtys({});
    setMaxQtys({});
    setTransList([]);
    window.api.devoluciones.recientes(60)
      .then((lista: any[]) => setTransList(lista.filter((t: any) => t.estado !== 'cancelada')))
      .catch(() => setError('No se pudieron cargar las transacciones recientes.'));
  }, [open]);

  async function seleccionarTrans(transId: number) {
    try {
      const t = await window.api.transacciones.getById(transId);
      if (!t) { setError('Transacción no encontrada.'); return; }
      setSelTrans(t);

      const qtys: Record<number, number> = {};
      for (const item of t.detalle) qtys[item.id] = item.cantidad;

      // Si ya tuvo devoluciones parciales, descontar lo ya devuelto
      if (t.estado === 'devolucion_parcial') {
        const dvs = await window.api.devoluciones.getByTrans(t.id);
        for (const dv of dvs) {
          for (const det of dv.detalle) {
            if (det.detalle_id != null && qtys[det.detalle_id] != null) {
              qtys[det.detalle_id] = Math.max(0, qtys[det.detalle_id] - det.cantidad);
            }
          }
        }
      }

      setItemQtys(qtys);
      setMaxQtys({ ...qtys });
      setTipo(esAdmin ? 'total' : 'parcial');
      setError('');
    } catch {
      setError('Error al cargar el detalle de la transacción.');
    }
  }

  async function confirmar() {
    if (!selTrans) return;
    if (!motivo.trim()) { setError('Ingresá un motivo.'); return; }
    setLoading(true);
    setError('');
    try {
      if (tipo === 'total') {
        await window.api.devoluciones.cancelar({
          transaccionId: selTrans.id,
          turnoId:       turnoActivo?.id ?? null,
          motivo:        motivo.trim(),
        });
        showToast(`Transacción #${selTrans.id} anulada. Stock repuesto.`, 'ok');
      } else {
        const items = selTrans.detalle
          .filter((i: any) => (itemQtys[i.id] ?? 0) > 0)
          .map((i: any) => ({
            detalle_id:      i.id,
            articulo_id:     i.articulo_id ?? null,
            descripcion:     i.nombre || '',
            cantidad:        itemQtys[i.id],
            precio_unitario: i.precio_al_momento,
          }));
        if (items.length === 0) {
          setError('Seleccioná al menos un ítem con cantidad mayor a 0.');
          setLoading(false);
          return;
        }
        await window.api.devoluciones.parcial({
          transaccionId: selTrans.id,
          turnoId:       turnoActivo?.id ?? null,
          motivo:        motivo.trim(),
          items,
        });
        showToast(`Devolución parcial de #${selTrans.id} registrada.`, 'ok');
      }
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al procesar la operación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] bg-black/82 backdrop-blur-md flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            ref={modalRef}
            data-modal
            className="bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-[860px] max-w-[98vw] max-h-[90vh] flex overflow-hidden"
            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
          >
            {/* Columna izq: lista transacciones */}
            <div className="w-[280px] flex-shrink-0 border-r border-border flex flex-col">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[14px] font-bold text-text">Anular / Devolver</h3>
                <div className="text-[11px] text-text-muted mt-0.5">Ventas del día · solo vigentes</div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {transList.length === 0 && !error && (
                  <div className="py-10 text-center text-text-subtle text-[12px]">Sin ventas disponibles</div>
                )}
                {transList.map(t => (
                  <div
                    key={t.id}
                    onClick={() => seleccionarTrans(t.id)}
                    className={`px-4 py-3 cursor-pointer border-b border-border-sub transition-colors ${
                      selTrans?.id === t.id
                        ? 'bg-[rgba(79,142,245,.12)] border-l-[3px] border-l-accent'
                        : 'hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[13px] font-bold text-text">#{t.id}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        t.estado === 'devolucion_parcial'
                          ? 'bg-[rgba(234,179,8,.2)] text-[#fbbf24]'
                          : 'bg-[rgba(34,197,94,.12)] text-[#4ade80]'
                      }`}>{t.estado === 'devolucion_parcial' ? 'DEV PARCIAL' : 'VIGENTE'}</span>
                    </div>
                    <div className="text-[12px] text-text-muted">{fmt(t.monto_total)} · {t.forma_pago.replace(/_/g, ' ')}</div>
                    {t.nombre_cliente && <div className="text-[11px] text-text-subtle mt-0.5 truncate">{t.nombre_cliente}</div>}
                    <div className="text-[11px] text-text-subtle">
                      {new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna der: detalle + acciones */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {!selTrans ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-subtle">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.57"/>
                  </svg>
                  <span className="text-[13px]">Seleccioná una venta de la izquierda</span>
                  {error && <div className="text-[12px] text-danger mt-2">{error}</div>}
                  <button className="btn btn-ghost mt-2" onClick={onClose}>Cerrar</button>
                </div>
              ) : (
                <>
                  {/* Header transacción */}
                  <div className="px-5 py-3 border-b border-border flex items-center gap-4 flex-shrink-0">
                    <div>
                      <div className="text-[13px] font-bold text-text">Transacción #{selTrans.id}</div>
                      <div className="text-[12px] text-text-muted">{fmt(selTrans.monto_total)} · {selTrans.forma_pago.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="flex-1" />
                    <div className="flex gap-2">
                      {(['total', 'parcial'] as const).filter(t => t !== 'total' || esAdmin).map(t => (
                        <button
                          key={t}
                          onClick={() => setTipo(t)}
                          className={`px-3 py-1.5 rounded-[var(--r-in)] text-[12px] font-semibold border transition-all ${
                            tipo === t
                              ? t === 'total'
                                ? 'bg-[rgba(239,68,68,.12)] border-danger text-danger'
                                : 'bg-[rgba(234,179,8,.12)] border-[#ca8a04] text-[#fbbf24]'
                              : 'border-border text-text-muted bg-transparent hover:bg-surface-2'
                          }`}
                        >{t === 'total' ? 'Anulación total' : 'Devolución parcial'}</button>
                      ))}
                    </div>
                  </div>

                  {/* Tabla ítems */}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <table className="w-full text-[13px]">
                      <thead className="sticky top-0 bg-surface border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Ítem</th>
                          <th className="text-right px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">P.Unit</th>
                          <th className="text-right px-4 py-2 text-[11px] font-semibold text-text-muted uppercase w-24">
                            {tipo === 'parcial' ? 'A devolver' : 'Cant.'}
                          </th>
                          <th className="text-right px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selTrans.detalle.map((item: any) => {
                          const maxDisp = maxQtys[item.id] ?? item.cantidad;
                          const devQty  = itemQtys[item.id] ?? 0;
                          const yaTotal = maxDisp === 0;
                          const importe = tipo === 'parcial'
                            ? item.precio_al_momento * devQty
                            : item.importe_total;
                          return (
                            <tr key={item.id} className={`border-b border-border-sub transition-colors ${yaTotal ? 'opacity-50' : 'hover:bg-surface-2'}`}>
                              <td className="px-4 py-2.5 text-text font-medium">{item.nombre}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-text-muted">{fmt(item.precio_al_momento)}</td>
                              <td className="px-4 py-2.5 text-right">
                                {tipo === 'parcial' ? (
                                  yaTotal ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(34,197,94,.12)] text-[#4ade80]">Ya devuelto</span>
                                  ) : (
                                    <input
                                      type="number" min="0" max={maxDisp} step="any"
                                      value={devQty}
                                      onChange={e => {
                                        const v = Math.min(maxDisp, Math.max(0, parseFloat(e.target.value) || 0));
                                        setItemQtys(q => ({ ...q, [item.id]: v }));
                                      }}
                                      className="inp w-20 text-right py-0.5 px-2 text-[12px] font-mono"
                                    />
                                  )
                                ) : (
                                  <span className="font-mono">{item.cantidad}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-text tabular-nums">{fmt(importe)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-4 border-t border-border flex flex-col gap-3 flex-shrink-0">
                    {tipo === 'parcial' && (() => {
                      const totalDev = selTrans.detalle.reduce(
                        (s: number, i: any) => s + i.precio_al_momento * (itemQtys[i.id] ?? 0), 0
                      );
                      return (
                        <div className="flex items-center justify-between text-[13px] pb-1 border-b border-border-sub">
                          <span className="text-text-muted">Total a devolver:</span>
                          <span className="font-bold font-mono text-[17px] text-text">{fmt(totalDev)}</span>
                        </div>
                      );
                    })()}
                    <div className="field">
                      <label className="field-label">Motivo <span className="text-danger">*</span></label>
                      <input
                        autoFocus
                        className="inp"
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        placeholder="Ej: error en precio, cliente devolvió el producto..."
                        onKeyDown={e => e.key === 'Enter' && confirmar()}
                      />
                    </div>
                    {error && (
                      <div className="text-[12px] text-danger px-3 py-2 bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.25)] rounded-[var(--r-in)]">
                        {error}
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                      <button
                        disabled={loading || (tipo === 'parcial' && selTrans?.detalle.every((i: any) => (itemQtys[i.id] ?? 0) <= 0))}
                        onClick={confirmar}
                        className={`btn font-bold ${tipo === 'total' ? 'btn-danger' : 'btn-primary'}`}
                      >
                        {loading
                          ? 'Procesando...'
                          : tipo === 'total'
                            ? 'Anular transacción'
                            : 'Confirmar devolución'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
