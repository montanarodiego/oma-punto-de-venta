import { useState, useRef, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useFiscal } from '../../context/FiscalContext';
import type { Cliente, CreateTransaccionData, EmitirFiscalPayload } from '../../types/api';
import type { Ticket } from './types';
import { fmt } from './types';
import { redondear } from './money';
import type { Totales } from './calculosFiscales';

export interface ModalCobroHandle {
  cobrar: (conTicket: boolean) => void;
}

// Datos en vuelo del paso fiscal: lo necesario para finalizar la venta una vez que
// AFIP responde (o el cajero decide seguir sin factura).
interface FiscalEmision {
  transId: number;
  conTicket: boolean;
  montoRec: number;
  vuelto: number;
  prop: number;
  payload: EmitirFiscalPayload;
  status: 'emitiendo' | 'error';
  error?: string;
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
  const { modoFiscal } = useFiscal();
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
  // Estado del paso fiscal (modo factura): mientras emite o si AFIP falla, mostramos
  // un overlay para que el cajero decida (reintentar / registrar sin factura). La venta
  // ya quedó guardada en SQLite antes de llegar acá, así que nada de esto la revierte.
  const [fiscalEmision,  setFiscalEmision]  = useState<FiscalEmision | null>(null);

  const modalRef     = useRef<HTMLDivElement>(null);
  const timerCliente = useRef<NodeJS.Timeout | null>(null);
  // Lock síncrono anti doble-cobro: se toma antes del primer await, así un
  // segundo disparo en el mismo tick (doble-click, o Enter + atajo F1) lo ve
  // en true y sale. cobrandoOp (estado) queda solo para el disabled visual.
  const cobrandoRef  = useRef(false);

  // Durante el paso fiscal, Esc no cierra: el cajero debe resolver el overlay.
  useFocusTrap(modalRef, open, fiscalEmision ? () => {} : onClose);

  const hayMonto   = monto !== '' && monto !== '0';
  const diferencia = useMemo(
    () => formaPago === 'efectivo' ? redondear((parseFloat(monto) || 0) - totales.total) : 0,
    [formaPago, monto, totales.total],
  );
  const vuelto = Math.max(0, diferencia);
  const efectivoInsuficiente = formaPago === 'efectivo' && hayMonto && diferencia < 0;
  const mixtoMonto2 = useMemo(
    () => formaPago === 'mixto' ? Math.max(0, redondear(totales.total - (parseFloat(mixtoMonto1) || 0))) : 0,
    [formaPago, totales.total, mixtoMonto1],
  );

  // Cierra la venta: imprime, limpia el ticket, resetea el modal y avisa. Se llama
  // tras registrar la venta (modo no fiscal) o tras resolver el paso fiscal.
  const finalizarVenta = useCallback((
    transId: number, conTicket: boolean, montoRec: number, vueltoCalc: number, propAmt: number,
    sinFactura = false,
  ) => {
    if (conTicket) {
      window.api.caja.abrirComprobante({ transaccionId: transId, montoRecibido: montoRec, vuelto: vueltoCalc, propina: propAmt });
    }
    window.api.printer.imprimir(transId, { montoRecibido: montoRec, vuelto: vueltoCalc, propina: propAmt }).catch(() => {});

    limpiarTicket(activeIdx);
    onClose();
    setMonto('');
    setCliente(null);
    setBusqCliente('');
    setMixtoMonto1('');
    setFiscalEmision(null);
    window.api.setModalCobro(false);
    showToast(
      `Venta #${transId} registrada.${conTicket ? '' : ' Sin comprobante.'}${sinFactura ? ' ⚠ Factura AFIP pendiente.' : ''}`,
      sinFactura ? 'warning' : 'ok',
    );
  }, [activeIdx, limpiarTicket, onClose, showToast]);

  // Intenta emitir la factura electrónica. En éxito, finaliza la venta. En error,
  // deja el overlay en estado 'error' para que el cajero reintente o siga sin factura.
  const emitirFiscal = useCallback(async (em: FiscalEmision) => {
    setFiscalEmision({ ...em, status: 'emitiendo', error: undefined });
    try {
      const r = await window.api.facturacion.emitir(em.payload);
      if (r.ok) {
        const t = r.data.cbte_tipo;
        const tipoLabel = t === 11 ? 'C' : t === 6 ? 'B' : t === 1 ? 'A' : '';
        showToast(`Factura ${tipoLabel} #${r.data.cbte_nro} emitida (CAE ${r.data.cae}).`, 'ok');
        finalizarVenta(em.transId, em.conTicket, em.montoRec, em.vuelto, em.prop);
      } else {
        setFiscalEmision({ ...em, status: 'error', error: r.error });
      }
    } catch (err: any) {
      setFiscalEmision({ ...em, status: 'error', error: err?.message ?? String(err) });
    }
  }, [showToast, finalizarVenta]);

