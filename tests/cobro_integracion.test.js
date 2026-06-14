/**
 * Test de integración del flujo de cobro completo.
 *
 * Verifica que transacciones.create (con el formato anidado { transaccion, detalle })
 * inserte correctamente cabecera + detalle, descuente stock de artículos con
 * usa_inventario=1, y actualice saldo_vencido en pagos CC.
 *
 * También verifica que la venta quede visible en informes.resumenRapido (el bug
 * original: Informes mostraba $0 porque create nunca insertaba nada).
 *
 * Este test falló antes del fix de Caja.tsx:534 porque el objeto plano que
 * mandaba Caja hacía que create({ transaccion, detalle }) recibiera undefined
 * en ambos campos y explotara en la primera línea.
 *
 * Ejecución: npx electron tests/cobro_integracion.test.js
 */
'use strict';

const assert      = require('assert');
const IS_ELECTRON = !!process.versions.electron;

function runTests() {
  const Database = require('better-sqlite3');

  // ── 1. DB en memoria + parche de require.cache ─────────────────────────────
  const testDb = new Database(':memory:');

  const dbPath = require.resolve('../src/main/database');
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: { getDb: () => testDb, initDatabase: () => {} },
    parent: null, children: [], paths: [],
  };

  // ── 2. Schema completo (igual que database.js, columnas relevantes) ─────────
  testDb.exec(`
    CREATE TABLE articulos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo          TEXT UNIQUE NOT NULL,
      nombre          TEXT NOT NULL,
      costo_unitario  REAL NOT NULL DEFAULT 0,
      precio_unitario REAL NOT NULL DEFAULT 0,
      stock_actual    REAL NOT NULL DEFAULT 0,
      stock_minimo    REAL NOT NULL DEFAULT 0,
      tasa_iva        REAL NOT NULL DEFAULT 0,
      unidad_medida   TEXT NOT NULL DEFAULT 'unidad',
      departamento_id INTEGER,
      es_kit          INTEGER NOT NULL DEFAULT 0,
      usa_inventario  INTEGER NOT NULL DEFAULT 0,
      sync_status     TEXT NOT NULL DEFAULT 'pending',
      updated_at      TEXT
    );

    CREATE TABLE kits_componentes (
      kit_id        INTEGER NOT NULL,
      componente_id INTEGER NOT NULL,
      cantidad      REAL NOT NULL DEFAULT 1,
      PRIMARY KEY (kit_id, componente_id)
    );

    CREATE TABLE clientes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre         TEXT NOT NULL,
      saldo_vencido  REAL NOT NULL DEFAULT 0,
      limite_credito REAL NOT NULL DEFAULT 0,
      sync_status    TEXT NOT NULL DEFAULT 'pending',
      updated_at     TEXT
    );

    CREATE TABLE transacciones (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      monto_total       REAL NOT NULL DEFAULT 0,
      subtotal          REAL NOT NULL DEFAULT 0,
      monto_impuesto    REAL NOT NULL DEFAULT 0,
      descuento_global  REAL NOT NULL DEFAULT 0,
      notas             TEXT,
      propina           REAL NOT NULL DEFAULT 0,
      estado            TEXT NOT NULL DEFAULT 'vigente',
      turno_id          INTEGER,
      forma_pago        TEXT NOT NULL DEFAULT 'efectivo',
      forma_pago_2      TEXT,
      monto_pago_2      REAL,
      cuenta_cliente_id INTEGER,
      sync_status       TEXT NOT NULL DEFAULT 'pending',
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

    CREATE TABLE movimientos_inventario (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      articulo_id          INTEGER,
      tipo                 TEXT NOT NULL,
      cantidad_anterior    REAL NOT NULL DEFAULT 0,
      cantidad_cambio      REAL NOT NULL DEFAULT 0,
      cantidad_resultante  REAL NOT NULL DEFAULT 0,
      costo_unitario       REAL NOT NULL DEFAULT 0,
      precio_unitario      REAL NOT NULL DEFAULT 0,
      motivo               TEXT,
      usuario              TEXT,
      referencia_id        INTEGER,
      fecha                TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── 3. Datos de prueba ──────────────────────────────────────────────────────
  // Artículo con inventario habilitado
  const artConInventario = testDb.prepare(
    `INSERT INTO articulos (codigo, nombre, costo_unitario, precio_unitario, stock_actual, usa_inventario)
     VALUES ('ART1','Artículo con stock',200,500,10,1)`
  ).run().lastInsertRowid;

  // Artículo sin inventario
  const artSinInventario = testDb.prepare(
    `INSERT INTO articulos (codigo, nombre, costo_unitario, precio_unitario, stock_actual, usa_inventario)
     VALUES ('ART2','Artículo sin stock',0,300,0,0)`
  ).run().lastInsertRowid;

  // Cliente para prueba de CC
  const clienteId = testDb.prepare(
    `INSERT INTO clientes (nombre, saldo_vencido, limite_credito) VALUES ('Juan Test',0,10000)`
  ).run().lastInsertRowid;

  // ── 4. Cargar modelos (ya apuntan a testDb) ─────────────────────────────────
  delete require.cache[require.resolve('../src/main/models/inventario')];
  delete require.cache[require.resolve('../src/main/models/transacciones')];
  delete require.cache[require.resolve('../src/main/models/informes')];
  const Transacciones = require('../src/main/models/transacciones');
  const Informes      = require('../src/main/models/informes');

  // ══════════════════════════════════════════════════════════════════════════════
  // TEST 1: cobro básico en efectivo — verifica (a)-(d)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    const stockAntes = testDb.prepare('SELECT stock_actual FROM articulos WHERE id = ?').get(artConInventario).stock_actual;

    const result = Transacciones.create({
      transaccion: {
        monto_total:       1300,
        subtotal:          1300,
        monto_impuesto:    0,
        descuento_global:  0,
        propina:           0,
        forma_pago:        'efectivo',
        forma_pago_2:      null,
        monto_pago_2:      null,
        cuenta_cliente_id: null,
        notas:             null,
      },
      detalle: [
        {
          articulo_id:          artConInventario,
          descripcion_libre:    null,
          cantidad:             2,
          precio_al_momento:    500,
          descuento_porcentaje: 0,
          importe_total:        1000,
        },
        {
          articulo_id:          artSinInventario,
          descripcion_libre:    null,
          cantidad:             1,
          precio_al_momento:    300,
          descuento_porcentaje: 0,
          importe_total:        300,
        },
      ],
    });

    // (a) no crasheó
    assert.ok(result && result.id, 'create debe devolver la transacción con id');

    // (b) monto guardado correctamente
    const trans = testDb.prepare('SELECT * FROM transacciones WHERE id = ?').get(result.id);
    assert.strictEqual(trans.monto_total, 1300, 'monto_total debe ser 1300');
    assert.strictEqual(trans.forma_pago, 'efectivo', 'forma_pago debe ser efectivo');

    // (c) detalle guardado — 2 ítems
    const detalle = testDb.prepare('SELECT * FROM detalle_transaccion WHERE transaccion_id = ?').all(result.id);
    assert.strictEqual(detalle.length, 2, 'debe haber 2 ítems en detalle_transaccion');
    const det1 = detalle.find(d => d.articulo_id === artConInventario);
    assert.ok(det1, 'debe haber detalle para el artículo con inventario');
    assert.strictEqual(det1.cantidad, 2, 'cantidad del ítem 1 debe ser 2');

    // (d) stock descontado para artículo con usa_inventario=1
    const stockDespues = testDb.prepare('SELECT stock_actual FROM articulos WHERE id = ?').get(artConInventario).stock_actual;
    assert.strictEqual(stockDespues, stockAntes - 2, `stock debe bajar de ${stockAntes} a ${stockAntes - 2}`);

    // movimiento de inventario registrado
    const mov = testDb.prepare("SELECT * FROM movimientos_inventario WHERE referencia_id = ? AND tipo = 'venta'").get(result.id);
    assert.ok(mov, 'debe haber movimiento de inventario registrado');
    assert.strictEqual(mov.cantidad_cambio, -2, 'cantidad_cambio debe ser -2');

    // artículo SIN inventario — stock no cambia (sigue en 0)
    const stockSinInv = testDb.prepare('SELECT stock_actual FROM articulos WHERE id = ?').get(artSinInventario).stock_actual;
    assert.strictEqual(stockSinInv, 0, 'stock de artículo sin inventario no debe cambiar');

    console.log('✓ cobro efectivo     — transacción + detalle + stock deducido + movimiento');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TEST 2: cobro con descuento global — verifica que monto se guarda tal cual
  // ══════════════════════════════════════════════════════════════════════════════
  {
    const result = Transacciones.create({
      transaccion: {
        monto_total:       900,   // 1000 - 10% de descuento global
        subtotal:          900,
        monto_impuesto:    0,
        descuento_global:  100,
        propina:           0,
        forma_pago:        'tarjeta_debito',
        forma_pago_2:      null,
        monto_pago_2:      null,
        cuenta_cliente_id: null,
        notas:             null,
      },
      detalle: [
        {
          articulo_id:          artSinInventario,
          descripcion_libre:    null,
          cantidad:             3,
          precio_al_momento:    300,
          descuento_porcentaje: 0,
          importe_total:        900,
        },
      ],
    });

    const trans = testDb.prepare('SELECT * FROM transacciones WHERE id = ?').get(result.id);
    assert.strictEqual(trans.monto_total,      900, 'monto_total con descuento debe ser 900');
    assert.strictEqual(trans.descuento_global, 100, 'descuento_global debe ser 100');
    assert.strictEqual(trans.forma_pago,       'tarjeta_debito', 'forma_pago debe ser tarjeta_debito');

    console.log('✓ cobro con descuento — monto y descuento_global guardados correctamente');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TEST 3: cobro mixto (efectivo + transferencia)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    const result = Transacciones.create({
      transaccion: {
        monto_total:       600,
        subtotal:          600,
        monto_impuesto:    0,
        descuento_global:  0,
        propina:           0,
        forma_pago:        'efectivo',
        forma_pago_2:      'transferencia',
        monto_pago_2:      300,
        cuenta_cliente_id: null,
        notas:             null,
      },
      detalle: [
        {
          articulo_id:          artSinInventario,
          descripcion_libre:    null,
          cantidad:             2,
          precio_al_momento:    300,
          descuento_porcentaje: 0,
          importe_total:        600,
        },
      ],
    });

    const trans = testDb.prepare('SELECT * FROM transacciones WHERE id = ?').get(result.id);
    assert.strictEqual(trans.forma_pago,   'efectivo',      'forma_pago mixto debe ser efectivo');
    assert.strictEqual(trans.forma_pago_2, 'transferencia', 'forma_pago_2 debe ser transferencia');
    assert.strictEqual(trans.monto_pago_2, 300,             'monto_pago_2 debe ser 300');

    console.log('✓ cobro mixto        — forma_pago_2 y monto_pago_2 guardados correctamente');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TEST 4: cobro en cuenta corriente — actualiza saldo_vencido del cliente
  // ══════════════════════════════════════════════════════════════════════════════
  {
    const saldoAntes = testDb.prepare('SELECT saldo_vencido FROM clientes WHERE id = ?').get(clienteId).saldo_vencido;

    Transacciones.create({
      transaccion: {
        monto_total:       800,
        subtotal:          800,
        monto_impuesto:    0,
        descuento_global:  0,
        propina:           0,
        forma_pago:        'cuenta_corriente',
        forma_pago_2:      null,
        monto_pago_2:      null,
        cuenta_cliente_id: clienteId,
        notas:             null,
      },
      detalle: [
        {
          articulo_id:          artSinInventario,
          descripcion_libre:    null,
          cantidad:             1,
          precio_al_momento:    800,
          descuento_porcentaje: 0,
          importe_total:        800,
        },
      ],
    });

    const saldoDespues = testDb.prepare('SELECT saldo_vencido FROM clientes WHERE id = ?').get(clienteId).saldo_vencido;
    assert.strictEqual(saldoDespues, saldoAntes + 800, 'saldo_vencido del cliente debe aumentar 800');

    console.log('✓ cobro CC           — saldo_vencido del cliente actualizado');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TEST SEGURIDAD (I-1): validación anti-tampering server-side
  // ══════════════════════════════════════════════════════════════════════════════
  {
    const stockAntes = testDb.prepare('SELECT stock_actual FROM articulos WHERE id = ?').get(artConInventario).stock_actual;

    // (a) precio por debajo del de lista (500) → rechazado
    assert.throws(() => Transacciones.create({
      transaccion: { monto_total: 1, subtotal: 1, monto_impuesto: 0, descuento_global: 0, propina: 0,
        forma_pago: 'efectivo', forma_pago_2: null, monto_pago_2: null, cuenta_cliente_id: null, notas: null },
      detalle: [{ articulo_id: artConInventario, descripcion_libre: null, cantidad: 1,
        precio_al_momento: 1, descuento_porcentaje: 0, importe_total: 1 }],
    }), /mínimo permitido|seguridad/i, 'debe rechazar precio por debajo del de lista');

    // (b) monto_total manipulado con líneas correctas → rechazado
    assert.throws(() => Transacciones.create({
      transaccion: { monto_total: 1, subtotal: 1, monto_impuesto: 0, descuento_global: 0, propina: 0,
        forma_pago: 'efectivo', forma_pago_2: null, monto_pago_2: null, cuenta_cliente_id: null, notas: null },
      detalle: [{ articulo_id: artConInventario, descripcion_libre: null, cantidad: 2,
        precio_al_momento: 500, descuento_porcentaje: 0, importe_total: 1000 }],
    }), /no coincide|seguridad/i, 'debe rechazar monto_total manipulado');

    // (c) descuento por ítem fuera de rango → rechazado
    assert.throws(() => Transacciones.create({
      transaccion: { monto_total: 0, subtotal: 0, monto_impuesto: 0, descuento_global: 0, propina: 0,
        forma_pago: 'efectivo', forma_pago_2: null, monto_pago_2: null, cuenta_cliente_id: null, notas: null },
      detalle: [{ articulo_id: artConInventario, descripcion_libre: null, cantidad: 1,
        precio_al_momento: 500, descuento_porcentaje: 150, importe_total: 0 }],
    }), /Descuento|rango/i, 'debe rechazar descuento fuera de 0–100%');

    // ninguna venta rechazada tocó el stock (validación previa a la transacción)
    const stockDespues = testDb.prepare('SELECT stock_actual FROM articulos WHERE id = ?').get(artConInventario).stock_actual;
    assert.strictEqual(stockDespues, stockAntes, 'ventas rechazadas no deben tocar el stock');

    // (d) venta legítima a precio de lista sigue funcionando
    const ok = Transacciones.create({
      transaccion: { monto_total: 500, subtotal: 500, monto_impuesto: 0, descuento_global: 0, propina: 0,
        forma_pago: 'efectivo', forma_pago_2: null, monto_pago_2: null, cuenta_cliente_id: null, notas: null },
      detalle: [{ articulo_id: artConInventario, descripcion_libre: null, cantidad: 1,
        precio_al_momento: 500, descuento_porcentaje: 0, importe_total: 500 }],
    });
    assert.ok(ok && ok.id, 'venta legítima a precio de lista debe registrarse');

    console.log('✓ seguridad I-1      — rechaza precio bajo, monto manipulado y descuento inválido; acepta venta legítima');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TEST 5: las ventas aparecen en informes.resumenRapido (e)
  // El bug original: create con objeto plano nunca insertaba → Informes siempre $0
  // ══════════════════════════════════════════════════════════════════════════════
  {
    // Las transacciones se insertan con created_at = datetime('now') en UTC.
    // resumenRapido espera fechas locales ART; para que todas las ventas del test
    // queden dentro del rango pedimos un rango de 7 días centrado en hoy.
    const hoy = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const desde = fmtDate(new Date(hoy.getTime() - 7 * 86400000));
    const hasta = fmtDate(new Date(hoy.getTime() + 1 * 86400000));

    const r = Informes.resumenRapido(desde, hasta);

    // Ventas de tests 1-4: montos 1300 + 900 + 600 + 800 = 3600
    assert.ok(r.cantidad_ventas >= 4, `debe haber al menos 4 ventas, hay ${r.cantidad_ventas}`);
    assert.ok(r.total_ventas   >= 3600, `total_ventas debe ser >= 3600, es ${r.total_ventas}`);

    console.log(`✓ informes           — ${r.cantidad_ventas} ventas visibles, total $${r.total_ventas}`);
  }

  console.log('\n✅ Todos los tests de integración de cobro pasaron.\n');
}

// ── Entrypoint ────────────────────────────────────────────────────────────────
if (IS_ELECTRON) {
  const { app } = require('electron');
  app.whenReady().then(() => {
    try { runTests(); app.quit(); }
    catch (err) { console.error('\n❌ FALLO:', err.message); process.exit(1); }
  });
} else {
  try { runTests(); }
  catch (err) { console.error('\n❌ FALLO:', err.message); process.exit(1); }
}
