'use strict';

/**
 * Script de recuperación de base de datos corrupta.
 *
 * Ejecutar con:
 *   npx electron src/main/scripts/recover-db.js
 *
 * NUNCA toca el archivo original. Trabaja siempre sobre copias.
 * Lee database.js para reutilizar el schema exacto (applySchemaTo).
 */

const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { applySchemaTo } = require('../database');

// Tablas en orden de dependencias FK.
// Con foreign_keys=OFF durante la copia el orden no es estrictamente necesario,
// pero lo dejamos correcto para que sea evidente la relación entre tablas.
const TABLES = [
  'departamentos',
  'usuarios',
  'configuracion',
  'proveedores',
  'clientes',
  'turnos',
  'articulos',
  'kits_componentes',
  'precio_historial',
  'promociones',
  'transacciones',
  'detalle_transaccion',
  'devoluciones',
  'devoluciones_detalle',
  'movimientos_caja',
  'movimientos_inventario',
  'pedidos_proveedor',
  'pedidos_proveedor_detalle',
  'recepciones',
  'recepciones_detalle',
  'pedidos_compra',
  'pedidos_compra_items',
  'pagos_clientes',
  'password_reset_tokens',
];

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  try {
    await recoverDatabase();
  } catch (err) {
    console.error('\n[FATAL]', err.message);
    console.error(err.stack);
  } finally {
    app.quit();
  }
});

// ── Main ────────────────────────────────────────────────────────────

