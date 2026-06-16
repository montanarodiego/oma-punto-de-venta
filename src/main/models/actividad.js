const { getDb } = require('../database');
const log       = require('electron-log');

// Acciones conocidas (claves estables; la UI mapea a etiquetas legibles).
// venta · anulacion · devolucion_parcial · movimiento_caja · cambio_precio ·
// turno_abierto · turno_cerrado · login

/**
 * Registra una entrada en el log de actividad. Es a prueba de fallos: si algo
 * sale mal acá NO debe interrumpir la operación real que la disparó (una venta
 * no puede fallar porque el log falló). Por eso se traga el error con un warn.
 */
function registrar({ usuario_id = null, usuario_nombre = null, accion, detalle = null } = {}) {
  if (!accion) return;
  try {
    getDb().prepare(`
      INSERT INTO actividad_log (usuario_id, usuario_nombre, accion, detalle)
      VALUES (?, ?, ?, ?)
    `).run(usuario_id ?? null, usuario_nombre ?? null, accion, detalle ?? null);
  } catch (err) {
    log.warn('[actividad] no se pudo registrar la acción:', accion, '-', err.message);
  }
}

/**
 * Lista el log de actividad con filtros opcionales.
 * @param {object}  filtros
 * @param {number}  filtros.limite   máximo de filas (default 300)
 * @param {string}  filtros.accion   filtra por tipo de acción exacta
 * @param {number}  filtros.usuarioId filtra por usuario
 * @param {string}  filtros.desde    fecha local 'YYYY-MM-DD' (inclusive)
 * @param {string}  filtros.hasta    fecha local 'YYYY-MM-DD' (inclusive)
 */
function listar({ limite = 300, accion = null, usuarioId = null, desde = null, hasta = null } = {}) {
  const conds  = [];
  const params = [];

  if (accion)    { conds.push('accion = ?');     params.push(accion); }
  if (usuarioId) { conds.push('usuario_id = ?'); params.push(usuarioId); }
  // created_at se guarda en UTC; convertimos a hora local (UTC-3) para filtrar por día,
  // igual que el resto de los reportes del sistema.
  if (desde)     { conds.push("date(datetime(created_at, '-3 hours')) >= ?"); params.push(desde); }
  if (hasta)     { conds.push("date(datetime(created_at, '-3 hours')) <= ?"); params.push(hasta); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const lim   = Math.max(1, Math.min(2000, Number(limite) || 300));

  return getDb().prepare(`
    SELECT id, usuario_id, usuario_nombre, accion, detalle, created_at
    FROM actividad_log
    ${where}
    ORDER BY id DESC
    LIMIT ?
  `).all(...params, lim);
}

module.exports = { registrar, listar };