  const cobrar = useCallback(async (conTicket: boolean) => {
    if (cobrandoRef.current || fiscalEmision) return;
    if (!turnoActivo) { showToast('No hay turno abierto.', 'error'); navigate('/turno'); return; }
    if (ticket.carrito.length === 0) { setError('El carrito está vacío.'); return; }

    const total = totales.total;
    if (formaPago === 'cuenta_corriente' && !cliente) { setError('Seleccioná un cliente para cuenta corriente.'); return; }
    if (formaPago === 'mixto') {
      const m1 = parseFloat(mixtoMonto1);
      if (isNaN(m1) || m1 <= 0 || m1 >= total) { setError('El monto del método 1 debe ser mayor a 0 y menor al total.'); return; }
    }

    // Lock síncrono ANTES de cualquier await: cierra la ventana de doble disparo.
    cobrandoRef.current = true;
    setError('');
    setCobrandoOp(true);
    window.api.setModalCobro(true);

    try {
      const montoRec = formaPago === 'efectivo' ? parseFloat(monto) || 0 : 0;
      const vueltoCalc = formaPago === 'efectivo' ? Math.max(0, redondear(montoRec - total)) : 0;
      const propAmt = redondear(parseFloat(propina) || 0);
      const mixtoMonto2Calc = formaPago === 'mixto' ? Math.max(0, redondear(total - (parseFloat(mixtoMonto1) || 0))) : 0;

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
          importe_total:        redondear(it.precio * it.cantidad * (1 - it.descPct / 100)),
        })),
      };

      const res = await window.api.transacciones.create(data);
      onVentaRegistrada(res.id);

      // Modo fiscal: emitir el comprobante electrónico. La venta YA está registrada en
      // SQLite; el paso fiscal nunca la revierte. Si AFIP falla, el overlay deja decidir
      // al cajero (reintentar / seguir sin factura). Los ítems van con su tasa de IVA para
      // que el backend arme Factura C (monotributo) o A/B (resp. inscripto) según la config.
      if (modoFiscal) {
        const payload: EmitirFiscalPayload = {
          transaccionId: res.id,
          total,
          items: ticket.carrito.map(it => ({
            importe: redondear(it.precio * it.cantidad * (1 - it.descPct / 100)),
            tasaIva: it.tasaIva ?? 0,
          })),
        };
        // Arranca el flujo fiscal; finalizarVenta corre cuando AFIP aprueba o el cajero decide.
        emitirFiscal({ transId: res.id, conTicket, montoRec, vuelto: vueltoCalc, prop: propAmt, payload, status: 'emitiendo' });
        return; // el modal queda abierto mostrando el overlay fiscal
      }

      finalizarVenta(res.id, conTicket, montoRec, vueltoCalc, propAmt);
    } catch (err: any) {
      setError(err.message ?? 'Error al registrar la venta.');
    } finally {
      cobrandoRef.current = false;
      setCobrandoOp(false);
    }
  }, [turnoActivo, ticket, totales, formaPago, monto, cliente, mixtoMonto1, mixtoMetodo1, mixtoMetodo2, propina, fiscalEmision, limpiarTicket, showToast, navigate, onVentaRegistrada, modoFiscal, emitirFiscal, finalizarVenta]);

  useImperativeHandle(ref, () => ({ cobrar }), [cobrar]);

  // Teclas 1-6 seleccionan forma de pago; Enter cobra; manejadas aquí para no contaminar Caja.tsx
  useEffect(() => {
    if (!open || fiscalEmision) return; // durante el paso fiscal, el overlay maneja las teclas
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
  }, [open, cobrar, fiscalEmision]);

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
            className="relative bg-surface border border-border rounded-[var(--r-card)] shadow-[var(--shadow-lg)] w-[700px] max-w-[98vw] max-h-[96vh] flex overflow-hidden"
            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
          >
            {/* Overlay del paso fiscal (modo factura): emitiendo o decisión ante fallo de AFIP */}
            {fiscalEmision && (
              <div className="absolute inset-0 z-10 bg-surface/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center gap-5">
                {fiscalEmision.status === 'emitiendo' ? (
                  <>
                    <div className="w-12 h-12 rounded-full border-4 border-border border-t-accent animate-spin" />
                    <div className="text-[15px] font-semibold text-text">Emitiendo factura electrónica…</div>
                    <div className="text-[12px] text-text-muted">Solicitando CAE a ARCA/AFIP. No cierres la ventana.</div>
                  </>
                ) : (
                  <>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-danger"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <div className="text-[15px] font-bold text-text">La factura AFIP no se pudo emitir</div>
                    <div className="text-[12px] text-text-muted max-w-[460px] max-h-[120px] overflow-y-auto bg-bg border border-border rounded-[var(--r-in)] px-3 py-2">{fiscalEmision.error}</div>
                    <div className="text-[12px] text-text-subtle">La venta <strong className="text-text">#{fiscalEmision.transId} ya quedó registrada</strong>. Podés reintentar o seguir sin factura (queda pendiente para reintentar después).</div>
                    <div className="flex gap-3 mt-1">
                      <button
                        onClick={() => emitirFiscal(fiscalEmision)}
                        className="px-5 py-2.5 rounded-[var(--r)] bg-accent hover:bg-accent-hover text-white font-semibold text-[13px] transition-colors"
                      >Reintentar</button>
                      <button
                        onClick={() => finalizarVenta(fiscalEmision.transId, fiscalEmision.conTicket, fiscalEmision.montoRec, fiscalEmision.vuelto, fiscalEmision.prop, true)}
                        className="px-5 py-2.5 rounded-[var(--r)] bg-surface-2 hover:bg-surface-3 border border-border text-text font-semibold text-[13px] transition-colors"
                      >Registrar sin factura</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Columna izquierda */}
            <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4 border-r border-border">
              {/* Total */}
              <div className="text-center py-2">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-1">Total a pagar</div>
                <div className="text-[48px] font-black font-mono leading-none text-text tabular-nums">{fmt(totales.total)}</div>
              </div>

              {/* Formas de pago */}
              <div>
                <div className="text-[11px] font-semibold text-text-muted mb-2">Forma de pago</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'efectivo',         label: 'Efectivo',      fkey: '1',
                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg> },
                    { id: 'tarjeta_debito',   label: 'Débito',        fkey: '2',
                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
                    { id: 'tarjeta_credito',  label: 'Crédito',       fkey: '3',
                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M5 15h2M9 15h4"/></svg> },
                    { id: 'transferencia',    label: 'Transferencia', fkey: '4',
                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
                    { id: 'cuenta_corriente', label: 'Cta. Cte.',     fkey: '5',
                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                    { id: 'mixto',            label: 'Mixto',         fkey: '6',
                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
                  ].map(fp => (
                    <button
                      key={fp.id}
                      onClick={() => setFormaPago(fp.id)}
                      className={`relative flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-[var(--r)] border-2 text-[12px] font-semibold transition-all ${
                        formaPago === fp.id
                          ? 'bg-[rgba(79,142,245,.12)] border-accent text-accent shadow-[0_0_0_3px_rgba(79,142,245,.15)]'
                          : 'bg-surface-2 border-border text-text-muted hover:bg-surface-3'
                      }`}
                    >
                      <span className="absolute top-1 right-1.5 text-[9px] font-bold opacity-40">{fp.fkey}</span>
                      {fp.icon}
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
                    <div className="flex flex-col items-center justify-center border border-border rounded-[var(--r)] gap-1 bg-bg min-h-[72px]">
                      {!hayMonto && (
                        <><div className="text-[10px] font-semibold text-text-subtle uppercase">Vuelto</div><div className="text-[32px] font-black font-mono text-text-subtle">—</div></>
                      )}
                      {hayMonto && diferencia > 0 && (
                        <><div className="text-[10px] font-semibold uppercase text-success">Vuelto</div><div className="text-[32px] font-black font-mono text-success">{fmt(vuelto)}</div></>
                      )}
                      {hayMonto && diferencia === 0 && (
                        <><div className="text-[10px] font-semibold uppercase text-success">Exacto</div><div className="text-[32px] font-black font-mono text-success">✓</div></>
                      )}
                      {hayMonto && diferencia < 0 && (
                        <><div className="text-[10px] font-semibold uppercase text-danger">Faltan</div><div className="text-[32px] font-black font-mono text-danger">{fmt(Math.abs(diferencia))}</div></>
                      )}
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
                disabled={cobrandoOp || !canCobrar || efectivoInsuficiente}
                onClick={() => cobrar(true)}
                className="flex-1 flex flex-col items-center justify-center gap-2 border-b border-[rgba(255,255,255,.07)] bg-success hover:bg-success-hover disabled:opacity-45 text-white transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <div className="text-[13px] font-bold text-center leading-tight">Cobrar e imprimir</div>
                <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/20">F1</div>
              </button>
              <button
                disabled={cobrandoOp || !canCobrar || efectivoInsuficiente}
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
