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

module.exports = { registrar, listarPorTurno };
