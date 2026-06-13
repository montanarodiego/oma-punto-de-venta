// ──────────────────────────────────────────────────────────────────────
// recover-db.js — Reparación de la DB de OmaTech POS
// Causa: índice FTS5 (articulos_fts) corrupto → SQLITE_CORRUPT_VTAB al guardar.
// La tabla `articulos` está sana, así que se reconstruye el índice sin pérdida.
//
// CORRÉ ESTO CON LA APP CERRADA:
//   npx electron src/main/scripts/recover-db.js
// ──────────────────────────────────────────────────────────────────────
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ── Ruta REAL de la DB ────────────────────────────────────────────────
// La app arranca con `electron .` y usa el name del package.json
// ("oma-punto-de-venta"), por eso su userData es %APPDATA%\oma-punto-de-venta\.
// NO usamos app.getPath('userData'): corriendo el script suelto, Electron
// devuelve %APPDATA%\Electron\ (otra DB, vacía) — ese fue el error anterior.
const APP_DIR = path.join(process.env.APPDATA, 'oma-punto-de-venta');
const dbPath  = path.join(APP_DIR, 'oma-pos.db');

console.log('\n════════════════════════════════════════════');
console.log(' Reparación DB — OmaTech POS');
console.log('════════════════════════════════════════════');
console.log('Archivo objetivo:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('\n❌ No existe esa DB. ¿Está cerrada la app? ¿La ruta es otra?');
  console.error('   Carpetas con "oma" en %APPDATA%:');
  try {
    fs.readdirSync(process.env.APPDATA)
      .filter(d => /oma/i.test(d))
      .forEach(d => console.error('   -', d));
  } catch {}
  process.exit(1);
}

console.log('Tamaño:', (fs.statSync(dbPath).size / 1024 / 1024).toFixed(2), 'MB');

// ── Backup de seguridad antes de tocar nada ───────────────────────────
const stamp = new Date().toISOString().replace(/[T:]/g, '-').replace(/\..+/, '');
const backupPath = path.join(APP_DIR, `oma-pos.PRE-REPAIR-${stamp}.db`);
fs.copyFileSync(dbPath, backupPath);
console.log('Backup de seguridad:', backupPath);

let db;
try {
  db = new Database(dbPath);

  const integrityOk = (label) => {
    const result = db.prepare('PRAGMA integrity_check').all()
      .map(r => r.integrity_check).join(' | ');
    console.log(`\n[${label}] integrity_check: ${result}`);
    return result === 'ok';
  };

  integrityOk('ANTES');

  // ── Fix principal: rebuild del índice FTS5 (contenido externo) ───────
  console.log('\n→ Reconstruyendo índice FTS5 (articulos_fts) con rebuild...');
  let fixed = false;
  try {
    db.exec(`INSERT INTO articulos_fts(articulos_fts) VALUES('rebuild')`);
    console.log('  ✓ rebuild OK');
    fixed = true;
  } catch (e) {
    console.log('  ✗ rebuild falló:', e.message);
  }

  // ── Fallback: recrear la tabla FTS desde cero (DDL exacto del schema) ─
  if (!fixed) {
    console.log('\n→ Fallback: recreando articulos_fts desde la tabla articulos...');
    db.exec(`DROP TABLE IF EXISTS articulos_fts`);
    db.exec(`
      CREATE VIRTUAL TABLE articulos_fts USING fts5(
        nombre,
        codigo,
        content=articulos,
        content_rowid=id,
        tokenize='unicode61'
      );
    `);
    db.exec(`INSERT INTO articulos_fts(rowid, nombre, codigo)
             SELECT id, nombre, codigo FROM articulos`);
    console.log('  ✓ articulos_fts recreada y repoblada');
  }

  // ── REINDEX general por las dudas + checkpoint del WAL ───────────────
  console.log('\n→ REINDEX general...');
  db.exec('REINDEX');
  db.pragma('wal_checkpoint(TRUNCATE)');

  const ok = integrityOk('DESPUÉS');
  db.close();

  console.log('\n════════════════════════════════════════════');
  if (ok) {
    console.log('✅ DB SANA. Abrí la app y probá guardar un artículo.');
    console.log('   Si guarda bien, borrá el backup:');
    console.log('   ' + backupPath);
  } else {
    console.log('⚠️  Todavía hay problemas. NO borres el backup.');
    console.log('   Pasame el integrity_check de arriba.');
  }
  console.log('════════════════════════════════════════════\n');
} catch (e) {
  console.error('\n❌ Error:', e.message);
  console.error('   (Si dice "database is locked" → la app sigue abierta, cerrala.)');
  console.error('   Tu backup de seguridad está intacto en:', backupPath);
  if (db) { try { db.close(); } catch {} }
}

process.exit(0);