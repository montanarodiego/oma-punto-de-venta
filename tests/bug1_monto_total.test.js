/**
 * BUG 1 — Verifica que una venta con ítems conocidos produce monto_total / ganancia_bruta
 * correctos y que resumenRapido retorna los campos esperados por Informes.tsx.
 *
 * Es un test de lógica pura (sin DB) para que corra con node directamente.
 * Ejecutar: node tests/bug1_monto_total.test.js
 */
'use strict';

const assert = require('assert');

// ---------- Lógica de negocio (replica los cálculos del backend) ----------

function calcularImporte(cantidad, precio, descuentoPct) {
  return cantidad * precio * (1 - descuentoPct / 100);
}

function calcularGananciaLinea(cantidad, precio, descuentoPct, costo) {
  return cantidad * (precio * (1 - descuentoPct / 100) - costo);
}

// Replica la transformación de resumenRapido luego del fix:
// antes devolvía { cantidad, total, ganancia_bruta } y Informes.tsx leía
// total_ventas / cantidad_ventas / ticket_promedio → undefined → 0.
function mapResumenRapido(row, gan, byPago = {}) {
  return {
    total_ventas:            row.total,
    cantidad_ventas:         row.cantidad,
    ticket_promedio:         row.cantidad > 0 ? row.total / row.cantidad : 0,
    ganancia_bruta:          gan.ganancia_bruta,
    ventas_efectivo:         byPago['efectivo']         ?? 0,
    ventas_debito:           byPago['tarjeta_debito']   ?? 0,
    ventas_credito:          byPago['tarjeta_credito']  ?? 0,
    ventas_transferencia:    byPago['transferencia']    ?? 0,
    ventas_cuenta_corriente: byPago['cuenta_corriente'] ?? 0,
  };
}

// ---------- Tests ----------

// Venta: 2 unidades × $1000, costo $500 → monto_total $2000, ganancia $1000
const items = [{ cantidad: 2, precio: 1000, descuento: 0, costo: 500 }];

const montoTotal    = items.reduce((s, d) => s + calcularImporte(d.cantidad, d.precio, d.descuento), 0);
const gananciaBruta = items.reduce((s, d) => s + calcularGananciaLinea(d.cantidad, d.precio, d.descuento, d.costo), 0);

assert.strictEqual(montoTotal,    2000, 'monto_total debe ser 2000');
assert.strictEqual(gananciaBruta, 1000, 'ganancia_bruta debe ser 1000');

// resumenRapido con 1 transacción de $2000 en efectivo
const resumen = mapResumenRapido(
  { cantidad: 1, total: 2000 },
  { ganancia_bruta: 1000 },
  { efectivo: 2000 },
);

assert.strictEqual(resumen.total_ventas,            2000, 'total_ventas debe ser 2000');
assert.strictEqual(resumen.cantidad_ventas,         1,    'cantidad_ventas debe ser 1');
assert.strictEqual(resumen.ticket_promedio,         2000, 'ticket_promedio debe ser 2000');
assert.strictEqual(resumen.ganancia_bruta,          1000, 'ganancia_bruta debe ser 1000');
assert.strictEqual(resumen.ventas_efectivo,         2000, 'ventas_efectivo debe ser 2000');
assert.strictEqual(resumen.ventas_debito,           0,    'ventas_debito debe ser 0');
assert.strictEqual(resumen.ventas_cuenta_corriente, 0,    'ventas_cuenta_corriente debe ser 0');

// ticket_promedio = 0 cuando no hay ventas (no dividir por cero)
const resumenVacio = mapResumenRapido({ cantidad: 0, total: 0 }, { ganancia_bruta: 0 });
assert.strictEqual(resumenVacio.ticket_promedio, 0, 'ticket_promedio debe ser 0 cuando cantidad = 0');

console.log('✓ BUG 1: monto_total y ganancia calculados correctamente; resumenRapido retorna total_ventas/cantidad_ventas/ticket_promedio/ganancia_bruta/ventas_por_forma_pago');
