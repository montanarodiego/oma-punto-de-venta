'use strict';
/**
 * Tests unitarios para calcularTotales (src/renderer/pages/caja/calculosFiscales.ts).
 * Replica la lógica en JS puro para correr con: node tests/calculos_fiscales.test.js
 *
 * Cubre cada modo fiscal: monotributista, restaurante, responsable_inscripto,
 * mayorista, farmacia, personalizado — y casos de borde: descuentos por ítem,
 * descuento global %, descuento global $, propina, carrito vacío.
 *
 * Desde C-3 el cálculo se hace en CENTAVOS ENTEROS (src/renderer/pages/caja/money.ts)
 * para eliminar errores de punto flotante. Los casos "PRECISIÓN" al final fallaban
 * con la implementación vieja basada en floats.
 */

const assert = require('assert');

// ── Réplica de money.ts ─────────────────────────────────────────────────────
function aCentavos(pesos) {
  if (!Number.isFinite(pesos)) return 0;
  return Math.round((pesos + Number.EPSILON) * 100);
}
function aPesos(centavos) { return centavos / 100; }

// ── Réplica exacta de la lógica de calculosFiscales.ts (centavos) ───────────

const MODOS_IVA_DESGLOSADO = new Set(['responsable_inscripto', 'mayorista', 'farmacia']);

function calcularTotales(carrito, descGlobalTipo, descGlobalValor, propina, modoNegocio, mostrarIva, tasaIva) {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function item(precio, cantidad, descPct = 0, tasaIva = undefined) {
  return { precio, cantidad, descPct, ...(tasaIva !== undefined ? { tasaIva } : {}) };
}

function near(a, b, msg) {
  assert(Math.abs(a - b) < 0.001, `${msg}: got ${a}, expected ${b}`);
}

// Verifica que un monto está cuantizado al centavo (lo mostrado == lo cobrado).
function esCentavoExacto(n, msg) {
  assert.strictEqual(Math.round(n * 100) / 100, n, `${msg}: ${n} no está cuantizado al centavo`);
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

// ════════════════════════════════════════════════════════════════════════════
// REGRESIÓN DE PRECISIÓN (C-3) — estos casos fallaban con la lógica de floats
// ════════════════════════════════════════════════════════════════════════════

// ── 0.1 + 0.2 clásico: la suma debe ser EXACTAMENTE 0.3 ──────────────────────
{
  const carrito = [item(0.1, 1), item(0.2, 1)];
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'monotributista', true, 21);
  assert.strictEqual(t.sub,   0.3, 'precisión: 0.1 + 0.2 debe ser exactamente 0.3');
  assert.strictEqual(t.total, 0.3, 'precisión: total exactamente 0.3');
  console.log('✓ precisión: 0.1 + 0.2 === 0.3 (sin basura de float)');
}

// ── IVA sobre precio con centavos: el total cobrado == total mostrado ────────
{
  const carrito = [item(99.99, 1)]; // RI 21%
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'responsable_inscripto', true, 21);
  // 99.99 * 0.21 = 20.9979 → redondea a 21.00 (centavo más cercano)
  esCentavoExacto(t.iva,   'precisión: iva de 99.99');
  esCentavoExacto(t.total, 'precisión: total de 99.99');
  assert.strictEqual(t.iva,   21,     'precisión: iva 99.99*21% = 20.9979 → 21.00');
  assert.strictEqual(t.total, 120.99, 'precisión: total = 99.99 + 21.00');
  console.log('✓ precisión: IVA sobre 99.99 cuantizado al centavo');
}

// ── Cantidad continua (kg) con precio fraccionario ───────────────────────────
{
  const carrito = [item(999, 0.15)]; // 0.15 kg × $999 = $149.85
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'monotributista', true, 21);
  esCentavoExacto(t.sub,   'precisión: sub de cantidad continua');
  assert.strictEqual(t.sub,   149.85, 'precisión: 0.15 × 999 = 149.85');
  assert.strictEqual(t.total, 149.85, 'precisión: total = 149.85');
  console.log('✓ precisión: cantidad continua (kg) cuantizada al centavo');
}

// ── Muchos ítems con precio .99: sin deriva acumulada ────────────────────────
{
  const carrito = Array.from({ length: 7 }, () => item(0.99, 1));
  const t = calcularTotales(carrito, 'ninguno', 0, 0, 'monotributista', true, 21);
  // 0.99 * 7 = 6.93 exacto; con floats la suma acumulaba error
  assert.strictEqual(t.sub,   6.93, 'precisión: 7 × 0.99 = 6.93 sin deriva');
  assert.strictEqual(t.total, 6.93, 'precisión: total = 6.93');
  console.log('✓ precisión: suma de 7×0.99 sin deriva acumulada');
}

// ── Todos los campos del retorno están siempre cuantizados al centavo ────────
{
  const carrito = [item(33.33, 3, 7, 21), item(12.5, 2, 0, 10.5)];
  const t = calcularTotales(carrito, 'pct', 13, '5.5', 'farmacia', true, 21);
  for (const k of ['sub', 'desc', 'subtotalConDesc', 'iva', 'total', 'propAmt']) {
    esCentavoExacto(t[k], `precisión: campo ${k}`);
  }
  console.log('✓ precisión: todos los campos del retorno cuantizados al centavo');
}

console.log('\n✓ calculos_fiscales: todos los modos fiscales, casos de borde y regresión de precisión pasaron');
