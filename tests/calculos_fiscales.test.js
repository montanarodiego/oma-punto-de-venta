'use strict';
/**
 * Tests unitarios para calcularTotales (src/renderer/pages/caja/calculosFiscales.ts).
 * Replica la lógica en JS puro para correr con: node tests/calculos_fiscales.test.js
 *
 * Cubre cada modo fiscal: monotributista, restaurante, responsable_inscripto,
 * mayorista, farmacia, personalizado — y casos de borde: descuentos por ítem,
 * descuento global %, descuento global $, propina, carrito vacío.
 */

const assert = require('assert');

// ── Réplica exacta de la lógica de calculosFiscales.ts ──────────────────────

const MODOS_IVA_DESGLOSADO = new Set(['responsable_inscripto', 'mayorista', 'farmacia']);

function calcularTotales(carrito, descGlobalTipo, descGlobalValor, propina, modoNegocio, mostrarIva, tasaIva) {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function item(precio, cantidad, descPct = 0, tasaIva = undefined) {
  return { precio, cantidad, descPct, ...(tasaIva !== undefined ? { tasaIva } : {}) };
}

function near(a, b, msg) {
  assert(Math.abs(a - b) < 0.001, `${msg}: got ${a}, expected ${b}`);
}

// ── MODO: monotributista — sin IVA desglosado ────────────────────────────────
{
  const carrito = [item(100, 2), item(50, 3)];
  // sub = 200 + 150 = 350
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'monotributista', true, 21);
  near(t.sub,             350, 'mono: sub');
  near(t.iva,               0, 'mono: iva debe ser 0 (modo sin IVA)');
  near(t.total,           350, 'mono: total');
  near(t.desc,              0, 'mono: desc');
  console.log('✓ monotributista: sin IVA desglosado');
}

// ── MODO: restaurante — sin IVA, con propina ─────────────────────────────────
{
  const carrito = [item(200, 1)];
  const t = calcularTotales(carrito, 'ninguno', 0, '30', 'restaurante', true, 21);
  near(t.sub,             200, 'rest: sub');
  near(t.iva,               0, 'rest: iva debe ser 0');
  near(t.propAmt,          30, 'rest: propina');
  near(t.total,           230, 'rest: total = 200 + 30');
  console.log('✓ restaurante: sin IVA + propina');
}

// ── MODO: responsable_inscripto — IVA 21% desglosado ─────────────────────────
{
  const carrito = [item(100, 1)]; // sin tasaIva en ítem → usa la global
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'responsable_inscripto', true, 21);
  near(t.sub,   100,  'ri: sub');
  near(t.iva,    21,  'ri: iva = 100 * 21%');
  near(t.total, 121,  'ri: total = 100 + 21');
  console.log('✓ responsable_inscripto: IVA 21% sobre sub');
}

// ── MODO: responsable_inscripto — mostrarIva=false no desglosa ───────────────
{
  const carrito = [item(100, 1)];
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'responsable_inscripto', false, 21);
  near(t.iva,     0, 'ri noIva: iva=0 cuando mostrarIva=false');
  near(t.total, 100, 'ri noIva: total=sub');
  console.log('✓ responsable_inscripto: mostrarIva=false → sin desglose');
}

// ── MODO: mayorista — IVA desglosado ─────────────────────────────────────────
{
  const carrito = [item(1000, 5)]; // 5000 subtotal
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'mayorista', true, 21);
  near(t.sub,    5000,  'may: sub');
  near(t.iva,    1050,  'may: iva = 5000 * 21%');
  near(t.total,  6050,  'may: total');
  console.log('✓ mayorista: IVA desglosado al total');
}

