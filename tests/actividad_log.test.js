/**
 * Smoke test del log de actividad (ítem 12).
 *
 * Verifica de punta a punta lo que los tests de cobro NO cubren (ellos llaman a
 * los modelos directo, sin pasar por el logueo de ipc.js):
 *   1. La migración real (applySchemaTo) crea la tabla actividad_log.
 *   2. Actividad.registrar inserta y atribuye usuario.
 *   3. Actividad.listar devuelve en orden DESC y respeta los filtros.
 *   4. registrar es a prueba de fallos: sin `accion` no inserta ni lanza.
 *
 * Ejecución: npx electron tests/actividad_log.test.js
 */
'use strict';

const assert = require('assert');

function runTests() {
  const Database = require('better-sqlite3');

  // ── 1. DB en memoria con el schema REAL (incluye la migración nueva) ────────
  const realDb   = require('../src/main/database');
  const realPath = require.resolve('../src/main/database');
  const testDb   = new Database(':memory:');
  realDb.applySchemaTo(testDb);

  // La tabla debe existir gracias a runMigrations()
  const tabla = testDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='actividad_log'"
  ).get();
  assert.ok(tabla, 'la migración debe crear la tabla actividad_log');
  console.log('✓ migración          — actividad_log creada por applySchemaTo');

  // ── 2. Parchear getDb para que el modelo use la DB de test ──────────────────
  require.cache[realPath] = {
    id: realPath, filename: realPath, loaded: true,
    exports: { getDb: () => testDb, initDatabase: () => {}, applySchemaTo: realDb.applySchemaTo },
    parent: null, children: [], paths: [],
  };
  const Actividad = require('../src/main/models/actividad');

  // Usuario para validar la FK e el filtro por usuario
  const uid = testDb.prepare(
    "INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES ('Diego','diego','x','admin')"
  ).run().lastInsertRowid;

  // ── 3. registrar + atribución de usuario ────────────────────────────────────
  // La 3ra va sin usuario (usuario_id null): acción registrada sin sesión activa.
  Actividad.registrar({ usuario_id: uid, usuario_nombre: 'Diego', accion: 'venta',           detalle: 'Venta #1 · $100' });
  Actividad.registrar({ usuario_id: uid, usuario_nombre: 'Diego', accion: 'movimiento_caja', detalle: 'Salida de caja · $50' });
  Actividad.registrar({ usuario_id: null, usuario_nombre: null,   accion: 'turno_cerrado',   detalle: 'Cerró el turno #1' });

  const todas = Actividad.listar({});
  assert.strictEqual(todas.length, 3, 'deben quedar 3 entradas');
  console.log('✓ registrar          — 3 acciones guardadas y atribuidas');

  // ── 4. orden DESC (lo último primero) ───────────────────────────────────────
  assert.strictEqual(todas[0].accion, 'turno_cerrado', 'la última acción va primero');
  assert.strictEqual(todas[2].accion, 'venta',         'la primera acción va última');
  console.log('✓ listar             — orden descendente (lo más nuevo primero)');

  // ── 5. filtro por acción ────────────────────────────────────────────────────
  const soloVentas = Actividad.listar({ accion: 'venta' });
  assert.strictEqual(soloVentas.length, 1);
  assert.strictEqual(soloVentas[0].detalle, 'Venta #1 · $100');
  console.log('✓ filtro acción      — devuelve solo las del tipo pedido');

  // ── 6. filtro por usuario ───────────────────────────────────────────────────
  const delUsuario = Actividad.listar({ usuarioId: uid });
  assert.strictEqual(delUsuario.length, 2, 'el usuario tiene 2 acciones (la 3ra es de usuario null)');
  console.log('✓ filtro usuario     — devuelve solo las del usuario');

  // ── 7. filtro por fecha (rango imposible no devuelve nada) ───────────────────
  assert.strictEqual(Actividad.listar({ hasta: '2000-01-01' }).length, 0, 'nada antes del 2000');
  assert.strictEqual(Actividad.listar({ desde: '2000-01-01' }).length, 3, 'todo después del 2000');
  console.log('✓ filtro fecha       — desde/hasta acotan por día (UTC-3)');

  // ── 8. a prueba de fallos: sin accion no inserta ni lanza ───────────────────
  assert.doesNotThrow(() => Actividad.registrar({ detalle: 'sin accion' }));
  assert.strictEqual(Actividad.listar({}).length, 3, 'no debe haber insertado la entrada sin accion');
  console.log('✓ fail-safe          — registrar sin accion no inserta ni rompe');

  console.log('\n✅ Todos los tests del log de actividad pasaron.');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('\n❌ Test del log de actividad FALLÓ:\n', err);
  process.exit(1);
}
