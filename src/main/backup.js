const fs   = require('fs');
const path = require('path');
const { app } = require('electron');
const { getDb } = require('./database');

function getBackupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function hacerBackup() {
  const db  = getDb();
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db.pragma('wal_checkpoint(FULL)');

  const ahora   = new Date().toISOString().replace(/[T:]/g, '-').replace(/\..+/, '').substring(0, 19);
  const destino = path.join(dir, `oma-pos-${ahora}.db`);
  const origen  = path.join(app.getPath('userData'), 'oma-pos.db');

  fs.copyFileSync(origen, destino);

  // Conservar sólo los últimos 30 backups
  const archivos = fs.readdirSync(dir)
    .filter(f => f.startsWith('oma-pos-') && f.endsWith('.db'))
    .sort();
  if (archivos.length > 30) {
    archivos.slice(0, archivos.length - 30).forEach(f => {
      try { fs.unlinkSync(path.join(dir, f)); } catch { /* continúa */ }
    });
  }

  return destino;
}

function listarBackups() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.startsWith('oma-pos-') && f.endsWith('.db'))
    .map(f => {
      const ruta = path.join(dir, f);
      const stat = fs.statSync(ruta);
      return { nombre: f, ruta, tamanio: stat.size, fecha: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function restaurarBackup(rutaArchivo) {
  const dbPath = path.join(app.getPath('userData'), 'oma-pos.db');

  if (!fs.existsSync(rutaArchivo)) {
    throw new Error('El archivo de backup no existe: ' + rutaArchivo);
  }

  // Salvar el estado actual antes de pisarlo
  try { hacerBackup(); } catch { /* si falla el pre-backup, continuar igual */ }

  // Cerrar la conexión activa para poder reemplazar el archivo
  try { getDb().close(); } catch { /* continúa */ }

  fs.copyFileSync(rutaArchivo, dbPath);

  // Reiniciar la app: la nueva instancia inicializará la DB restaurada
  app.relaunch();
  app.exit(0);
}

module.exports = { hacerBackup, listarBackups, getBackupDir, restaurarBackup };
