/**
 * Tests de contrato para informes.js y turnos.js.
 *
 * Llama a los modelos REALES contra una DB SQLite en memoria para verificar
 * que los objetos devueltos tienen exactamente los campos que declara api.d.ts.
 * Si se renombra un campo en el backend, este test FALLA.
 *
 * Ejecución (requiere Electron porque better-sqlite3 está compilado para él):
 *   npx electron tests/contrato_backend.test.js
 *
 * El script maneja ambos entornos: Electron (espera app.whenReady) y Node puro
 * (falla rápido con mensaje claro si el módulo nativo no matchea).
 */
'use strict';

const assert     = require('assert');
const IS_ELECTRON = !!process.versions.electron;

// ── Lógica principal del test ─────────────────────────────────────────────────
function runTests() {
  const Database = require('better-sqlite3');

  // ── 1. DB en memoria ────────────────────────────────────────────────────────
  const testDb = new Database(':memory:');

  // ── 2. Parchar require.cache ANTES de requerir los modelos ──────────────────
  //    Los modelos hacen require('../database') y usan getDb().
  //    Inyectamos nuestra DB en memoria sin tocar nada de producción.
  const dbModulePath = require.resolve('../src/main/database');
  require.cache[dbModulePath] = {
    id: dbModulePath, filename: dbModulePath, loaded: true,
    exports: { getDb: () => testDb, initDatabase: () => {} },
    parent: null, children: [], paths: [],
  };

  // ── 3. Schema mínimo ────────────────────────────────────────────────────────
  testDb.exec(`
    CREATE TABLE articulos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo          TEXT UNIQUE NOT NULL,
      nombre          TEXT NOT NULL,
      costo_unitario  REAL NOT NULL DEFAULT 0,
      precio_unitario REAL NOT NULL DEFAULT 0,
      stock_actual    REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE transacciones (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      monto_total       REAL NOT NULL DEFAULT 0,
      subtotal          REAL NOT NULL DEFAULT 0,
      monto_impuesto    REAL NOT NULL DEFAULT 0,
      descuento_global  REAL NOT NULL DEFAULT 0,
      propina           REAL NOT NULL DEFAULT 0,
      estado            TEXT NOT NULL DEFAULT 'vigente',
      turno_id          INTEGER,
      forma_pago        TEXT NOT NULL DEFAULT 'efectivo',
      forma_pago_2      TEXT,
      monto_pago_2      REAL,
      cuenta_cliente_id INTEGER,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE detalle_transaccion (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      transaccion_id       INTEGER NOT NULL,
      articulo_id          INTEGER,
      descripcion_libre    TEXT,
      cantidad             REAL NOT NULL DEFAULT 1,
      precio_al_momento    REAL NOT NULL DEFAULT 0,
      descuento_porcentaje REAL NOT NULL DEFAULT 0,
      importe_total        REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE turnos (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_apertura          TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_cierre            TEXT,
      efectivo_inicial        REAL NOT NULL DEFAULT 0,
      efectivo_esperado       REAL NOT NULL DEFAULT 0,
      efectivo_real           REAL,
      diferencia              REAL,
      total_ventas            REAL NOT NULL DEFAULT 0,
      total_transacciones     INTEGER NOT NULL DEFAULT 0,
      ventas_efectivo         REAL NOT NULL DEFAULT 0,
      ventas_debito           REAL NOT NULL DEFAULT 0,
      ventas_credito          REAL NOT NULL DEFAULT 0,
      ventas_transferencia    REAL NOT NULL DEFAULT 0,
      ventas_cuenta_corriente REAL NOT NULL DEFAULT 0,
      notas                   TEXT,
      estado                  TEXT NOT NULL DEFAULT 'abierto'
    );

    CREATE TABLE movimientos_caja (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      turno_id         INTEGER NOT NULL,
      tipo             TEXT NOT NULL,
      monto            REAL NOT NULL,
      descripcion      TEXT,
      categoria        TEXT,
      cancelado        INTEGER NOT NULL DEFAULT 0,
      cancelado_motivo TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── 4. Cargar modelos (ya usan testDb gracias al parche) ────────────────────
  // Limpiar de cache por si el test se corre más de una vez en la misma sesión
  delete require.cache[require.resolve('../src/main/models/informes')];
  delete require.cache[require.resolve('../src/main/models/turnos')];
  const informes = require('../src/main/models/informes');
  const turnos   = require('../src/main/models/turnos');

  // ── 5. Datos de prueba ──────────────────────────────────────────────────────
  // Fecha fija a mediodía UTC → siempre cae dentro del rango ART 2026-01-15
  // independientemente de la hora del sistema al correr el test.
  const FECHA_VENTA = '2026-01-15 12:00:00';

  const artId = testDb.prepare(
    "INSERT INTO articulos (codigo, nombre, costo_unitario, precio_unitario) VALUES ('T001','Art Test',500,1000)"
  ).run().lastInsertRowid;

  const turnoId = testDb.prepare(
    "INSERT INTO turnos (efectivo_inicial, estado) VALUES (1000, 'abierto')"
  ).run().lastInsertRowid;

  const tranId = testDb.prepare(`
    INSERT INTO transacciones
      (monto_total, subtotal, monto_impuesto, turno_id, forma_pago, propina, estado, created_at)
    VALUES (2000, 2000, 0, ?, 'efectivo', 50, 'vigente', ?)
  `).run(turnoId, FECHA_VENTA).lastInsertRowid;

  testDb.prepare(`
    INSERT INTO detalle_transaccion
      (transaccion_id, articulo_id, cantidad, precio_al_momento, descuento_porcentaje, importe_total)
    VALUES (?, ?, 2, 1000, 0, 2000)
  `).run(tranId, artId);

  // ── 6. Contrato: informes.resumenRapido ─────────────────────────────────────
  {
    // Campos exactos de ResumenRapido en api.d.ts.
    // Renombrar cualquiera en informes.js rompe esta aserción.
    const CAMPOS = [
      'total_ventas', 'cantidad_ventas', 'ticket_promedio', 'ganancia_bruta',
      'ventas_efectivo', 'ventas_debito', 'ventas_credito',
      'ventas_transferencia', 'ventas_cuenta_corriente',
    ];

    const r = informes.resumenRapido('2026-01-15', '2026-01-15');

    for (const campo of CAMPOS) {
      assert(campo in r,
        `resumenRapido: falta el campo '${campo}' — si fue renombrado en informes.js, actualizá ResumenRapido en api.d.ts`);
    }

    assert.strictEqual(r.total_ventas,            2000, 'total_ventas debe ser 2000');
    assert.strictEqual(r.cantidad_ventas,          1,    'cantidad_ventas debe ser 1');
    assert.strictEqual(r.ticket_promedio,          2000, 'ticket_promedio debe ser 2000');
    assert.strictEqual(r.ventas_efectivo,          2000, 'ventas_efectivo debe ser 2000');
    assert.strictEqual(r.ganancia_bruta,           1000, 'ganancia_bruta: 2×(1000-500)=1000');
    assert.strictEqual(r.ventas_debito,               0, 'ventas_debito debe ser 0');
    assert.strictEqual(r.ventas_cuenta_corriente,     0, 'ventas_cuenta_corriente debe ser 0');

    console.log('✓ informes.resumenRapido   — contrato de campos y cálculos verificado');
  }

  // ── 7. Contrato: turnos.calcularResumen ─────────────────────────────────────
  {
    const CAMPOS_BASE = [
      'total_ventas', 'total_transacciones',
      'ventas_efectivo', 'ventas_debito', 'ventas_credito',
      'ventas_transferencia', 'ventas_cuenta_corriente',
      'efectivo_esperado',
    ];
    const CAMPOS_CALCULADOS = [
      'total_descuentos', 'total_propinas',
      'total_entradas',   'total_salidas',
    ];

    const r = turnos.calcularResumen(turnoId);

    for (const campo of [...CAMPOS_BASE, ...CAMPOS_CALCULADOS]) {
      assert(campo in r,
        `calcularResumen: falta el campo '${campo}' — si fue renombrado en turnos.js, actualizá TurnoResumen en api.d.ts`);
    }

    assert.strictEqual(r.total_ventas,        2000, 'total_ventas debe ser 2000');
    assert.strictEqual(r.total_transacciones, 1,    'total_transacciones debe ser 1');
    assert.strictEqual(r.ventas_efectivo,     2000, 'ventas_efectivo debe ser 2000');
    assert.strictEqual(r.total_propinas,      50,   'total_propinas debe ser 50');
    assert.strictEqual(r.total_entradas,      0,    'total_entradas debe ser 0');
    assert.strictEqual(r.total_salidas,       0,    'total_salidas debe ser 0');
    // efectivo_esperado = inicial(1000) + ventas_efectivo(2000) + entradas(0) - salidas(0)
    assert.strictEqual(r.efectivo_esperado,   3000, 'efectivo_esperado debe ser 3000');

    console.log('✓ turnos.calcularResumen   — contrato de campos y cálculos verificado');
  }

  console.log('\n✅ Todos los tests de contrato pasaron.\n');
}

// ── Entrypoint: funciona en Electron y en Node puro ──────────────────────────
if (IS_ELECTRON) {
  const { app } = require('electron');
  app.whenReady().then(() => {
    try {
      runTests();
      app.quit();
    } catch (err) {
      console.error('\n❌ FALLO:', err.message);
      process.exit(1);
    }
  });
} else {
  try {
    runTests();
  } catch (err) {
    console.error('\n❌ FALLO:', err.message);
    process.exit(1);
  }
}
