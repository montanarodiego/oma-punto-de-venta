const { getDb } = require('../database');

function registrar({ turnoId, tipo, monto, descripcion }) {
  const db   = getDb();
  const info = db.prepare(`
    INSERT INTO movimientos_caja (turno_id, tipo, monto, descripcion)
    VALUES (?, ?, ?, ?)
  `).run(turnoId, tipo, monto, descripcion);
  return db.prepare('SELECT * FROM movimientos_caja WHERE id = ?').get(info.lastInsertRowid);
}

function listarPorTurno(turnoId) {
  return getDb()
    .prepare('SELECT * FROM movimientos_caja WHERE turno_id = ? ORDER BY created_at DESC')
    .all(turnoId);
}

function cancelar(id, motivo) {
  if (!motivo || !String(motivo).trim()) throw new Error('El motivo es obligatorio para cancelar un movimiento.');
  const db  = getDb();
  const mov = db.prepare('SELECT * FROM movimientos_caja WHERE id = ?').get(id);
  if (!mov) throw new Error('Movimiento no encontrado.');
  if (mov.cancelado) throw new Error('Este movimiento ya está cancelado.');
  db.prepare('UPDATE movimientos_caja SET cancelado = 1, cancelado_motivo = ? WHERE id = ?')
    .run(String(motivo).trim(), id);
  return db.prepare('SELECT * FROM movimientos_caja WHERE id = ?').get(id);
}

module.exports = { registrar, listarPorTurno, cancelar };
