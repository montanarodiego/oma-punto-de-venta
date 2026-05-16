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

  // Schema base (fresh installs) — ya con las columnas nuevas
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
      unidad_medida   TEXT NOT NULL DEFAULT 'unidad',
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
      articulo_id        INTEGER REFERENCES articulos(id),
      descripcion_libre  TEXT,
      cantidad           REAL NOT NULL,
      precio_al_momento  REAL NOT NULL,
      importe_total      REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );

    CREATE TABLE IF NOT EXISTS turnos (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_apertura           TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_cierre             TEXT,
      efectivo_inicial         REAL DEFAULT 0,
      efectivo_esperado        REAL,
      efectivo_real            REAL,
      diferencia               REAL,
      total_ventas             REAL,
      total_transacciones      INTEGER,
      ventas_efectivo          REAL,
      ventas_debito            REAL,
      ventas_credito           REAL,
      ventas_transferencia     REAL,
      ventas_cuenta_corriente  REAL,
      notas                    TEXT,
      estado                   TEXT DEFAULT 'abierto'
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT NOT NULL,
      telefono    TEXT,
      email       TEXT,
      direccion   TEXT,
      notas       TEXT,
      sync_status TEXT DEFAULT 'pending',
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pedidos_proveedor (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id     INTEGER REFERENCES proveedores(id),
      proveedor_nombre TEXT,
      fecha            TEXT DEFAULT (date('now')),
      estado           TEXT DEFAULT 'pendiente',
      notas            TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pedidos_proveedor_detalle (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id         INTEGER NOT NULL REFERENCES pedidos_proveedor(id),
      articulo_id       INTEGER REFERENCES articulos(id),
      cantidad_sugerida REAL DEFAULT 0,
      cantidad_pedida   REAL DEFAULT 0,
      costo_unitario    REAL DEFAULT 0,
      recibido          REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recepciones (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id        INTEGER REFERENCES pedidos_proveedor(id),
      proveedor_id     INTEGER REFERENCES proveedores(id),
      proveedor_nombre TEXT,
      fecha            TEXT NOT NULL DEFAULT (date('now')),
      notas            TEXT,
      total_costo      REAL DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recepciones_detalle (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      recepcion_id      INTEGER NOT NULL REFERENCES recepciones(id),
      articulo_id       INTEGER REFERENCES articulos(id),
      descripcion       TEXT,
      cantidad_recibida REAL NOT NULL DEFAULT 0,
      costo_unitario    REAL DEFAULT 0,
      importe_total     REAL DEFAULT 0
    );

    INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
      ('nombre_negocio',     'Mi Negocio'),
      ('direccion',          ''),
      ('telefono',           ''),
      ('cuit',               ''),
      ('moneda',             '$'),
      ('tasa_iva',           '21'),
      ('impuesto_porcentaje','21'),
      ('sync_enabled',       'false');
  `);

  // Migraciones para bases existentes
  runMigrations(db);

  return db;
}

function runMigrations(db) {
  // ── Feature: unidad_medida en articulos ───────────────────────
  {
    const cols = db.prepare('PRAGMA table_info(articulos)').all();
    if (!cols.some(c => c.name === 'unidad_medida')) {
      db.exec("ALTER TABLE articulos ADD COLUMN unidad_medida TEXT NOT NULL DEFAULT 'unidad'");
    }
  }

  // ── Feature: articulo_id nullable + descripcion_libre en detalle_transaccion
  // SQLite no soporta ALTER COLUMN, así que si articulo_id es NOT NULL hay que recrear la tabla
  {
    const cols    = db.prepare('PRAGMA table_info(detalle_transaccion)').all();
    const artCol  = cols.find(c => c.name === 'articulo_id');
    const hasLibre = cols.some(c => c.name === 'descripcion_libre');

    if (artCol && artCol.notnull === 1) {
      // Recrear tabla sin la restricción NOT NULL y con la columna nueva
      db.pragma('foreign_keys = OFF');
      try {
        db.exec(`
          CREATE TABLE detalle_transaccion_v2 (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            transaccion_id    INTEGER NOT NULL REFERENCES transacciones(id),
            articulo_id       INTEGER REFERENCES articulos(id),
            descripcion_libre TEXT,
            cantidad          REAL NOT NULL,
            precio_al_momento REAL NOT NULL,
            importe_total     REAL NOT NULL
          );
          INSERT INTO detalle_transaccion_v2
            SELECT id, transaccion_id, articulo_id, NULL, cantidad, precio_al_momento, importe_total
            FROM detalle_transaccion;
          DROP TABLE detalle_transaccion;
          ALTER TABLE detalle_transaccion_v2 RENAME TO detalle_transaccion;
        `);
      } finally {
        db.pragma('foreign_keys = ON');
      }
    } else if (!hasLibre) {
      db.exec('ALTER TABLE detalle_transaccion ADD COLUMN descripcion_libre TEXT');
    }
  }
}

module.exports = { initDatabase, getDb };
