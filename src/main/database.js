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
    CREATE TABLE IF NOT EXISTS departamentos (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      color  TEXT NOT NULL DEFAULT '#6b7280'
    );

    CREATE TABLE IF NOT EXISTS articulos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo          TEXT UNIQUE NOT NULL,
      nombre          TEXT NOT NULL,
      descripcion     TEXT,
      costo_unitario  REAL NOT NULL DEFAULT 0,
      precio_unitario REAL NOT NULL DEFAULT 0,
      precio_mayoreo  REAL NOT NULL DEFAULT 0,
      stock_actual    REAL NOT NULL DEFAULT 0,
      stock_minimo    REAL NOT NULL DEFAULT 0,
      proveedor       TEXT,
      unidad_medida   TEXT NOT NULL DEFAULT 'unidad',
      tasa_iva        TEXT NOT NULL DEFAULT '21',
      departamento_id INTEGER REFERENCES departamentos(id),
      es_kit          INTEGER NOT NULL DEFAULT 0,
      usa_inventario  INTEGER NOT NULL DEFAULT 1,
      sync_status     TEXT NOT NULL DEFAULT 'pending',
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kits_componentes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_id        INTEGER NOT NULL REFERENCES articulos(id),
      componente_id INTEGER NOT NULL REFERENCES articulos(id),
      cantidad      REAL NOT NULL DEFAULT 1,
      UNIQUE(kit_id, componente_id)
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
      descuento_global   REAL NOT NULL DEFAULT 0,
      notas              TEXT,
      estado             TEXT NOT NULL DEFAULT 'vigente',
      motivo_cancelacion TEXT,
      turno_id           INTEGER REFERENCES turnos(id),
      forma_pago         TEXT NOT NULL DEFAULT 'efectivo',
      forma_pago_2       TEXT,
      monto_pago_2       REAL,
      cuenta_cliente_id  INTEGER REFERENCES clientes(id),
      sync_status        TEXT NOT NULL DEFAULT 'pending',
      created_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS detalle_transaccion (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      transaccion_id       INTEGER NOT NULL REFERENCES transacciones(id),
      articulo_id          INTEGER REFERENCES articulos(id),
      descripcion_libre    TEXT,
      cantidad             REAL NOT NULL,
      precio_al_momento    REAL NOT NULL,
      descuento_porcentaje REAL NOT NULL DEFAULT 0,
      importe_total        REAL NOT NULL
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

    CREATE TABLE IF NOT EXISTS movimientos_caja (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      turno_id         INTEGER REFERENCES turnos(id),
      tipo             TEXT NOT NULL CHECK(tipo IN ('entrada','salida')),
      monto            REAL NOT NULL,
      descripcion      TEXT NOT NULL,
      cancelado        INTEGER NOT NULL DEFAULT 0,
      cancelado_motivo TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devoluciones (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      transaccion_id  INTEGER NOT NULL REFERENCES transacciones(id),
      turno_id        INTEGER REFERENCES turnos(id),
      motivo          TEXT NOT NULL,
      monto_devuelto  REAL NOT NULL DEFAULT 0,
      tipo            TEXT NOT NULL DEFAULT 'parcial',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devoluciones_detalle (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      devolucion_id   INTEGER NOT NULL REFERENCES devoluciones(id),
      detalle_id      INTEGER REFERENCES detalle_transaccion(id),
      articulo_id     INTEGER REFERENCES articulos(id),
      descripcion     TEXT,
      cantidad        REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      importe         REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      articulo_id         INTEGER NOT NULL REFERENCES articulos(id),
      tipo                TEXT NOT NULL,
      cantidad_anterior   REAL NOT NULL DEFAULT 0,
      cantidad_cambio     REAL NOT NULL DEFAULT 0,
      cantidad_resultante REAL NOT NULL DEFAULT 0,
      costo_unitario      REAL DEFAULT 0,
      precio_unitario     REAL DEFAULT 0,
      motivo              TEXT,
      usuario             TEXT,
      referencia_id       INTEGER,
      fecha               TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
      ('nombre_negocio',     'Mi Negocio'),
      ('direccion',          ''),
      ('telefono',           ''),
      ('cuit',               ''),
      ('moneda',             '$'),
      ('tasa_iva',           '21'),
      ('impuesto_porcentaje','21'),
      ('sync_enabled',       'false'),
      ('modo_negocio',       ''),
      ('tamano_hud',         'normal'),
      ('mensaje_ticket',     '');
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

  // ── Feature: tasa_iva por artículo ────────────────────────────
  {
    const cols = db.prepare('PRAGMA table_info(articulos)').all();
    if (!cols.some(c => c.name === 'tasa_iva')) {
      db.exec("ALTER TABLE articulos ADD COLUMN tasa_iva TEXT NOT NULL DEFAULT '21'");
    }
  }

  // ── Feature: modo_negocio en configuracion ────────────────────
  {
    try {
      db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('modo_negocio', '')").run();
    } catch { /* tabla puede no existir aún en flujos muy viejos */ }
  }

  // ── Feature: tamano_hud en configuracion ──────────────────────
  {
    try {
      db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('tamano_hud', 'normal')").run();
    } catch { /* tabla puede no existir aún en flujos muy viejos */ }
  }

  // ── Feature: mensaje_ticket en configuracion ──────────────────
  {
    try {
      db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('mensaje_ticket', '')").run();
    } catch { /* tabla puede no existir aún en flujos muy viejos */ }
  }

  // ── Feature: precio_mayoreo en articulos ─────────────────────
  {
    const cols = db.prepare('PRAGMA table_info(articulos)').all();
    if (!cols.some(c => c.name === 'precio_mayoreo')) {
      db.exec('ALTER TABLE articulos ADD COLUMN precio_mayoreo REAL NOT NULL DEFAULT 0');
    }
  }

  // ── Feature: campos nuevos en transacciones ───────────────────
  {
    const cols = db.prepare('PRAGMA table_info(transacciones)').all();
    const names = new Set(cols.map(c => c.name));
    if (!names.has('descuento_global'))   db.exec('ALTER TABLE transacciones ADD COLUMN descuento_global REAL NOT NULL DEFAULT 0');
    if (!names.has('notas'))              db.exec('ALTER TABLE transacciones ADD COLUMN notas TEXT');
    if (!names.has('estado'))             db.exec("ALTER TABLE transacciones ADD COLUMN estado TEXT NOT NULL DEFAULT 'vigente'");
    if (!names.has('motivo_cancelacion')) db.exec('ALTER TABLE transacciones ADD COLUMN motivo_cancelacion TEXT');
    if (!names.has('turno_id'))           db.exec('ALTER TABLE transacciones ADD COLUMN turno_id INTEGER');
  }

  // ── Feature: descuento_porcentaje en detalle_transaccion ─────
  {
    const cols = db.prepare('PRAGMA table_info(detalle_transaccion)').all();
    if (!cols.some(c => c.name === 'descuento_porcentaje')) {
      db.exec('ALTER TABLE detalle_transaccion ADD COLUMN descuento_porcentaje REAL NOT NULL DEFAULT 0');
    }
  }

  // ── Feature: movimientos_caja table ──────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS movimientos_caja (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      turno_id         INTEGER REFERENCES turnos(id),
      tipo             TEXT NOT NULL CHECK(tipo IN ('entrada','salida')),
      monto            REAL NOT NULL,
      descripcion      TEXT NOT NULL,
      cancelado        INTEGER NOT NULL DEFAULT 0,
      cancelado_motivo TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Feature: cancelar movimientos de caja ─────────────────────
  {
    const cols  = db.prepare('PRAGMA table_info(movimientos_caja)').all();
    const names = new Set(cols.map(c => c.name));
    if (!names.has('cancelado'))        db.exec('ALTER TABLE movimientos_caja ADD COLUMN cancelado INTEGER NOT NULL DEFAULT 0');
    if (!names.has('cancelado_motivo')) db.exec('ALTER TABLE movimientos_caja ADD COLUMN cancelado_motivo TEXT');
  }

  // ── Feature: devoluciones tables ─────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS devoluciones (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      transaccion_id  INTEGER NOT NULL REFERENCES transacciones(id),
      turno_id        INTEGER REFERENCES turnos(id),
      motivo          TEXT NOT NULL,
      monto_devuelto  REAL NOT NULL DEFAULT 0,
      tipo            TEXT NOT NULL DEFAULT 'parcial',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS devoluciones_detalle (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      devolucion_id   INTEGER NOT NULL REFERENCES devoluciones(id),
      detalle_id      INTEGER REFERENCES detalle_transaccion(id),
      articulo_id     INTEGER REFERENCES articulos(id),
      descripcion     TEXT,
      cantidad        REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      importe         REAL NOT NULL
    )
  `);

  // ── Module 2: departamentos ───────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS departamentos (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      color  TEXT NOT NULL DEFAULT '#6b7280'
    )
  `);

  // ── Module 2: articulos — nuevas columnas ─────────────────────
  {
    const cols = db.prepare('PRAGMA table_info(articulos)').all();
    const names = new Set(cols.map(c => c.name));
    if (!names.has('departamento_id')) db.exec('ALTER TABLE articulos ADD COLUMN departamento_id INTEGER');
    if (!names.has('es_kit'))          db.exec("ALTER TABLE articulos ADD COLUMN es_kit INTEGER NOT NULL DEFAULT 0");
    if (!names.has('usa_inventario'))  db.exec("ALTER TABLE articulos ADD COLUMN usa_inventario INTEGER NOT NULL DEFAULT 1");
  }

  // ── Module 2: kits_componentes ────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS kits_componentes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_id        INTEGER NOT NULL REFERENCES articulos(id),
      componente_id INTEGER NOT NULL REFERENCES articulos(id),
      cantidad      REAL NOT NULL DEFAULT 1,
      UNIQUE(kit_id, componente_id)
    )
  `);

  // ── Module 3: movimientos_inventario ─────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      articulo_id         INTEGER NOT NULL REFERENCES articulos(id),
      tipo                TEXT NOT NULL,
      cantidad_anterior   REAL NOT NULL DEFAULT 0,
      cantidad_cambio     REAL NOT NULL DEFAULT 0,
      cantidad_resultante REAL NOT NULL DEFAULT 0,
      costo_unitario      REAL DEFAULT 0,
      precio_unitario     REAL DEFAULT 0,
      motivo              TEXT,
      usuario             TEXT,
      referencia_id       INTEGER,
      fecha               TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Feature: usuarios (autenticación local) ──────────────────
  {
    db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre        TEXT NOT NULL,
        usuario       TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        rol           TEXT NOT NULL DEFAULT 'cajero' CHECK(rol IN ('admin','cajero')),
        activo        INTEGER NOT NULL DEFAULT 1
      )
    `);
    const count = db.prepare('SELECT COUNT(*) as n FROM usuarios').get().n;
    if (count === 0) {
      const bcrypt = require('bcryptjs');
      const hash   = bcrypt.hashSync('1234', 10);
      db.prepare(
        "INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES ('Administrador', 'admin', ?, 'admin')"
      ).run(hash);
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

  // ── Feature: pagos_clientes (historial de abonos) ─────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS pagos_clientes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id   INTEGER NOT NULL REFERENCES clientes(id),
      monto        REAL    NOT NULL,
      tipo         TEXT    NOT NULL DEFAULT 'abono' CHECK(tipo IN ('abono','dev_abono')),
      forma_pago   TEXT    NOT NULL DEFAULT 'efectivo',
      estado       TEXT    NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo','cancelado')),
      pago_orig_id INTEGER REFERENCES pagos_clientes(id),
      notas        TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Feature: propina en transacciones ────────────────────────
  {
    const cols = db.prepare('PRAGMA table_info(transacciones)').all();
    if (!cols.some(c => c.name === 'propina')) {
      db.exec('ALTER TABLE transacciones ADD COLUMN propina REAL NOT NULL DEFAULT 0');
    }
  }

  // ── Feature: pago mixto en transacciones ─────────────────────
  {
    const cols  = db.prepare('PRAGMA table_info(transacciones)').all();
    const names = new Set(cols.map(c => c.name));
    if (!names.has('forma_pago_2')) db.exec('ALTER TABLE transacciones ADD COLUMN forma_pago_2 TEXT');
    if (!names.has('monto_pago_2')) db.exec('ALTER TABLE transacciones ADD COLUMN monto_pago_2 REAL');
  }

  // ── Feature: promociones por volumen ─────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS promociones (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      articulo_id        INTEGER NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
      nombre             TEXT    NOT NULL DEFAULT '',
      cantidad_desde     REAL    NOT NULL DEFAULT 1,
      cantidad_hasta     REAL,
      precio_promocional REAL    NOT NULL,
      activa             INTEGER NOT NULL DEFAULT 1
    )
  `);

  // ── Feature: pedidos_compra (órdenes de compra a proveedores) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos_compra (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id     INTEGER REFERENCES proveedores(id),
      proveedor_nombre TEXT,
      estado           TEXT NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador','enviado','recibido','cancelado')),
      notas            TEXT,
      usuario_id       INTEGER REFERENCES usuarios(id),
      fecha_creacion   TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_envio      TEXT,
      fecha_recepcion  TEXT
    );
    CREATE TABLE IF NOT EXISTS pedidos_compra_items (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id         INTEGER NOT NULL REFERENCES pedidos_compra(id),
      articulo_id       INTEGER REFERENCES articulos(id),
      descripcion_libre TEXT,
      cantidad_pedida   REAL NOT NULL DEFAULT 0,
      cantidad_recibida REAL DEFAULT 0,
      costo_unitario    REAL DEFAULT 0
    )
  `);

  // ── Feature: email en usuarios (para recuperación de contraseña) ─
  {
    const cols = db.prepare('PRAGMA table_info(usuarios)').all();
    if (!cols.some(c => c.name === 'email')) {
      db.exec('ALTER TABLE usuarios ADD COLUMN email TEXT');
    }
  }

  // ── Feature: tokens de recuperación de contraseña ─────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      codigo     TEXT    NOT NULL,
      expires_at INTEGER NOT NULL,
      usado      INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Índices para performance ──────────────────────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articulos_codigo      ON articulos(codigo);
    CREATE INDEX IF NOT EXISTS idx_articulos_sync        ON articulos(sync_status);
    CREATE INDEX IF NOT EXISTS idx_transacciones_created ON transacciones(created_at);
    CREATE INDEX IF NOT EXISTS idx_transacciones_estado  ON transacciones(estado);
    CREATE INDEX IF NOT EXISTS idx_transacciones_turno   ON transacciones(turno_id);
    CREATE INDEX IF NOT EXISTS idx_transacciones_cliente ON transacciones(cuenta_cliente_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_transaccion   ON detalle_transaccion(transaccion_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_articulo      ON detalle_transaccion(articulo_id);
    CREATE INDEX IF NOT EXISTS idx_mov_inv_articulo      ON movimientos_inventario(articulo_id);
    CREATE INDEX IF NOT EXISTS idx_mov_inv_fecha         ON movimientos_inventario(fecha);
    CREATE INDEX IF NOT EXISTS idx_mov_caja_turno        ON movimientos_caja(turno_id);
    CREATE INDEX IF NOT EXISTS idx_turnos_estado         ON turnos(estado);
    CREATE INDEX IF NOT EXISTS idx_pagos_cliente         ON pagos_clientes(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_promociones_articulo  ON promociones(articulo_id);
  `);
}

module.exports = { initDatabase, getDb };
