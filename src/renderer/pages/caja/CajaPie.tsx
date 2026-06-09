import type { CartItem } from './types';
import { fmt, MODOS_IVA_DESGLOSADO } from './types';
import type { Totales } from './calculosFiscales';
import { PieStat } from './ui';

interface CajaPieProps {
  carrito: CartItem[];
  totales: Totales;
  mostrarIva: boolean;
  modoNegocio: string;
  tasaIva: number;
  canCobrar: boolean;
  ultimaTransId: number | null;
  onCobrar: () => void;
}

export function CajaPie({ carrito, totales, mostrarIva, modoNegocio, tasaIva, canCobrar, ultimaTransId, onCobrar }: CajaPieProps) {
  return (
    <div className="flex items-center bg-surface border-t-2 border-border flex-shrink-0 min-h-[72px]">
      <div className="px-5 py-3 border-r border-border flex flex-col justify-center min-w-[90px]">
        <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Ítems</div>
        <div className="text-[26px] font-black tabular-nums leading-tight">
          {carrito.reduce((s, i) => s + i.cantidad, 0)}
        </div>
      </div>
      <div className="flex-1 px-5 flex items-center gap-6 justify-center">
        <PieStat label="Total" value={fmt(totales.total)} size="lg" />
        {totales.desc > 0 && <PieStat label="Descuento" value={`-${fmt(totales.desc)}`} color="#f59e0b" />}
        {mostrarIva && MODOS_IVA_DESGLOSADO.has(modoNegocio) && totales.iva > 0 && (
          <>
            <PieStat label="Subtotal" value={fmt(totales.subtotalConDesc)} muted />
            <PieStat label={`IVA ${tasaIva}%`} value={fmt(totales.iva)} muted />
          </>
        )}
        {totales.propAmt > 0 && <PieStat label="Propina" value={fmt(totales.propAmt)} color="#a78bfa" />}
      </div>
      <div className="px-3 flex items-center gap-2 flex-shrink-0">
        {ultimaTransId && (
          <button
            className="flex flex-col items-center justify-center px-3 py-2 rounded-[var(--r)] bg-surface-2 border border-border text-text-muted hover:bg-surface-3 transition-all gap-1"
            onClick={() => window.api.caja.abrirComprobante({ transaccionId: ultimaTransId, montoRecibido: 0, vuelto: 0, propina: 0 })}
            title="Reimprimir último comprobante"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span className="text-[11px] font-semibold">Reimprimir</span>
          </button>
        )}
        <button
          disabled={!canCobrar}
          onClick={onCobrar}
          className="flex flex-col items-center justify-center px-6 py-3 rounded-[var(--r)] bg-gradient-to-br from-[#2dda6e] to-[#16a34a] text-white min-w-[145px] min-h-[64px] disabled:opacity-40 disabled:cursor-not-allowed hover:from-[#38e87a] hover:to-[#1ab84e] hover:-translate-y-0.5 transition-all shadow-lg gap-0.5"
          style={{ animation: canCobrar ? 'pulse-cobrar 4s ease-in-out 2s infinite' : 'none' }}
        >
          <span className="text-[11px] opacity-70 font-bold tracking-widest">F12</span>
          <span className="text-[28px] font-black font-mono leading-none tabular-nums">{fmt(totales.total)}</span>
          <span className="text-[13px] font-black tracking-widest uppercase">COBRAR</span>
        </button>
      </div>
    </div>
  );
}
