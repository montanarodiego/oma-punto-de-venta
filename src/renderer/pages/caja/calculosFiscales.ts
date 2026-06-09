import type { CartItem } from './types';
import { MODOS_IVA_DESGLOSADO } from './types';

export interface Totales {
  sub: number;
  desc: number;
  subtotalConDesc: number;
  iva: number;
  total: number;
  propAmt: number;
}

export function calcularTotales(
  carrito: CartItem[],
  descGlobalTipo: 'ninguno' | 'pct' | 'monto',
  descGlobalValor: number,
  propina: string | number,
  modoNegocio: string,
  mostrarIva: boolean,
  tasaIva: number,
): Totales {
  let sub = 0;
  for (const item of carrito) {
    const base = item.precio * item.cantidad;
    sub += item.descPct > 0 ? base * (1 - item.descPct / 100) : base;
  }

  let desc = 0;
  if (descGlobalTipo === 'pct') desc = sub * descGlobalValor / 100;
  else if (descGlobalTipo === 'monto') desc = Math.min(descGlobalValor, sub);
  const subtotalConDesc = sub - desc;

  let iva = 0;
  if (mostrarIva && MODOS_IVA_DESGLOSADO.has(modoNegocio)) {
    for (const item of carrito) {
      const tasa = item.tasaIva ?? tasaIva;
      const base = item.precio * item.cantidad;
      const baseDesc = item.descPct > 0 ? base * (1 - item.descPct / 100) : base;
      iva += baseDesc * tasa / 100;
    }
    if (desc > 0 && sub > 0) iva *= (1 - desc / sub);
  }

  const propAmt = typeof propina === 'string' ? parseFloat(propina) || 0 : (propina || 0);
  const total = subtotalConDesc + iva + propAmt;
  return { sub, desc, subtotalConDesc, iva, total: Math.max(0, total), propAmt };
}
