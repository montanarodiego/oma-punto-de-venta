import type { CartItem } from './types';
import { MODOS_IVA_DESGLOSADO } from './types';
import { aCentavos, aPesos } from './money';

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
  // Todo el cálculo se hace en centavos enteros para evitar errores de punto
  // flotante. Cada importe de línea se cuantiza al centavo antes de sumar.
  let subCent = 0;
  for (const item of carrito) {
    const baseCent = aCentavos(item.precio * item.cantidad);
    const lineCent = item.descPct > 0
      ? baseCent - Math.round(baseCent * item.descPct / 100)
      : baseCent;
    subCent += lineCent;
  }

  let descCent = 0;
  if (descGlobalTipo === 'pct') descCent = Math.round(subCent * descGlobalValor / 100);
  else if (descGlobalTipo === 'monto') descCent = Math.min(aCentavos(descGlobalValor), subCent);
  const subtotalConDescCent = subCent - descCent;

  let ivaCent = 0;
  if (mostrarIva && MODOS_IVA_DESGLOSADO.has(modoNegocio)) {
    for (const item of carrito) {
      const tasa = item.tasaIva ?? tasaIva;
      const baseCent = aCentavos(item.precio * item.cantidad);
      const baseDescCent = item.descPct > 0
        ? baseCent - Math.round(baseCent * item.descPct / 100)
        : baseCent;
      ivaCent += Math.round(baseDescCent * tasa / 100);
    }
    // El IVA se reduce proporcionalmente al descuento global aplicado al subtotal.
    if (descCent > 0 && subCent > 0) {
      ivaCent = Math.round(ivaCent * subtotalConDescCent / subCent);
    }
  }

  const propRaw = typeof propina === 'string' ? parseFloat(propina) || 0 : (propina || 0);
  const propAmtCent = aCentavos(propRaw);
  const totalCent = Math.max(0, subtotalConDescCent + ivaCent + propAmtCent);

  return {
    sub:             aPesos(subCent),
    desc:            aPesos(descCent),
    subtotalConDesc: aPesos(subtotalConDescCent),
    iva:             aPesos(ivaCent),
    total:           aPesos(totalCent),
    propAmt:         aPesos(propAmtCent),
  };
}
