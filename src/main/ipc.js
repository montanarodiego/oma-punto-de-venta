const { ipcMain } = require('electron');
const Articulos    = require('./models/articulos');
const Transacciones = require('./models/transacciones');
const Clientes     = require('./models/clientes');
const Informes     = require('./models/informes');
const { getDb }    = require('./database');

function registerHandlers() {
  // ── Artículos ──────────────────────────────────────────────
  ipcMain.handle('articulos:getAll', () => Articulos.getAll());
  ipcMain.handle('articulos:getById', (_e, id) => Articulos.getById(id));
  ipcMain.handle('articulos:getByCodigo', (_e, codigo) => Articulos.getByCodigo(codigo));
  ipcMain.handle('articulos:create', (_e, data) => Articulos.create(data));
  ipcMain.handle('articulos:update', (_e, id, data) => Articulos.update(id, data));
  ipcMain.handle('articulos:delete', (_e, id) => Articulos.remove(id));
  ipcMain.handle('articulos:search', (_e, query) => Articulos.search(query));

  // ── Clientes ───────────────────────────────────────────────
  ipcMain.handle('clientes:getAll', () => Clientes.getAll());
  ipcMain.handle('clientes:getById', (_e, id) => Clientes.getById(id));
  ipcMain.handle('clientes:create', (_e, data) => Clientes.create(data));
  ipcMain.handle('clientes:update', (_e, id, data) => Clientes.update(id, data));
  ipcMain.handle('clientes:delete', (_e, id) => Clientes.remove(id));
  ipcMain.handle('clientes:search', (_e, query) => Clientes.search(query));
  ipcMain.handle('clientes:getTransacciones', (_e, id) => Clientes.getTransacciones(id));
  ipcMain.handle('clientes:registrarPago', (_e, id, monto) => Clientes.registrarPago(id, monto));

  // ── Transacciones ──────────────────────────────────────────
  ipcMain.handle('transacciones:getAll', () => Transacciones.getAll());
  ipcMain.handle('transacciones:getById', (_e, id) => Transacciones.getById(id));
  ipcMain.handle('transacciones:create', (_e, data) => Transacciones.create(data));
  ipcMain.handle('transacciones:getByFecha', (_e, desde, hasta) =>
    Transacciones.getByFecha(desde, hasta)
  );

  // ── Informes ───────────────────────────────────────────────
  ipcMain.handle('informes:ventasPorPeriodo',     (_e, d, h) => Informes.ventasPorPeriodo(d, h));
  ipcMain.handle('informes:articulosMasVendidos', (_e, d, h) => Informes.articulosMasVendidos(d, h));
  ipcMain.handle('informes:utilidadBruta',        (_e, d, h) => Informes.utilidadBruta(d, h));
  ipcMain.handle('informes:saldosClientes',       ()         => Informes.saldosClientes());

  // ── Sync ───────────────────────────────────────────────────
  ipcMain.handle('sync:contarPendientes', () => {
    const db = getDb();
    let total = 0;
    for (const tabla of ['articulos', 'clientes', 'transacciones']) {
      const row = db
        .prepare(`SELECT COUNT(*) as count FROM ${tabla} WHERE sync_status = 'pending'`)
        .get();
      total += row.count;
    }
    return total;
  });

  // ── Configuración ──────────────────────────────────────────
  ipcMain.handle('config:get', (_e, clave) => {
    const row = getDb().prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
    return row ? row.valor : null;
  });
  ipcMain.handle('config:getAll', () => {
    const rows = getDb().prepare('SELECT clave, valor FROM configuracion').all();
    return Object.fromEntries(rows.map(r => [r.clave, r.valor]));
  });
  ipcMain.handle('config:set', (_e, clave, valor) => {
    getDb()
      .prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)')
      .run(clave, String(valor));
    return true;
  });
}

module.exports = { registerHandlers };
