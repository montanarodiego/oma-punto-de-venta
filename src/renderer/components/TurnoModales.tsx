import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Turno, TurnoResumen } from '../types/api';

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n ?? 0);
}

function nowStr() {
  const d = new Date();
  return (
    d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' }) +
    ' · ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  );
}

// ── MODAL APERTURA ──────────────────────────────────────────────────────────
export function ModalApertura({ open, nombreUsuario, onAbierto }: {
  open: boolean;
  nombreUsuario: string;
  onAbierto: (turno: Turno) => void;
}) {
  const [efectivo, setEfectivo] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setEfectivo('0'); setError(''); setTimeout(() => inputRef.current?.select(), 80); }
  }, [open]);

  // Bloquear Escape — el modal no es dismissible
  useEffect(() => {
    if (!open) return;
    const block = (e: KeyboardEvent) => { if (e.key === 'Escape') e.preventDefault(); };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(efectivo);
    if (isNaN(val) || val < 0) { setError('Ingresá un monto válido (puede ser $0).'); return; }
    setLoading(true); setError('');
    try {
      const turno = await window.api.turnos.abrir(val);
      onAbierto(turno);
    } catch (err: any) {
      setError(err.message ?? 'Error al abrir el turno.');
    } finally { setLoading(false); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9000] flex items-center justify-center"
          style={{ background: 'radial-gradient(ellipse at 55% 35%, rgba(99,102,241,0.14) 0%, rgba(9,14,26,0.97) 65%)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <motion.form
            onSubmit={handleSubmit}
            className="w-full max-w-[460px] mx-4 bg-[#0d1526] border border-[rgba(99,102,241,0.22)] rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden"
            initial={{ scale: 0.93, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.28)] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <p className="text-[12px] font-semibold text-[#6366f1] tracking-widest uppercase mb-2">Inicio de turno</p>
              <h2 className="text-[24px] font-bold text-white leading-tight">
                ¡Buen día, {nombreUsuario.split(' ')[0]}!
              </h2>
              <p className="text-[13px] text-[#475569] mt-1.5 capitalize">{nowStr()}</p>
            </div>

            <div className="mx-8 h-px bg-[rgba(255,255,255,0.06)]" />

            {/* Body */}
            <div className="px-8 py-6">
              <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-3 text-center">
                Efectivo en caja al iniciar
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[28px] font-black text-[#334155] pointer-events-none select-none">$</span>
                <input
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={efectivo}
                  onChange={e => setEfectivo(e.target.value)}
                  className="w-full bg-[#131f35] border border-[rgba(255,255,255,0.07)] rounded-xl pl-10 pr-4 py-4 text-[34px] font-black text-white text-center focus:outline-none focus:border-[#6366f1] transition-colors tabular-nums"
                  placeholder="0"
                  required
                />
              </div>
              {error
                ? <p className="mt-2.5 text-[12px] text-[#f87171] text-center">{error}</p>
                : <p className="mt-2.5 text-[12px] text-[#334155] text-center">Ingresá el efectivo físico en caja al abrir.</p>
              }
            </div>

            {/* Footer */}
            <div className="px-8 pb-8">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-[15px] text-white transition-colors duration-150 disabled:opacity-60 flex items-center justify-center gap-2.5"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M3 12a9 9 0 0 1 9-9"/>
                    </svg>
                    Abriendo turno…
                  </>
                ) : (
                  <>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4"/>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    Abrir turno y comenzar
                  </>
                )}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── MODAL CIERRE ─────────────────────────────────────────────────────────────
export function ModalCierre({ open, turno, onCerrado, onVolver }: {
  open: boolean;
  turno: Turno | null;
  onCerrado: () => void;
  onVolver: () => void;
}) {
  const [resumen, setResumen]         = useState<TurnoResumen | null>(null);
  const [efectivoReal, setEfectivoReal] = useState('');
  const [notas, setNotas]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !turno) return;
    setEfectivoReal(''); setNotas(''); setError(''); setResumen(null);
    window.api.turnos.calcularResumen(turno.id).then(r => setResumen(r)).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [open, turno?.id]);

  const diferencia = (() => {
    const real = parseFloat(efectivoReal);
    if (isNaN(real) || !resumen) return null;
    return real - resumen.efectivo_esperado;
  })();

  async function handleCierre() {
    const ef = parseFloat(efectivoReal);
    if (isNaN(ef) || ef < 0) { setError('Ingresá el efectivo real en caja (puede ser $0).'); return; }
    setLoading(true); setError('');
    try {
      await window.api.turnos.cerrar(turno!.id, ef, notas);
      window.api.printer.imprimirCorteZ(turno!.id).catch(() => {});
      onCerrado();
    } catch (err: any) {
      setError(err.message ?? 'Error al cerrar el turno.');
    } finally { setLoading(false); }
  }

  const mediosPago = resumen ? [
    { label: 'Efectivo',   v: resumen.ventas_efectivo },
    { label: 'Débito',     v: resumen.ventas_debito },
    { label: 'Crédito',    v: resumen.ventas_credito },
    { label: 'Transf.',    v: resumen.ventas_transferencia },
    { label: 'Cta. cte.',  v: resumen.ventas_cuenta_corriente },
    { label: 'Propinas',   v: resumen.total_propinas ?? 0, accent: true },
  ].filter(m => m.v > 0) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9000] flex items-center justify-center overflow-y-auto py-4"
          style={{ background: 'radial-gradient(ellipse at 45% 65%, rgba(239,68,68,0.09) 0%, rgba(9,14,26,0.97) 65%)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <motion.div
            className="w-full max-w-[500px] mx-4 my-auto bg-[#0d1526] border border-[rgba(255,255,255,0.07)] rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden"
            initial={{ scale: 0.93, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="px-7 pt-6 pb-5 flex items-center gap-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.22)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-[#ef4444] font-bold uppercase tracking-widest">Cierre de turno</p>
                <h2 className="text-[17px] font-bold text-white leading-tight">¿Cerrás antes de salir?</h2>
              </div>
            </div>

            {/* Resumen */}
            {resumen ? (
              <div className="px-7 py-5 border-b border-[rgba(255,255,255,0.06)]">
                <p className="text-[10px] font-bold text-[#475569] uppercase tracking-widest mb-3">Resumen del turno</p>
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  <div className="bg-[#131f35] rounded-xl px-4 py-3">
                    <p className="text-[10px] text-[#475569] uppercase font-semibold tracking-wide mb-1">Total vendido</p>
                    <p className="text-[22px] font-black text-white font-mono tabular-nums leading-tight">{fmt(resumen.total_ventas)}</p>
                  </div>
                  <div className="bg-[#131f35] rounded-xl px-4 py-3">
                    <p className="text-[10px] text-[#475569] uppercase font-semibold tracking-wide mb-1">Transacciones</p>
                    <p className="text-[22px] font-black text-white font-mono tabular-nums leading-tight">{resumen.total_transacciones}</p>
                  </div>
                </div>
                {mediosPago.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {mediosPago.map(m => (
                      <div key={m.label} className="flex items-center gap-1.5 bg-[#131f35] rounded-lg px-2.5 py-1.5">
                        <span className="text-[11px] text-[#475569]">{m.label}</span>
                        <span className={`text-[13px] font-bold font-mono ${m.accent ? 'text-[#a78bfa]' : 'text-[#94a3b8]'}`}>{fmt(m.v)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-2.5 border-t border-[rgba(255,255,255,0.05)]">
                  <span className="text-[12px] text-[#475569]">Efectivo esperado en caja</span>
                  <span className="text-[20px] font-black font-mono text-[#818cf8]">{fmt(resumen.efectivo_esperado)}</span>
                </div>
              </div>
            ) : (
              <div className="px-7 py-5 border-b border-[rgba(255,255,255,0.06)]">
                <div className="h-[110px] flex items-center justify-center text-[13px] text-[#334155]">Calculando resumen…</div>
              </div>
            )}

            {/* Efectivo real */}
            <div className="px-7 pt-5 pb-2">
              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-2.5 text-center">
                Efectivo real en caja al cerrar
              </p>
              <div className="relative mb-3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[26px] font-black text-[#334155] pointer-events-none select-none">$</span>
                <input
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={efectivoReal}
                  onChange={e => setEfectivoReal(e.target.value)}
                  className="w-full bg-[#131f35] border border-[rgba(255,255,255,0.07)] rounded-xl pl-10 pr-4 py-3.5 text-[28px] font-black text-white text-center focus:outline-none focus:border-[#6366f1] transition-colors tabular-nums"
                  placeholder="0"
                />
              </div>

              {/* Diferencia en tiempo real */}
              {diferencia !== null && (
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl mb-3 ${
                  diferencia >= 0
                    ? 'bg-[rgba(34,197,94,0.09)] border border-[rgba(34,197,94,0.2)]'
                    : 'bg-[rgba(239,68,68,0.09)] border border-[rgba(239,68,68,0.2)]'
                }`}>
                  <span className="text-[12px] font-semibold" style={{ color: diferencia >= 0 ? '#86efac' : '#fca5a5' }}>
                    {diferencia >= 0 ? '✓ Cuadra la caja' : '✗ Faltante en caja'}
                  </span>
                  <span className={`text-[22px] font-black font-mono tabular-nums ${diferencia >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                    {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                  </span>
                </div>
              )}

              {/* Notas */}
              <div className="mb-4">
                <p className="text-[10px] font-bold text-[#475569] uppercase tracking-widest mb-2">Notas (opcional)</p>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full bg-[#131f35] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-2.5 text-[13px] text-white resize-none focus:outline-none focus:border-[#6366f1] transition-colors placeholder-[#2d3f5a]"
                  placeholder="Observaciones del cierre…"
                />
              </div>

              {error && <p className="text-[12px] text-[#f87171] mb-3">{error}</p>}
            </div>

            {/* Acciones */}
            <div className="px-7 pb-7 flex gap-3">
              <button
                type="button"
                onClick={onVolver}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] text-[#64748b] hover:bg-[#1a2740] hover:text-white font-semibold text-[14px] transition-colors duration-150 disabled:opacity-40"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCierre}
                disabled={loading || efectivoReal === ''}
                className="flex-[2] py-3 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-[14px] transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M3 12a9 9 0 0 1 9-9"/>
                    </svg>
                    Cerrando turno…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Cerrar turno y salir
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