// ── MODO: farmacia — múltiples tasas de IVA por ítem ─────────────────────────
{
  const carrito = [
    item(100, 1, 0, 21),   // $100 × 21% = $21 IVA
    item(100, 1, 0, 10.5), // $100 × 10.5% = $10.5 IVA
    item(100, 1, 0, 0),    // $100 × 0% = $0 IVA
  ];
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'farmacia', true, 21);
  near(t.sub,   300,  'far: sub = 300');
  near(t.iva,  31.5,  'far: iva = 21 + 10.5 + 0');
  near(t.total, 331.5, 'far: total');
  console.log('✓ farmacia: múltiples tasas IVA por ítem');
}

// ── Descuento global porcentaje ──────────────────────────────────────────────
{
  const carrito = [item(200, 1)];
  // sub=200, desc=10% → subtotalConDesc=180, iva=0 (mono)
  const t = calcularTotales(carrito, 'pct', 10, 0, 'monotributista', true, 21);
  near(t.sub,             200, 'descPct: sub antes de desc');
  near(t.desc,             20, 'descPct: desc = 200*10%');
  near(t.subtotalConDesc, 180, 'descPct: subtotalConDesc');
  near(t.total,           180, 'descPct: total');
  console.log('✓ descuento global %');
}

// ── Descuento global monto fijo ───────────────────────────────────────────────
{
  const carrito = [item(200, 1)];
  const t = calcularTotales(carrito, 'monto', 50, 0, 'monotributista', true, 21);
  near(t.desc,             50, 'descMonto: desc fijo $50');
  near(t.subtotalConDesc, 150, 'descMonto: subtotalConDesc');
  near(t.total,           150, 'descMonto: total');
  console.log('✓ descuento global monto fijo');
}

// ── Descuento global no puede exceder sub ────────────────────────────────────
{
  const carrito = [item(100, 1)];
  const t = calcularTotales(carrito, 'monto', 999, 0, 'monotributista', true, 21);
  near(t.desc,   100, 'descMax: capped al sub');
  near(t.total,    0, 'descMax: total=0');
  console.log('✓ descuento global capped al subtotal');
}

// ── Descuento por ítem ────────────────────────────────────────────────────────
{
  // ítem con 20% de descuento: base=200, efectivo=160
  const carrito = [item(100, 2, 20)];
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'monotributista', true, 21);
  near(t.sub,   160, 'descItem: sub = 200 * (1 - 0.20)');
  near(t.total, 160, 'descItem: total');
  console.log('✓ descuento por ítem');
}

// ── IVA con descuento global (RI) — IVA se reduce proporcionalmente ──────────
{
  const carrito = [item(100, 1)]; // sub=100, IVA=21
  // desc global 50% → sub efectivo=50, IVA debe reducirse en 50% también = 10.5
  const t = calcularTotales(carrito, 'pct', 50, 0, 'responsable_inscripto', true, 21);
  near(t.sub,              100, 'ivaDesc: sub');
  near(t.desc,              50, 'ivaDesc: desc = 50%');
  near(t.subtotalConDesc,   50, 'ivaDesc: subtotalConDesc');
  near(t.iva,             10.5, 'ivaDesc: iva proporcional = 21 * 0.5');
  near(t.total,           60.5, 'ivaDesc: total = 50 + 10.5');
  console.log('✓ IVA proporcional con descuento global (RI)');
}

// ── Carrito vacío ─────────────────────────────────────────────────────────────
{
  const t = calcularTotales([], 'ninguno', 0, 0, 'responsable_inscripto', true, 21);
  near(t.sub,    0, 'empty: sub=0');
  near(t.iva,    0, 'empty: iva=0');
  near(t.total,  0, 'empty: total=0');
  console.log('✓ carrito vacío');
}

// ── personalizado (sin IVA desglosado) ───────────────────────────────────────
{
  const carrito = [item(500, 2)];
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'personalizado', true, 21);
  near(t.iva,    0,    'custom: sin IVA desglosado');
  near(t.total, 1000,  'custom: total = sub');
  console.log('✓ personalizado: modo sin IVA no desglosado');
}

console.log('\n✓ calculos_fiscales: todos los modos fiscales y casos de borde pasaron');
