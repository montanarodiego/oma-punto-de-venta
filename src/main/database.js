const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function getDb() {
  if (!db) throw new Error('La base de datos no fue inicializada');
  return db;
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'oma-pos.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS articulos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo          TEXT UNIQUE NOT NULL,
      nombre          TEXT NOT NULL,
      descripcion     TEXT,
      costo_unitario  REAL NOT NULL DEFAULT 0,
      precio_unitario REAL NOT NULL DEFAULT 0,
      stock_actual    REAL NOT NULL DEFAULT 0,
      stock_minimo    REAL NOT NULL DEFAULT 0,
      proveedor       TEXT,
      sync_status     TEXT NOT NULL DEFAULT 'pending',
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre          TEXT NOT NULL,
      telefono        TEXT,
      direccion       TEXT,
      limite_credito  REAL NOT NULL DEFAULT 0,
      saldo_vencido   REAL NOT NULL DEFAULT 0,
      sync_status     TEXT NOT NULL DEFAULT 'pending',
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transacciones (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      monto_total        REAL NOT NULL DEFAULT 0,
      subtotal           REAL NOT NULL DEFAULT 0,
      monto_impuesto     REAL NOT NULL DEFAULT 0,
      forma_pago         TEXT NOT NULL DEFAULT 'efectivo',
      cuenta_cliente_id  INTEGER REFERENCES clientes(id),
      sync_status        TEXT NOT NULL DEFAULT 'pending',
      created_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS detalle_transaccion (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      transaccion_id     INTEGER NOT NULL REFERENCES transacciones(id),
      articulo_id        INTEGER NOT NULL REFERENCES articulos(id),
      cantidad           REAL NOT NULL,
      precio_al_momento  REAL NOT NULL,
      importe_total      REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );

    INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
      ('nombre_negocio', 'Mi Negocio'),
      ('moneda', 'ARS'),
      ('impuesto_porcentaje', '21'),
      ('sync_enabled', 'false');
  `);

  return db;
}

module.exports = { initDatabase, getDb };
