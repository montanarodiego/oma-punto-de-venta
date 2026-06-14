/**
 * Utilidades de dinero — evitan los errores de punto flotante de IEEE 754
 * (ej: 0.1 + 0.2 === 0.30000000000000004) en todos los cálculos monetarios.
 *
 * Regla: hacer las cuentas en centavos ENTEROS y convertir a pesos solo en el
 * borde (al mostrar o persistir). Así lo que se muestra == lo que se cobra ==
 * lo que se guarda, sin acumulación de error a lo largo de miles de ventas.
 */

/** Convierte un monto en pesos (float) a centavos enteros, redondeando al centavo. */
export function aCentavos(pesos: number): number {
  if (!Number.isFinite(pesos)) return 0;
  // +Number.EPSILON corrige casos como 1.005 * 100 = 100.49999999999999
  return Math.round((pesos + Number.EPSILON) * 100);
}

/** Convierte centavos enteros a pesos. */
export function aPesos(centavos: number): number {
  return centavos / 100;
}

/** Redondea un monto en pesos al centavo, eliminando artefactos de punto flotante. */
export function redondear(pesos: number): number {
  return aPesos(aCentavos(pesos));
}
