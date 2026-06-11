'use strict';
/**
 * Diagnóstico del bug "Catálogo vacío".
 * Corre cada query por separado e informa qué falla y por qué.
 *
 * Ejecutar con:
 *   npx electron src/main/scripts/diagnose-catalog.js
 */

const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

// Cuando se corre como `npx electron script.js`, Electron usa "Electron" como
// app name por defecto en lugar de leer package.json. Forzamos el nombre correcto
// para que app.getPath('userData') resuelva al path real de la app.
app.setName(require(path.join(__dirname, '..', '..', '..', 'package.json')).name);
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'oma-pos.db');
  console.log('\n══════════════════════════════════════════════');
  console.log(' Diagnóstico: Catálogo vacío');
  console.log('══════════════════════════════════════════════');
  console.log(`DB: ${dbPath}\n`);

  let db;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (err) {
    console.error('[ERROR] No se pudo abrir la DB:', err.message);
    app.quit(); return;
  }

  // ── 1. Integridad ────────────────────────────────────────────
  section('1. PRAGMA integrity_check y quick_check');
  run(db, 'PRAGMA integrity_check', r => r.integrity_check);
  run(db, 'PRAGMA quick_check',     r => r.quick_check);

  // ── 2. Conteo de tablas clave ────────────────────────────────
  section('2. Conteo de filas');
  runGet(db, 'SELECT COUNT(*) AS c FROM articulos',     'articulos');
  runGet(db, 'SELECT COUNT(*) AS c FROM departamentos', 'departamentos');

  // ── 3. Tabla departamentos completa ─────────────────────────
  section('3. SELECT * FROM departamentos ORDER BY nombre');
  try {
    const rows = db.prepare('SELECT * FROM departamentos ORDER BY nombre').all();
    if (rows.length === 0) {
      console.log('   (sin filas — tabla vacía)');
    } else {
      rows.forEach(r => console.log(`   id=${r.id}  nombre="${r.nombre}"  color=${r.color}`));
    }
    console.log('   → OK');
  } catch (err) {
    console.log(`   → FALLA: ${err.message}`);
  }

  // ── 4. searchPaged query exacta (query='', depId=null, limit=5000) ──
  section('4. searchPaged exacto — articulos + LEFT JOIN departamentos (primeras 3 filas)');
  const SEL = `
    SELECT a.*,
      d.nombre AS departamento_nombre,
      d.color  AS departamento_color
    FROM articulos a
    LEFT JOIN departamentos d ON d.id = a.departamento_id
  `;
  try {
    const total = db.prepare('SELECT COUNT(*) AS c FROM articulos').get().c;
    const rows  = db.prepare(`${SEL} ORDER BY a.nombre LIMIT 3 OFFSET 0`).all();
    console.log(`   total=${total}  filas devueltas (limit 3)=${rows.length}`);
    rows.forEach(r => console.log(`   id=${r.id}  nombre="${r.nombre}"  dep_id=${r.departamento_id}  dep_nombre=${r.departamento_nombre}`));
    console.log('   → OK');
  } catch (err) {
    console.log(`   → FALLA: ${err.message}`);
  }

  // ── 5. FTS5 — articulos_fts ──────────────────────────────────
  section('5. articulos_fts integridad');
  try {
    const c = db.prepare("SELECT COUNT(*) AS c FROM articulos_fts").get().c;
    console.log(`   filas en articulos_fts: ${c}`);
    // integrity check del índice FTS
    db.prepare("INSERT INTO articulos_fts(articulos_fts) VALUES('integrity-check')");
    console.log('   → OK (no se ejecutó el check en modo readonly, pero preparó sin error)');
  } catch (err) {
    console.log(`   → FALLA / advertencia: ${err.message}`);
  }

  // ── 6. Índices de articulos ──────────────────────────────────
  section('6. Índices sobre tabla articulos');
  try {
    const idxs = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND tbl_name='articulos'").all();
    idxs.forEach(i => console.log(`   ${i.name}`));
    if (idxs.length === 0) console.log('   (sin índices definidos)');
    console.log('   → OK');
  } catch (err) {
    console.log(`   → FALLA: ${err.message}`);
  }

  // ── Resumen ──────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(' Pegá esta salida completa en el chat.');
  console.log('══════════════════════════════════════════════\n');

  db.close();
  app.quit();
});

function section(title) {
  console.log(`\n── ${title}`);
}

function run(db, sql, extract) {
  try {
    const rows = db.pragma(sql.replace(/^PRAGMA /, ''));
    rows.forEach(r => console.log(`   ${extract(r)}`));
    console.log('   → OK');
  } catch (err) {
    console.log(`   → FALLA: ${err.message}`);
  }
}

function runGet(db, sql, label) {
  try {
    const row = db.prepare(sql).get();
    console.log(`   ${label}: ${row.c} filas`);
  } catch (err) {
    console.log(`   ${label}: FALLA — ${err.message}`);
  }
}
