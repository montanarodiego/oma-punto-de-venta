const { ipcMain, shell } = require('electron');
const path           = require('path');
const Usuarios       = require('./models/usuarios');
const Articulos      = require('./models/articulos');
const Transacciones  = require('./models/transacciones');
const Clientes       = require('./models/clientes');
const Informes       = require('./models/informes');
const Proveedores    = require('./models/proveedores');
const Recepciones    = require('./models/recepciones');
const Turnos         = require('./models/turnos');
const MovimientosCaja = require('./models/movimientos_caja');
const Devoluciones   = require('./models/devoluciones');
const Departamentos  = require('./models/departamentos');
const Kits           = require('./models/kits');
const Inventario     = require('./models/inventario');
const PedidosCompra  = require('./models/pedidos');
const Backup         = require('./backup');
const { getDb }      = require('./database');

function registerHandlers() {
  // ── Usuarios ───────────────────────────────────────────────
  ipcMain.handle('usuarios:login', (_e, usuario, password) => {
    try {
      const user = Usuarios.login(usuario, password);
      return { ok: true, user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('usuarios:listar',       ()              => Usuarios.listar());
  ipcMain.handle('usuarios:crear',        (_e, data)      => Usuarios.crear(data));
  ipcMain.handle('usuarios:actualizar',   (_e, id, data)  => Usuarios.actualizar(id, data));
  ipcMain.handle('usuarios:toggleActivo', (_e, id)        => Usuarios.toggleActivo(id));

  // ── Departamentos ──────────────────────────────────────────
  ipcMain.handle('departamentos:getAll',   ()               => Departamentos.getAll());
  ipcMain.handle('departamentos:create',   (_e, data)       => Departamentos.create(data));
  ipcMain.handle('departamentos:update',   (_e, id, data)   => Departamentos.update(id, data));
  ipcMain.handle('departamentos:delete',   (_e, id)         => Departamentos.remove(id));

  // ── Kits ───────────────────────────────────────────────────
  ipcMain.handle('kits:getComponentes', (_e, kitId)          => Kits.getComponentes(kitId));
  ipcMain.handle('kits:setComponentes', (_e, kitId, comps)   => Kits.setComponentes(kitId, comps));

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
  ipcMain.handle('clientes:getTransacciones', (_e, id)             => Clientes.getTransacciones(id));
  ipcMain.handle('clientes:listarPagos',     (_e, id)             => Clientes.listarPagos(id));
  ipcMain.handle('clientes:cancelarPago',    (_e, pagoId)         => Clientes.cancelarPago(pagoId));
  ipcMain.handle('clientes:liquidarDeuda',   (_e, id, formaPago)  => Clientes.liquidarDeuda(id, formaPago));
  ipcMain.handle('clientes:registrarPago',   (_e, id, monto, fp)  => Clientes.registrarPago(id, monto, fp));

  // ── Transacciones ──────────────────────────────────────────
  ipcMain.handle('transacciones:getAll',      ()              => Transacciones.getAll());
  ipcMain.handle('transacciones:getById',     (_e, id)        => Transacciones.getById(id));
  ipcMain.handle('transacciones:create',      (_e, data)      => Transacciones.create(data));
  ipcMain.handle('transacciones:getByFecha',  (_e, desde, hasta) => Transacciones.getByFecha(desde, hasta));
  ipcMain.handle('transacciones:getRecientes',(_e, limite)    => Transacciones.getRecientes(limite));

  // ── Movimientos de caja ────────────────────────────────────
  ipcMain.handle('movimientos:registrar',     (_e, data)      => MovimientosCaja.registrar(data));
  ipcMain.handle('movimientos:listarPorTurno',(_e, turnoId)   => MovimientosCaja.listarPorTurno(turnoId));

  // ── Devoluciones ───────────────────────────────────────────
  ipcMain.handle('devoluciones:cancelar',     (_e, data)      => Devoluciones.cancelarTransaccion(data));
  ipcMain.handle('devoluciones:parcial',      (_e, data)      => Devoluciones.devolucionParcial(data));
  ipcMain.handle('devoluciones:getByTrans',   (_e, id)        => Devoluciones.getByTransaccion(id));
  ipcMain.handle('devoluciones:recientes',    (_e, limite)    => Devoluciones.getRecientes(limite));

  // ── Informes ───────────────────────────────────────────────
  ipcMain.handle('informes:ventasPorPeriodo',     (_e, d, h) => Informes.ventasPorPeriodo(d, h));
  ipcMain.handle('informes:articulosMasVendidos', (_e, d, h) => Informes.articulosMasVendidos(d, h));
  ipcMain.handle('informes:utilidadBruta',        (_e, d, h) => Informes.utilidadBruta(d, h));
  ipcMain.handle('informes:saldosClientes',       ()         => Informes.saldosClientes());
  ipcMain.handle('informes:ventasPorDia',         (_e, d, h) => Informes.ventasPorDia(d, h));
  ipcMain.handle('informes:ventasPorHora',        (_e, d)    => Informes.ventasPorHora(d));
  ipcMain.handle('informes:mejorDia',             (_e, d, h) => Informes.mejorDia(d, h));
  ipcMain.handle('informes:resumenRapido',        (_e, d, h) => Informes.resumenRapido(d, h));
  ipcMain.handle('informes:ventasPorCliente',     (_e, d, h) => Informes.ventasPorCliente(d, h));

  // ── Proveedores ────────────────────────────────────────────
  ipcMain.handle('proveedores:getAll',    ()           => Proveedores.getAll());
  ipcMain.handle('proveedores:getById',   (_e, id)     => Proveedores.getById(id));
  ipcMain.handle('proveedores:search',    (_e, q)      => Proveedores.search(q));
  ipcMain.handle('proveedores:create',    (_e, data)   => Proveedores.create(data));
  ipcMain.handle('proveedores:update',    (_e, id, data) => Proveedores.update(id, data));
  ipcMain.handle('proveedores:delete',    (_e, id)     => Proveedores.remove(id));
  ipcMain.handle('proveedores:articulosConStockBajo', () => Proveedores.articulosConStockBajo());

  // ── Pedidos ────────────────────────────────────────────────
  ipcMain.handle('pedidos:getAll',       ()                                => Proveedores.getPedidos());
  ipcMain.handle('pedidos:getById',      (_e, id)                          => Proveedores.getPedidoById(id));
  ipcMain.handle('pedidos:crear',        (_e, prvId, prvNombre, items)     => Proveedores.crearPedido(prvId, prvNombre, items));
  ipcMain.handle('pedidos:marcarRecibido', (_e, pedidoId, itemsRecibidos)  => Proveedores.marcarRecibido(pedidoId, itemsRecibidos));

  // ── Pedidos de compra (órdenes) ───────────────────────────────
  ipcMain.handle('pedidosCompra:listar',        ()                   => PedidosCompra.listar());
  ipcMain.handle('pedidosCompra:getById',       (_e, id)             => PedidosCompra.getById(id));
  ipcMain.handle('pedidosCompra:crear',         (_e, data)           => PedidosCompra.crear(data));
  ipcMain.handle('pedidosCompra:actualizar',    (_e, id, data)       => PedidosCompra.actualizar(id, data));
  ipcMain.handle('pedidosCompra:marcarEnviado', (_e, id)             => PedidosCompra.marcarEnviado(id));
  ipcMain.handle('pedidosCompra:recibir',       (_e, id, items)      => PedidosCompra.recibir(id, items));
  ipcMain.handle('pedidosCompra:cancelar',      (_e, id)             => PedidosCompra.cancelar(id));

  // ── Recepciones ────────────────────────────────────────────
  ipcMain.handle('recepciones:crear',   (_e, data) => Recepciones.crear(data));
  ipcMain.handle('recepciones:listar',  ()         => Recepciones.listar());
  ipcMain.handle('recepciones:getById', (_e, id)   => Recepciones.getById(id));

  // ── Turnos ─────────────────────────────────────────────────
  ipcMain.handle('turnos:obtenerActivo',    ()                           => Turnos.obtenerActivo());
  ipcMain.handle('turnos:abrir',            (_e, efectivoInicial)        => Turnos.abrir(efectivoInicial));
  ipcMain.handle('turnos:calcularResumen',  (_e, id)                     => Turnos.calcularResumen(id));
  ipcMain.handle('turnos:cerrar',           (_e, id, efectivoReal, notas) => Turnos.cerrar(id, efectivoReal, notas));
  ipcMain.handle('turnos:historial',        (_e, limite)                 => Turnos.historial(limite));
  ipcMain.handle('turnos:detalle',          (_e, id)                     => Turnos.detalle(id));

  // ── Inventario ─────────────────────────────────────────────
  ipcMain.handle('inventario:ajustar',          (_e, data)    => Inventario.ajustar(data));
  ipcMain.handle('inventario:listarMovimientos',(_e, filtros) => Inventario.listarMovimientos(filtros));
  ipcMain.handle('inventario:kardex',           (_e, artId)   => Inventario.kardex(artId));
  ipcMain.handle('inventario:stockBajo',        ()            => Inventario.stockBajo());

  // ── Backup ─────────────────────────────────────────────────
  ipcMain.handle('backup:hacerAhora', () => {
    try { return { ok: true, ruta: Backup.hacerBackup() }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('backup:listar',       () => Backup.listarBackups());
  ipcMain.handle('backup:getRuta',      () => Backup.getBackupDir());
  ipcMain.handle('backup:abrirCarpeta', () => { shell.openPath(Backup.getBackupDir()); return true; });

  // ── Navegación ─────────────────────────────────────────────
  ipcMain.handle('navegar', (e, file) => {
    const win = e.sender.getOwnerBrowserWindow();
    if (win) win.loadFile(path.join(__dirname, '..', 'renderer', 'views', file));
  });

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
