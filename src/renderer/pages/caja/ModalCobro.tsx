import { useState, useRef, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { Cliente, CreateTransaccionData } from '../../types/api';
import type { Ticket } from './types';
import { fmt } from './types';
import type { Totales } from './calculosFiscales';

export interface ModalCobroHandle {
  cobrar: (conTicket: boolean) => void;
}

interface ModalCobroProps {
  open: boolean;
  onClose: () => void;
  totales: Totales;
  ticket: Ticket;
  activeIdx: number;
  turnoActivo: any;
  propina: string;
  canCobrar: boolean;
  limpiarTicket: (idx: number) => void;
  showToast: (msg: string, type?: 'ok' | 'error' | 'warning') => void;
  navigate: (path: string) => void;
  onVentaRegistrada: (transId: number) => void;
}

export const ModalCobro = forwardRef<ModalCobroHandle, ModalCobroProps>(function ModalCobro(
  { open, onClose, totales, ticket, activeIdx, turnoActivo, propina, canCobrar,
    limpiarTicket, showToast, navigate, onVentaRegistrada },
  ref,
) {
  const [formaPago,      setFormaPago]      = useState('efectivo');
  const [monto,          setMonto]          = useState('');
  const [cliente,        setCliente]        = useState<Cliente | null>(null);
  const [busqCliente,    setBusqCliente]    = useState('');
  const [resClientes,    setResClientes]    = useState<Cliente[]>([]);
  const [error,          setError]          = useState('');
  const [cobrandoOp,     setCobrandoOp]     = useState(false);
  const [mixtoMetodo1,   setMixtoMetodo1]   = useState('efectivo');
  const [mixtoMetodo2,   setMixtoMetodo2]   = useState('tarjeta_debito');
  const [mixtoMonto1,    setMixtoMonto1]    = useState('');

  const modalRef     = useRef<HTMLDivElement>(null);
  const timerCliente = useRef<NodeJS.Timeout | null>(null);

  useFocusTrap(modalRef, open, onClose);

  const vuelto = useMemo(
    () => formaPago === 'efectivo' ? Math.max(0, (parseFloat(monto) || 0) - totales.total) : 0,
    [formaPago, monto, totales.total],
  );
  const mixtoMonto2 = useMemo(
    () => formaPago === 'mixto' ? Math.max(0, totales.total - (parseFloat(mixtoMonto1) || 0)) : 0,
    [formaPago, totales.total, mixtoMonto1],
  );

  const cobrar = useCallback(async (conTicket: boolean) => {
    if (cobrandoOp) return;
    if (!turnoActivo) { showToast('No hay turno abierto.', 'error'); navigate('/turno'); return; }
    if (ticket.carrito.length === 0) { setError('El carrito está vacío.'); return; }

    const total = totales.total;
    if (formaPago === 'cuenta_corriente' && !cliente) { setError('Seleccioná un cliente para cuenta corriente.'); return; }
    if (formaPago === 'mixto') {
      const m1 = parseFloat(mixtoMonto1);
      if (isNaN(m1) || m1 <= 0 || m1 >= total) { setError('El monto del método 1 debe ser mayor a 0 y menor al total.'); return; }
    }

    setError('');
    setCobrandoOp(true);
    window.api.setModalCobro(true);

    try {
      const montoRec = formaPago === 'efectivo' ? parseFloat(monto) || 0 : 0;
      const vueltoCalc = formaPago === 'efectivo' ? Math.max(0, montoRec - total) : 0;
      const propAmt = parseFloat(propina) || 0;
      const mixtoMonto2Calc = formaPago === 'mixto' ? Math.max(0, total - (parseFloat(mixtoMonto1) || 0)) : 0;

      const data: CreateTransaccionData = {
        transaccion: {
          turno_id:          turnoActivo.id,
          monto_total:       total,
          subtotal:          totales.subtotalConDesc,
          monto_impuesto:    totales.iva,
          descuento_global:  totales.desc,
          propina:           propAmt,
          forma_pago:        formaPago === 'mixto' ? mixtoMetodo1 : formaPago,
          forma_pago_2:      formaPago === 'mixto' ? mixtoMetodo2 : null,
          monto_pago_2:      formaPago === 'mixto' ? mixtoMonto2Calc : null,
          cuenta_cliente_id: cliente?.id ?? null,
          notas:             ticket.notas || null,
        },
        detalle: ticket.carrito.map(it => ({
          articulo_id:          it.articuloId ?? null,
          descripcion_libre:    it.esLibre ? it.nombre : it.nombre,
          cantidad:             it.cantidad,
          precio_al_momento:    it.precio,
          descuento_porcentaje: it.descPct,
          importe_total:        it.precio * it.cantidad * (1 - it.descPct / 100),
        })),
      };

      const res = await window.api.transacciones.create(data);
      onVentaRegistrada(res.id);

      if (conTicket) {
        window.api.caja.abrirComprobante({ transaccionId: res.id, montoRecibido: montoRec, vuelto: vueltoCalc, propina: propAmt });
      }
      window.api.printer.imprimir(res.id, { montoRecibido: montoRec, vuelto: vueltoCalc, propina: propAmt }).catch(() => {});

      limpiarTicket(activeIdx);
      onClose();
      setMonto('');
      setCliente(null);
      setBusqCliente('');
      setMixtoMonto1('');
      window.api.setModalCobro(false);
      showToast(`Venta #${res.id} registrada.${conTicket ? '' : ' Sin comprobante.'}`, 'ok');
    } catch (err: any) {
      setError(err.message ?? 'Error al registrar la venta.');
    } finally {
      setCobrandoOp(false);
    }
  }, [cobrandoOp, turnoActivo, ticket, totales, formaPago, monto, cliente, mixtoMonto1, mixtoMetodo1, mixtoMetodo2, propina, activeIdx, limpiarTicket, onClose, showToast, navigate, onVentaRegistrada]);

  useImperativeHandle(ref, () => ({ cobrar }), [cobrar]);

  // Teclas 1-6 seleccionan forma de pago; Enter cobra; manejadas aquí para no contaminar Caja.tsx
  useEffect(() => {
    if (!open) return;
    const FORMAS = ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cuenta_corriente', 'mixto'];
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea';
      if (!isInput && e.key >= '1' && e.key <= '6') {
        e.preventDefault(); setFormaPago(FORMAS[parseInt(e.key) - 1]);
      } else if (e.key === 'Enter' && !isInput && tag !== 'button') {
        e.preventDefault(); cobrar(true);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, cobrar]);

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
            className="bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-[700px] max-w-[98vw] max-h-[96vh] flex overflow-hidden"
            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
          >
            {/* Columna izquierda */}
            <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4 border-r border-border">
              {/* Total */}
              <div className="text-center py-2">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-1">Total a pagar</div>
                <div className="text-[46px] font-black font-mono leading-none text-text">{fmt(totales.total)}</div>
              </div>

              {/* Formas de pago */}
              <div>
                <div className="text-[11px] font-semibold text-text-muted mb-2">Forma de pago</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'efectivo',         label: 'Efectivo',      fkey: '1' },
                    { id: 'tarjeta_debito',   label: 'Débito',        fkey: '2' },
                    { id: 'tarjeta_credito',  label: 'Crédito',       fkey: '3' },
                    { id: 'transferencia',    label: 'Transferencia', fkey: '4' },
                    { id: 'cuenta_corriente', label: 'Cta. Cte.',     fkey: '5' },
                    { id: 'mixto',            label: 'Mixto',         fkey: '6' },
                  ].map(fp => (
                    <button
                      key={fp.id}
                      onClick={() => setFormaPago(fp.id)}
                      className={`relative flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-[var(--r)] border-2 text-[12px] font-semibold transition-all ${
                        formaPago === fp.id
                          ? 'bg-[rgba(79,142,245,.12)] border-accent text-text shadow-[0_0_0_3px_rgba(79,142,245,.15)]'
                          : 'bg-surface-2 border-border text-text-muted hover:bg-surface-3'
                      }`}
                    >
                      <span className="absolute top-1 right-1.5 text-[9px] font-bold opacity-50">{fp.fkey}</span>
                      {fp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Efectivo */}
              {formaPago === 'efectivo' && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] text-text-muted mb-1">Monto recibido</div>
                      <input
                        type="number" min="0" step="0.01" value={monto}
                        onChange={e => setMonto(e.target.value)}
                        className="w-full text-[22px] font-bold font-mono px-3 py-2 border-2 border-border focus:border-accent bg-bg text-text rounded-[var(--r)] outline-none"
                        autoFocus placeholder="0,00"
                      />
                    </div>
                    <div className="flex flex-col items-center justify-center border border-border rounded-[var(--r)] gap-1 bg-bg">
                      <div className="text-[10px] font-semibold text-text-subtle uppercase">Vuelto</div>
                      <div className={`text-[26px] font-black font-mono ${vuelto > 0 ? 'text-success' : 'text-text-subtle'}`}>{vuelto > 0 ? fmt(vuelto) : '—'}</div>
                    </div>
                  </div>
                  {/* Numpad */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {['7','8','9','4','5','6','1','2','3','00','0','del'].map(k => (
                      <button
                        key={k}
                        onClick={() => {
                          if (k === 'del') setMonto(p => p.slice(0, -1));
                          else setMonto(p => (p + k).replace(/^0+(?=\d)/, ''));
                        }}
                        className={`h-12 rounded-[var(--r)] border text-[18px] font-semibold font-mono transition-all active:scale-95 ${
                          k === 'del'
                            ? 'bg-[rgba(239,68,68,.08)] border-[rgba(239,68,68,.25)] text-danger hover:bg-[rgba(239,68,68,.15)]'
                            : 'bg-surface-2 border-border text-text hover:bg-surface-3'
                        }`}
                      >{k === 'del' ? '⌫' : k}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cuenta corriente */}
              {formaPago === 'cuenta_corriente' && (
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] text-text-muted">Buscar cliente</div>
                  <input
                    className="inp" placeholder="Nombre o teléfono..."
                    value={busqCliente}
                    onChange={e => {
                      setBusqCliente(e.target.value);
                      if (timerCliente.current) clearTimeout(timerCliente.current);
                      timerCliente.current = setTimeout(async () => {
                        const res = await window.api.clientes.search(e.target.value);
                        setResClientes(res);
                      }, 200);
                    }}
                  />
                  {resClientes.length > 0 && !cliente && (
                    <div className="bg-surface-2 border border-border rounded-[var(--r-in)] max-h-[120px] overflow-y-auto">
                      {resClientes.map(c => (
                        <div key={c.id} onClick={() => { setCliente(c); setResClientes([]); setBusqCliente(c.nombre); }} className="px-3 py-2 cursor-pointer hover:bg-surface-3 text-[13px] border-b border-border-sub last:border-none">
                          <span className="font-medium">{c.nombre}</span> <span className="text-text-muted text-[11px]">{c.telefono}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {cliente && (
                    <div className="flex items-center justify-between bg-[rgba(79,142,245,.1)] border border-[rgba(79,142,245,.3)] rounded-[var(--r-in)] px-3 py-2">
                      <span className="text-[13px] font-medium text-[#93c5fd]">{cliente.nombre}</span>
                      <button onClick={() => { setCliente(null); setBusqCliente(''); }} className="text-[16px] text-[#60a5fa] hover:text-white">✕</button>
                    </div>
                  )}
                </div>
              )}

              {/* Mixto */}
              {formaPago === 'mixto' && (
                <div className="flex flex-col gap-3">
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Dividir en dos métodos</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] text-text-muted mb-1">Método 1</div>
                      <select className="inp" value={mixtoMetodo1} onChange={e => setMixtoMetodo1(e.target.value)}>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta_debito">Débito</option>
                        <option value="tarjeta_credito">Crédito</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-[11px] text-text-muted mb-1">Monto 1</div>
                      <input type="number" min="0" step="0.01" value={mixtoMonto1} onChange={e => setMixtoMonto1(e.target.value)} className="inp text-[17px] font-bold font-mono" placeholder="0,00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] text-text-muted mb-1">Método 2</div>
                      <select className="inp" value={mixtoMetodo2} onChange={e => setMixtoMetodo2(e.target.value)}>
                        <option value="tarjeta_debito">Débito</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta_credito">Crédito</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-[11px] text-text-muted mb-1">Resto (auto)</div>
                      <div className="inp text-[17px] font-bold font-mono text-text-muted bg-surface">{fmt(mixtoMonto2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {error && <div className="px-3 py-2 bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.25)] rounded-[var(--r-in)] text-[#fca5a5] text-[12px]">{error}</div>}
            </div>

            {/* Columna derecha: botones */}
            <div className="flex flex-col w-40 min-w-[140px] flex-shrink-0">
              <button
                disabled={cobrandoOp || !canCobrar}
                onClick={() => cobrar(true)}
                className="flex-1 flex flex-col items-center justify-center gap-2 border-b border-[rgba(255,255,255,.07)] bg-success hover:bg-success-hover disabled:opacity-45 text-white transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <div className="text-[13px] font-bold text-center leading-tight">Cobrar e imprimir</div>
                <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/20">F1</div>
              </button>
              <button
                disabled={cobrandoOp || !canCobrar}
                onClick={() => cobrar(false)}
                className="flex-1 flex flex-col items-center justify-center gap-2 border-b border-[rgba(255,255,255,.07)] bg-surface-2 hover:bg-surface-3 disabled:opacity-45 text-text transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg>
                <div className="text-[13px] font-bold text-center leading-tight">Sin comprobante</div>
                <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-bg border border-border text-text-muted">F2</div>
              </button>
              <button
                onClick={onClose}
                className="flex-1 flex flex-col items-center justify-center gap-2 bg-transparent hover:bg-[rgba(239,68,68,.08)] text-danger transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <div className="text-[13px] font-bold">Cancelar</div>
                <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.3)] text-danger">Esc</div>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
