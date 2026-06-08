/**
 * seed-perf.js — inserta datos de prueba para medir performance
 *
 * Uso: node scripts/seed-perf.js
 *
 * Inserta:
 *  - 5.000 artículos
 *  - 2.000 clientes
 *  -   200 proveedores
 *
 * Idempotente: si ya existe el marcador, no vuelve a insertar.
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const os      = require('os');

// Ubicación de la DB (misma que usa Electron en dev/prod)
const APP_DATA = process.env.APPDATA
  || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir());
const DB_PATH = path.join(APP_DATA, 'oma-punto-de-venta', 'oma-pos.db');

if (!fs.existsSync(DB_PATH)) {
  // Intento alternativo: directorio userData de desarrollo
  const altPath = path.join(APP_DATA, 'Electron', 'oma-pos.db');
  if (fs.existsSync(altPath)) {
    console.log('Usando DB de Electron dev:', altPath);
    main(altPath);
  } else {
    console.error('No se encontró la DB. Ejecutá la app al menos una vez antes del seed.');
    console.error('Rutas buscadas:\n  ' + DB_PATH + '\n  ' + altPath);
    process.exit(1);
  }
} else {
  main(DB_PATH);
}

function main(dbPath) {
  console.log('DB:', dbPath);
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  const MARKER = 'seed_perf_v1';
  const alreadySeeded = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(MARKER);
  if (alreadySeeded) {
    console.log('Ya se ejecutó el seed. Para re-seed, eliminá la fila clave=' + MARKER + ' de configuracion.');
    db.close();
    return;
  }

  console.time('seed');

  const CATEGORIAS = ['Bebidas', 'Snacks', 'Lácteos', 'Limpieza', 'Almacén', 'Frescos', 'Electrónica', 'Librería', 'Perfumería', 'Medicamentos'];
  const UNIDADES   = ['unidad', 'kg', 'litro', 'g', 'ml'];
  const IVA        = ['21', '10.5', '0'];

  // Asegurar departamentos
  const depsExistentes = db.prepare('SELECT id FROM departamentos').all().map(r => r.id);
  const insertDep = db.prepare("INSERT OR IGNORE INTO departamentos (nombre, color) VALUES (?, ?)");
  const COLORS = ['#4f8ef5','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
  for (let i = 0; i < CATEGORIAS.length; i++) {
    insertDep.run(CATEGORIAS[i], COLORS[i]);
  }
  const depIds = db.prepare('SELECT id FROM departamentos').all().map(r => r.id);

  // 200 proveedores
  console.log('Insertando 200 proveedores...');
  const insertProv = db.prepare(
    "INSERT OR IGNORE INTO proveedores (nombre, telefono, email, sync_status, updated_at) VALUES (?, ?, ?, 'synced', datetime('now'))"
  );
  const insertProvTx = db.transaction(() => {
    for (let i = 1; i <= 200; i++) {
      insertProv.run(`Proveedor Perf ${i.toString().padStart(3,'0')}`, `011-4${i.toString().padStart(7,'0')}`, `proveedor${i}@perf.test`);
    }
  });
  insertProvTx();

  const provIds = db.prepare('SELECT id FROM proveedores').all().map(r => r.id);

  // 5.000 artículos
  console.log('Insertando 5.000 artículos...');
  const insertArt = db.prepare(`
    INSERT OR IGNORE INTO articulos
      (codigo, nombre, costo_unitario, precio_unitario, precio_mayoreo, stock_actual, stock_minimo,
       unidad_medida, tasa_iva, departamento_id, usa_inventario, sync_status, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced', datetime('now'))
  `);

  const PREFIJOS = ['Coca Cola', 'Pepsi', 'Sprite', 'Fanta', 'Agua', 'Leche', 'Yogur', 'Queso', 'Manteca',
                    'Jabón', 'Shampoo', 'Detergente', 'Lavandina', 'Arroz', 'Fideos', 'Aceite', 'Azúcar',
                    'Sal', 'Harina', 'Pan', 'Galletitas', 'Alfajor', 'Chocolate', 'Caramelos', 'Chicles'];
  const SUFIJOS = ['500ml', '1L', '2L', '250g', '500g', '1kg', 'x6', 'x12', 'chico', 'grande', 'mediano', 'litro', 'sachet', 'pack'];

  const insertArtTx = db.transaction(() => {
    for (let i = 1; i <= 5000; i++) {
      const prefijo = PREFIJOS[i % PREFIJOS.length];
      const sufijo  = SUFIJOS[Math.floor(i / PREFIJOS.length) % SUFIJOS.length];
      const codigo  = `PERF${i.toString().padStart(6,'0')}`;
      const nombre  = `${prefijo} ${sufijo} #${i}`;
      const costo   = Math.round(Math.random() * 900 + 100);
      const precio  = Math.round(costo * (1.2 + Math.random() * 0.5));
      const mayoreo = Math.round(precio * 0.9);
      const stock   = Math.floor(Math.random() * 200);
      const minimo  = Math.floor(Math.random() * 20);
      const um      = UNIDADES[i % UNIDADES.length];
      const iva     = IVA[i % IVA.length];
      const depId   = depIds[i % depIds.length];
      insertArt.run(codigo, nombre, costo, precio, mayoreo, stock, minimo, um, iva, depId);
    }
  });
  insertArtTx();

  // 2.000 clientes
  console.log('Insertando 2.000 clientes...');
  const insertCli = db.prepare(`
    INSERT OR IGNORE INTO clientes
      (nombre, telefono, direccion, limite_credito, saldo_vencido, sync_status, updated_at)
    VALUES
      (?, ?, ?, ?, 0, 'synced', datetime('now'))
  `);
  const APELLIDOS = ['García','González','Rodríguez','López','Martínez','Pérez','Sánchez','Ramírez','Torres','Flores'];
  const NOMBRES_P = ['Juan','María','Carlos','Ana','Luis','Laura','Diego','Sandra','Pablo','Sofía'];

  const insertCliTx = db.transaction(() => {
    for (let i = 1; i <= 2000; i++) {
      const apellido = APELLIDOS[i % APELLIDOS.length];
      const nombre   = NOMBRES_P[Math.floor(i / APELLIDOS.length) % NOMBRES_P.length];
      const limite   = Math.floor(Math.random() * 3) === 0 ? Math.round(Math.random() * 50000 + 5000) : 0;
      insertCli.run(
        `${nombre} ${apellido} ${i}`,
        `011-${(4000000 + i).toString()}`,
        `Calle Falsa ${i}, CABA`,
        limite,
      );
    }
  });
  insertCliTx();

  // Marcar como ejecutado
  db.prepare("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, datetime('now'))").run(MARKER);

  console.timeEnd('seed');
  const artCount = db.prepare('SELECT COUNT(*) as c FROM articulos').get().c;
  const cliCount = db.prepare('SELECT COUNT(*) as c FROM clientes').get().c;
  const prvCount = db.prepare('SELECT COUNT(*) as c FROM proveedores').get().c;
  console.log(`✓ Artículos: ${artCount} | Clientes: ${cliCount} | Proveedores: ${prvCount}`);
  db.close();
}