async function recoverDatabase() {
  const userData = app.getPath('userData');
  const srcPath  = path.join(userData, 'oma-pos.db');
  const copySrc  = path.join(userData, 'oma-pos.recover-src.db');
  const recPath  = path.join(userData, 'oma-pos.recovered.db');

  printBox('OmaTech POS — Database Recovery Script');
  console.log(`userData: ${userData}\n`);

  // ── Paso 1: copiar original (nunca se toca) ──────────────────────
  section('1. Localizando y copiando base original');

  if (!fs.existsSync(srcPath)) {
    console.error(`[ERROR] No se encontró: ${srcPath}`);
    return;
  }

  fs.copyFileSync(srcPath, copySrc);
  console.log(`   original : ${srcPath}   ← NO TOCADO`);
  console.log(`   copia    : ${copySrc}`);

  // Copiar WAL y SHM si existen para no perder transacciones sin checkpoint
  for (const ext of ['-wal', '-shm']) {
    const src = srcPath + ext;
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, copySrc + ext);
      console.log(`   copiado  : ${path.basename(src)}`);
    }
  }

  // ── Paso 2: integrity_check sobre la copia ───────────────────────
  section('2. PRAGMA integrity_check sobre la copia');

  let srcDb;
  try {
    srcDb = new Database(copySrc);
  } catch (err) {
    console.error(`[ERROR] No se pudo abrir la copia: ${err.message}`);
    return;
  }

  const ic1 = integrityCheck(srcDb);
  const ic1ok = ic1.length === 1 && ic1[0] === 'ok';
  console.log(ic1ok ? '\n   ✓ Integridad OK (datos íntegros; puede ser solo índices).'
                    : '\n   ✗ Se encontraron problemas.');

  // ── Paso 3: REINDEX ──────────────────────────────────────────────
  section('3. REINDEX');

  let reindexOk = false;
  try {
    srcDb.exec('REINDEX');
    console.log('   REINDEX completado.\n');
    const ic2 = integrityCheck(srcDb);
    reindexOk = ic2.length === 1 && ic2[0] === 'ok';
  } catch (err) {
    console.log(`   REINDEX falló: ${err.message}`);
  }

  if (reindexOk) {
    srcDb.close();
    console.log('\n   ✓ REINDEX resolvió el problema. La copia es íntegra.');
    printResult('REINDEX exitoso', copySrc, srcPath);
    return;
  }

  console.log('\n   REINDEX no alcanzó. Procediendo a copia fila por fila...');

  // ── Paso 4: copia fila por fila ──────────────────────────────────
  section('4. Creando base limpia y copiando datos fila por fila');

  if (fs.existsSync(recPath)) fs.unlinkSync(recPath);

  let destDb;
  try {
    destDb = new Database(recPath);
    applySchemaTo(destDb);     // mismo schema que initDatabase(), sin duplicar código
    console.log('   Schema aplicado.\n');
  } catch (err) {
    console.error(`[ERROR] No se pudo crear la base limpia: ${err.message}`);
    srcDb.close();
    return;
  }

  // FK off durante la copia para no depender del orden y aceptar filas con refs rotas
  destDb.pragma('foreign_keys = OFF');

  let totalOk = 0;
  let totalErr = 0;

  for (const table of TABLES) {
    const exists = srcDb.prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`
    ).get(table);

    if (!exists) {
      console.log(`   ${pad(table)} — no existe en la fuente, skip`);
      continue;
    }

    let rows;
    try {
      rows = srcDb.prepare(`SELECT * FROM "${table}"`).all();
    } catch (err) {
      console.log(`   ${pad(table)} — ERROR leyendo: ${err.message}`);
      continue;
    }

    if (rows.length === 0) {
      console.log(`   ${pad(table)} — (vacía)`);
      continue;
    }

    const cols  = Object.keys(rows[0]);
    const ph    = cols.map(() => '?').join(', ');
    const colsQ = cols.map(c => `"${c}"`).join(', ');
    const stmt  = destDb.prepare(
      `INSERT OR REPLACE INTO "${table}" (${colsQ}) VALUES (${ph})`
    );

    // Transacción por tabla para que una fila rota no aborte las demás
    const copyBatch = destDb.transaction((rows) => {
      let ok = 0, err = 0;
      for (const row of rows) {
        try {
          stmt.run(Object.values(row));
          ok++;
        } catch (e) {
          err++;
          if (err <= 5) console.log(`      fila id=${row.id ?? '?'}: ${e.message}`);
          if (err === 6) console.log(`      ... (más errores omitidos)`);
        }
      }
      return { ok, err };
    });

    const { ok, err } = copyBatch(rows);
    totalOk  += ok;
    totalErr += err;
    const badge = err > 0 ? `  ← ${err} fallidas` : '';
    console.log(`   ${pad(table)} — ${ok} filas copiadas${badge}`);
  }

  // Reconstruir FTS5 (los triggers ya lo alimentaron al insertar en articulos,
  // pero el 'rebuild' garantiza consistencia si hubo errores de copia)
  console.log('\n   Reconstruyendo índice FTS (articulos_fts)...');
  try {
    destDb.exec(`INSERT INTO articulos_fts(articulos_fts) VALUES ('rebuild')`);
    console.log('   FTS reconstruido.');
  } catch (err) {
    console.log(`   FTS rebuild: ${err.message}  (no crítico)`);
  }

  // Resincronizar sqlite_sequence para que los AUTOINCREMENT sigan desde el max id real
  try {
    const seqs = destDb.prepare(`SELECT name FROM sqlite_sequence`).all();
    for (const { name } of seqs) {
      try {
        const { m } = destDb.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM "${name}"`).get();
        destDb.prepare(`UPDATE sqlite_sequence SET seq=? WHERE name=?`).run(m, name);
      } catch { /* tabla sin columna id, ignorar */ }
    }
    console.log('   sqlite_sequence sincronizado.');
  } catch (err) {
    console.log(`   sqlite_sequence sync: ${err.message}  (no crítico)`);
  }

  destDb.pragma('foreign_keys = ON');

  // ── Paso 5: integrity_check final ────────────────────────────────
  section('5. PRAGMA integrity_check — resultado final');

  const icFinal = integrityCheck(destDb);
  const finalOk = icFinal.length === 1 && icFinal[0] === 'ok';

  srcDb.close();
  destDb.close();

  console.log(`\n   Filas copiadas : ${totalOk}`);
  console.log(`   Filas fallidas : ${totalErr}`);
  console.log(`   integrity_check: ${finalOk ? '✓ ok' : '✗ PROBLEMAS — revisá los errores arriba'}`);

  if (finalOk) {
    printResult('COPIA FILA-A-FILA exitosa', recPath, srcPath);
  } else {
    printBox('RESULTADO: ✗ La base recuperada aún tiene problemas.');
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function integrityCheck(db) {
  try {
    const rows = db.pragma('integrity_check');
    const lines = rows.map(r => r.integrity_check);
    lines.forEach(l => console.log(`   ${l}`));
    return lines;
  } catch (err) {
    console.log(`   integrity_check error: ${err.message}`);
    return [err.message];
  }
}

function pad(s) {
  return s.padEnd(34);
}

function section(title) {
  const bar = '─'.repeat(Math.max(0, 52 - title.length - 4));
  console.log(`\n── ${title} ${bar}`);
}

function printBox(title) {
  const w = Math.max(title.length + 4, 54);
  const bar = '═'.repeat(w);
  console.log(bar);
  console.log(` ${title}`);
  console.log(bar);
}

function printResult(method, cleanPath, origPath) {
  console.log('\n' + '═'.repeat(54));
  console.log(` RESULTADO: ✓ ${method}`);
  console.log('═'.repeat(54));
  console.log(` Archivo sano: ${cleanPath}`);
  console.log('');
  console.log(' Para restaurar (hacelo con la app cerrada):');
  console.log(`   1. Renombrá  oma-pos.db          →  oma-pos.db.bak`);
  console.log(`   2. Renombrá  ${path.basename(cleanPath).padEnd(22)} →  oma-pos.db`);
  console.log(`   3. Abrí la app y verificá`);
  console.log('═'.repeat(54) + '\n');
  console.log(`Directorio: ${path.dirname(origPath)}`);
}
