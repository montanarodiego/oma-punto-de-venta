'use strict';
/**
 * Utilidades de dinero para el proceso principal — espejo de
 * src/renderer/pages/caja/money.ts. Evitan los errores de punto flotante de
 * IEEE 754 en cálculos monetarios que se persisten en SQLite.
 *
 * Regla: hacer las cuentas en centavos ENTEROS y convertir a pesos solo en el
 * borde (al persistir), para que lo guardado coincida al centavo con lo cobrado.
 */

/** Convierte un monto en pesos (float) a centavos enteros, redondeando al centavo. */
function aCentavos(pesos) {
  if (!Number.isFinite(pesos)) return 0;
  // +Number.EPSILON corrige casos como 1.005 * 100 = 100.49999999999999
  return Math.round((pesos + Number.EPSILON) * 100);
}

/** Convierte centavos enteros a pesos. */
function aPesos(centavos) {
  return centavos / 100;
}

/** Redondea un monto en pesos al centavo, eliminando artefactos de punto flotante. */
function redondear(pesos) {
  return aPesos(aCentavos(pesos));
}

module.exports = { aCentavos, aPesos, redondear };
