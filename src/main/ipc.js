const { ipcMain, shell, dialog, BrowserWindow, app, safeStorage } = require('electron');
const path           = require('path');
const fs             = require('fs');
const os             = require('os');
const { version }    = require('../../package.json');
const { enviarReporte, enviarCodigoReset } = require('./mailer');
const PasswordReset  = require('./models/password-reset');
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
const Promociones    = require('./models/promociones');
const Backup         = require('./backup');
const Printer        = require('./printer');
const ReportMailer   = require('./report-mailer');
const { getDb }      = require('./database');

// Rol del usuario activo — se actualiza en login y en cada carga de página
let currentUserRole = null;

function onlyAdmin() {
  if (currentUserRole !== 'admin') throw new Error('Acción restringida a administradores');
}

// ── Exportación de órdenes de compra ──────────────────────────
function generarHTMLOrden(orden, cfg, proveedorData) {
  const fmtNum = (n) => {
    const num = parseFloat(n) || 0;
    return num % 1 === 0 ? String(num) : num.toFixed(3).replace(/\.?0+$/, '');
  };

  const esc = (str) => String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const ESTADO_LABEL = { borrador: 'Borrador', enviado: 'Enviado', recibido: 'Recibido', cancelado: 'Cancelado' };
  const ESTADO_CLS   = { borrador: 'estado-borrador', enviado: 'estado-enviado', recibido: 'estado-recibido', cancelado: 'estado-cancelado' };

  const fecha = (orden.fecha_creacion || '').slice(0, 10) || '—';

  const itemRows = (orden.items || []).map(it => {
    const desc = it.articulo_nombre || it.descripcion_libre || '—';
    const um   = it.unidad_medida ? ` ${esc(it.unidad_medida)}` : '';
    return `
      <tr>
        <td>${esc(desc)}</td>
        <td class="center">${esc(fmtNum(it.cantidad_pedida) + um)}</td>
      </tr>`;
  }).join('');

  const contactoProveedor = proveedorData
    ? [proveedorData.telefono, proveedorData.email].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ') || '—'
    : '—';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#111; background:#fff; padding:30px 36px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2.5px solid #2563eb; padding-bottom:14px; margin-bottom:22px; }
    .brand { color:#2563eb; font-size:24px; font-weight:800; letter-spacing:-0.5px; }
    .brand-sub { font-size:10px; color:#6b7280; margin-top:2px; }
    .biz { text-align:right; font-size:11px; color:#4b5563; line-height:1.7; }
    .biz-name { font-size:14px; font-weight:700; color:#111; }
    .doc-title { font-size:20px; font-weight:800; color:#1e3a8a; letter-spacing:-0.5px; margin-bottom:18px; }
    .meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:22px; }
    .meta-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:9px 13px; }
    .meta-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; margin-bottom:3px; }
    .meta-val { font-size:13px; font-weight:600; color:#111; }
    table { width:100%; border-collapse:collapse; }
    thead th { background:#1e3a8a; color:#fff; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; padding:9px 10px; text-align:left; }
    tbody td { padding:7px 10px; border-bottom:1px solid #e2e8f0; font-size:12px; vertical-align:middle; }
    tbody tr:nth-child(even) td { background:#f8fafc; }
    td.center { text-align:center; }
    td.right  { text-align:right; }
    th.center { text-align:center; }
    th.right  { text-align:right; }
    .notes { margin-top:16px; padding:10px 14px; background:#fefce8; border:1px solid #fde047; border-radius:5px; }
    .notes-lbl { font-size:11px; font-weight:700; color:#a16207; margin-bottom:3px; }
    .notes-txt { font-size:12px; color:#78350f; }
    .footer { margin-top:30px; border-top:1px solid #e2e8f0; padding-top:9px; text-align:center; font-size:10px; color:#94a3b8; }
    .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:700; }
    .estado-borrador { background:#fef3c7; color:#d97706; }
    .estado-enviado  { background:#dbeafe; color:#2563eb; }
    .estado-recibido { background:#dcfce7; color:#16a34a; }
    .estado-cancelado{ background:#f1f5f9; color:#64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">OmaTech</div>
      <div class="brand-sub">Sistema de Punto de Venta</div>
    </div>
    <div class="biz">
      <div class="biz-name">${esc(cfg.nombreNegocio)}</div>
      ${cfg.direccion ? `<div>${esc(cfg.direccion)}</div>` : ''}
      ${cfg.telefono  ? `<div>Tel: ${esc(cfg.telefono)}</div>` : ''}
      ${cfg.cuit      ? `<div>CUIT: ${esc(cfg.cuit)}</div>` : ''}
    </div>
  </div>

  <div class="doc-title">ORDEN DE COMPRA #${orden.id}</div>

  <div class="meta">
    <div class="meta-box">
      <div class="meta-lbl">Fecha de creación</div>
      <div class="meta-val">${esc(fecha)}</div>
    </div>
    <div class="meta-box">
      <div class="meta-lbl">Estado</div>
      <div class="meta-val">
        <span class="badge ${ESTADO_CLS[orden.estado] || 'estado-cancelado'}">${esc(ESTADO_LABEL[orden.estado] || orden.estado)}</span>
      </div>
    </div>
    <div class="meta-box">
      <div class="meta-lbl">Proveedor</div>
      <div class="meta-val">${esc(orden.proveedor_label || '—')}</div>
    </div>
    <div class="meta-box">
      <div class="meta-lbl">Contacto proveedor</div>
      <div class="meta-val" style="font-size:12px;">${contactoProveedor}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th class="center">Cant. pedida</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  ${orden.notas ? `<div class="notes"><div class="notes-lbl">Notas:</div><div class="notes-txt">${esc(orden.notas)}</div></div>` : ''}

  <div class="footer">Generado por OmaTech POS &nbsp;•&nbsp; ${esc(new Date().toLocaleString('es-AR'))}</div>
</body>
</html>`;
}

async function exportarOrdenPDF(e, id) {
  const db    = getDb();
  const orden = PedidosCompra.getById(id);
  if (!orden) return { ok: false, error: 'Orden no encontrada' };

  const getCfg = (clave, def = '') => {
    const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
    return (row && row.valor) ? row.valor : def;
  };

  const cfg = {
    nombreNegocio: getCfg('nombre_negocio', 'Mi Negocio'),
    direccion:     getCfg('direccion'),
    telefono:      getCfg('telefono'),
    cuit:          getCfg('cuit'),
  };

  const proveedorData = orden.proveedor_id
    ? db.prepare('SELECT telefono, email FROM proveedores WHERE id = ?').get(orden.proveedor_id)
    : null;

  const html    = generarHTMLOrden(orden, cfg, proveedorData);
  const tmpFile = path.join(os.tmpdir(), `orden-compra-${id}-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');

  let win;
  try {
    win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    await win.loadFile(tmpFile);

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape:       false,
      paperWidth:      8.27,
      paperHeight:     11.69,
      marginTop:       0,
      marginBottom:    0,
      marginLeft:      0,
      marginRight:     0,
    });

    const ownerWin = e.sender.getOwnerBrowserWindow();
    const result   = await dialog.showSaveDialog(ownerWin, {
      title:       `Guardar Orden de Compra #${id}`,
      defaultPath: path.join(app.getPath('downloads'), `orden-compra-${id}.pdf`),
      filters:     [{ name: 'Documento PDF', extensions: ['pdf'] }],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, pdfBuffer);
      return { ok: true, filePath: result.filePath };
    }
    return { ok: false, canceled: true };

  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    try { if (win && !win.isDestroyed()) win.destroy(); } catch {}
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

async function exportarOrdenCSV(e, id) {
  const orden = PedidosCompra.getById(id);
  if (!orden) return { ok: false, error: 'Orden no encontrada' };

  const fecha = (orden.fecha_creacion || '').slice(0, 10) || new Date().toISOString().slice(0, 10);

  const csvEsc = (v) => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = [
    ['codigo', 'descripcion', 'cantidad_pedida', 'cantidad_recibida', 'costo_unitario', 'importe_total'],
    ...(orden.items || []).map(it => [
      it.articulo_codigo || '',
      it.articulo_nombre || it.descripcion_libre || '',
      it.cantidad_pedida ?? 0,
      (it.cantidad_recibida !== null && it.cantidad_recibida !== undefined) ? it.cantidad_recibida : '',
      it.costo_unitario ?? 0,
      ((parseFloat(it.cantidad_pedida) || 0) * (parseFloat(it.costo_unitario) || 0)).toFixed(2),
    ]),
  ];

  const csvContent = '﻿' + rows.map(row => row.map(csvEsc).join(',')).join('\r\n');

  try {
    const ownerWin = e.sender.getOwnerBrowserWindow();
    const result   = await dialog.showSaveDialog(ownerWin, {
      title:       `Guardar CSV — Orden de Compra #${id}`,
      defaultPath: path.join(app.getPath('downloads'), `orden-compra-${id}-${fecha}.csv`),
      filters:     [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, csvContent, 'utf8');
      return { ok: true, filePath: result.filePath };
    }
    return { ok: false, canceled: true };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function registerHandlers() {
  // ── Sesión (renderer sincroniza rol en cada carga de página) ──
  ipcMain.handle('auth:setSession', (_e, session) => {
    currentUserRole = session?.rol ?? null;
  });

  // ── Usuarios ───────────────────────────────────────────────
  // ── Recuperación de contraseña ────────────────────────────────
  ipcMain.handle('auth:solicitarReset', async (_e, email) => {
    try {
      const usuario = PasswordReset.buscarPorEmail(email);
      if (usuario && usuario.email) {
        const codigo = PasswordReset.crearToken(usuario.id);
        await enviarCodigoReset({ email: usuario.email, nombre: usuario.nombre, codigo });
      }
      // Siempre devuelve ok: true para no revelar si el email existe
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('auth:verificarCodigo', (_e, email, codigo) => {
    try {
      return { ok: PasswordReset.verificarToken(email, codigo) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('auth:resetearPassword', (_e, email, codigo, nuevaPassword) => {
    try {
      const ok = PasswordReset.consumirToken(email, codigo, nuevaPassword);
      return { ok };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('usuarios:hayUsuarios', () => {
    const n = getDb().prepare('SELECT COUNT(*) as n FROM usuarios WHERE activo = 1').get().n;
    return n > 0;
  });

  ipcMain.handle('usuarios:login', (_e, usuario, password) => {
    try {
      const user = Usuarios.login(usuario, password);
      currentUserRole = user.rol;
      return { ok: true, user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('usuarios:listar',       ()              => Usuarios.listar());
  ipcMain.handle('usuarios:crear', (_e, data) => {
    const sinUsuarios = getDb().prepare('SELECT COUNT(*) as n FROM usuarios WHERE activo = 1').get().n === 0;
    if (!sinUsuarios) onlyAdmin();
    return Usuarios.crear(data);
  });
  ipcMain.handle('usuarios:actualizar',   (_e, id, data)  => { onlyAdmin(); return Usuarios.actualizar(id, data); });
  ipcMain.handle('usuarios:toggleActivo', (_e, id)        => { onlyAdmin(); return Usuarios.toggleActivo(id); });

  // ── Departamentos ──────────────────────────────────────────
  ipcMain.handle('departamentos:getAll',   ()               => Departamentos.getAll());
  ipcMain.handle('departamentos:create',   (_e, data)       => { onlyAdmin(); return Departamentos.create(data); });
  ipcMain.handle('departamentos:update',   (_e, id, data)   => { onlyAdmin(); return Departamentos.update(id, data); });
  ipcMain.handle('departamentos:delete',   (_e, id)         => { onlyAdmin(); return Departamentos.remove(id); });

  // ── Kits ───────────────────────────────────────────────────
  ipcMain.handle('kits:getComponentes', (_e, kitId)          => Kits.getComponentes(kitId));
  ipcMain.handle('kits:setComponentes', (_e, kitId, comps)   => { onlyAdmin(); return Kits.setComponentes(kitId, comps); });

  // ── Artículos ──────────────────────────────────────────────
  ipcMain.handle('articulos:getAll', () => Articulos.getAll());
  ipcMain.handle('articulos:getById', (_e, id) => Articulos.getById(id));
  ipcMain.handle('articulos:getByCodigo', (_e, codigo) => Articulos.getByCodigo(codigo));
  ipcMain.handle('articulos:create', (_e, data) => { onlyAdmin(); return Articulos.create(data); });
  ipcMain.handle('articulos:update', (_e, id, data) => { onlyAdmin(); return Articulos.update(id, data); });
  ipcMain.handle('articulos:delete', (_e, id) => { onlyAdmin(); return Articulos.remove(id); });
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
  ipcMain.handle('transacciones:getAll',      ()                  => Transacciones.getAll());
  ipcMain.handle('transacciones:getById',     (_e, id)            => Transacciones.getById(id));
  ipcMain.handle('transacciones:create',      (_e, data)          => Transacciones.create(data));
  ipcMain.handle('transacciones:getByFecha',  (_e, desde, hasta)  => Transacciones.getByFecha(desde, hasta));
  ipcMain.handle('transacciones:getRecientes',(_e, limite)        => Transacciones.getRecientes(limite));
  ipcMain.handle('transacciones:getUltima',   (_e, turnoId)       => Transacciones.getUltima(turnoId));

  // ── Movimientos de caja ────────────────────────────────────
  ipcMain.handle('movimientos:registrar',     (_e, data)         => MovimientosCaja.registrar(data));
  ipcMain.handle('movimientos:listarPorTurno',(_e, turnoId)      => MovimientosCaja.listarPorTurno(turnoId));
  ipcMain.handle('movimientos:cancelar',      (_e, id, motivo)   => MovimientosCaja.cancelar(id, motivo));

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
  ipcMain.handle('informes:ventasPorMes',         (_e, d, h) => Informes.ventasPorMes(d, h));
  ipcMain.handle('informes:ventasPorDepartamento',(_e, d, h) => Informes.ventasPorDepartamento(d, h));
  ipcMain.handle('informes:ventasPorHoraRango',   (_e, d, h) => Informes.ventasPorHoraRango(d, h));

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
  ipcMain.handle('pedidos:crear',        (_e, prvId, prvNombre, items)     => { onlyAdmin(); return Proveedores.crearPedido(prvId, prvNombre, items); });
  ipcMain.handle('pedidos:marcarRecibido', (_e, pedidoId, itemsRecibidos)  => { onlyAdmin(); return Proveedores.marcarRecibido(pedidoId, itemsRecibidos); });

  // ── Promociones por volumen ───────────────────────────────────
  ipcMain.handle('promociones:listarPorArticulo', (_e, articuloId) => Promociones.listarPorArticulo(articuloId));
  ipcMain.handle('promociones:listarActivas',     (_e, ids)        => Promociones.listarActivasPorArticulos(ids));
  ipcMain.handle('promociones:listarTodas',       ()               => Promociones.listarTodas());
  ipcMain.handle('promociones:crear',             (_e, data)       => { onlyAdmin(); return Promociones.crear(data); });
  ipcMain.handle('promociones:eliminar',          (_e, id)         => { onlyAdmin(); return Promociones.eliminar(id); });

  // ── Pedidos de compra (órdenes) ───────────────────────────────
  ipcMain.handle('pedidosCompra:listar',        ()                   => PedidosCompra.listar());
  ipcMain.handle('pedidosCompra:getById',       (_e, id)             => PedidosCompra.getById(id));
  ipcMain.handle('pedidosCompra:crear',         (_e, data)           => { onlyAdmin(); return PedidosCompra.crear(data); });
  ipcMain.handle('pedidosCompra:actualizar',    (_e, id, data)       => { onlyAdmin(); return PedidosCompra.actualizar(id, data); });
  ipcMain.handle('pedidosCompra:marcarEnviado', (_e, id)             => { onlyAdmin(); return PedidosCompra.marcarEnviado(id); });
  ipcMain.handle('pedidosCompra:recibir',       (_e, id, items)      => { onlyAdmin(); return PedidosCompra.recibir(id, items); });
  ipcMain.handle('pedidosCompra:cancelar',      (_e, id)             => { onlyAdmin(); return PedidosCompra.cancelar(id); });
  ipcMain.handle('pedidosCompra:exportarPDF',   (e, id)              => exportarOrdenPDF(e, id));
  ipcMain.handle('pedidosCompra:exportarCSV',   (e, id)              => exportarOrdenCSV(e, id));

  // ── Recepciones ────────────────────────────────────────────
  ipcMain.handle('recepciones:crear',   (_e, data) => { onlyAdmin(); return Recepciones.crear(data); });
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
  ipcMain.handle('inventario:ajustar',          (_e, data)    => { onlyAdmin(); return Inventario.ajustar(data); });
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

  // ── Soporte / Reportar problema ───────────────────────────────
  ipcMain.handle('soporte:enviarReporte', async (_e, datos) => {
    try {
      const db = getDb();
      const row = db.prepare("SELECT valor FROM configuracion WHERE clave = 'nombre_negocio'").get();
      const negocio = row ? row.valor : null;
      await enviarReporte({ ...datos, version, negocio });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
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

  // ── Impresora térmica ──────────────────────────────────────────
  ipcMain.handle('printer:listarImpresoras', async () => {
    try { return await Printer.listarImpresoras(); }
    catch { return []; }
  });

  ipcMain.handle('printer:imprimir', async (_e, transaccionId, extra) => {
    try {
      const db = getDb();
      const nombreImpresora = db
        .prepare("SELECT valor FROM configuracion WHERE clave = 'impresora_nombre'")
        .get()?.valor;
      if (!nombreImpresora) return { ok: false, noImpresora: true };

      const getCfg = (k, def = '') =>
        db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(k)?.valor ?? def;

      const cfg = {
        nombreNegocio: getCfg('nombre_negocio', 'MI NEGOCIO'),
        direccion:     getCfg('direccion'),
        telefono:      getCfg('telefono'),
        cuit:          getCfg('cuit'),
        moneda:        getCfg('moneda', '$'),
        mensajeTicket: getCfg('mensaje_ticket'),
      };

      const trans = Transacciones.getById(transaccionId);
      if (!trans) return { ok: false, error: 'Transacción no encontrada' };
      trans._montoRecibido = extra?.montoRecibido ?? null;
      trans._vuelto        = extra?.vuelto        ?? 0;

      const buf = Printer.buildTicketBuffer(trans, cfg);
      return await Printer.enviarRaw(nombreImpresora, buf);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('printer:imprimirPrueba', async (_e, nombreImpresora) => {
    try {
      const db = getDb();
      const getCfg = (k, def = '') =>
        db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(k)?.valor ?? def;
      const cfg = { nombreNegocio: getCfg('nombre_negocio', 'OmaTech POS') };
      const buf = Printer.buildPruebaBuffer(cfg);
      return await Printer.enviarRaw(nombreImpresora, buf);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('printer:imprimirCorteZ', async (_e, turnoId) => {
    try {
      const db = getDb();
      const nombreImpresora = db
        .prepare("SELECT valor FROM configuracion WHERE clave = 'impresora_nombre'")
        .get()?.valor;
      if (!nombreImpresora) return { ok: false, noImpresora: true };

      const getCfg = (k, def = '') =>
        db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(k)?.valor ?? def;

      const cfg = {
        nombreNegocio: getCfg('nombre_negocio', 'MI NEGOCIO'),
        direccion:     getCfg('direccion'),
        telefono:      getCfg('telefono'),
        cuit:          getCfg('cuit'),
        moneda:        getCfg('moneda', '$'),
      };

      const resumen = Turnos.calcularResumen(turnoId);
      const buf = Printer.buildCorteZBuffer(resumen, cfg);
      return await Printer.enviarRaw(nombreImpresora, buf);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Reporte automático por email ───────────────────────────────
  ipcMain.handle('reporteEmail:getConfig', () => {
    const db  = getDb();
    const get = k => db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(k)?.valor ?? '';
    return {
      activo:     get('reporte_email_activo')     || '0',
      destino:    get('reporte_email_destino'),
      frecuencia: get('reporte_email_frecuencia') || 'diario',
      hora:       get('reporte_email_hora')       || '08:00',
      diaSemana:  get('reporte_email_dia_semana') || '1',
      diaMes:     get('reporte_email_dia_mes')    || '1',
      ultimoEnvio:get('reporte_email_ultimo_envio'),
    };
  });

  ipcMain.handle('reporteEmail:setConfig', (_e, data) => {
    const db  = getDb();
    const set = (k, v) =>
      db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)').run(k, String(v ?? ''));
    if ('activo'    in data) set('reporte_email_activo',     data.activo);
    if ('destino'   in data) set('reporte_email_destino',    data.destino);
    if ('frecuencia'in data) set('reporte_email_frecuencia', data.frecuencia);
    if ('hora'      in data) set('reporte_email_hora',       data.hora);
    if ('diaSemana' in data) set('reporte_email_dia_semana', data.diaSemana);
    if ('diaMes'    in data) set('reporte_email_dia_mes',    data.diaMes);
    return true;
  });

  ipcMain.handle('reporteEmail:enviarPrueba', async (_e, emailDestino, frecuencia) => {
    try {
      await ReportMailer.generarYEnviarReporte(emailDestino, frecuencia || 'diario', getDb());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerHandlers };
