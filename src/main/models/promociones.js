const { getDb } = require('../database');

function listarPorArticulo(articuloId) {
  return getDb()
    .prepare('SELECT * FROM promociones WHERE articulo_id = ? ORDER BY cantidad_desde ASC')
    .all(articuloId);
}

function listarActivasPorArticulos(articuloIds) {
  if (!articuloIds || articuloIds.length === 0) return [];
  const placeholders = articuloIds.map(() => '?').join(',');
  return getDb()
    .prepare(`SELECT * FROM promociones WHERE activa = 1 AND articulo_id IN (${placeholders})`)
    .all(...articuloIds);
}

function crear(data) {
  const { articulo_id, nombre, cantidad_desde, cantidad_hasta, precio_promocional } = data;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO promociones (articulo_id, nombre, cantidad_desde, cantidad_hasta, precio_promocional)
    VALUES (?, ?, ?, ?, ?)
  `).run(articulo_id, nombre || '', cantidad_desde, cantidad_hasta ?? null, precio_promocional);
  return db.prepare('SELECT * FROM promociones WHERE id = ?').get(result.lastInsertRowid);
}

function eliminar(id) {
  getDb().prepare('DELETE FROM promociones WHERE id = ?').run(id);
  return true;
}

module.exports = { listarPorArticulo, listarActivasPorArticulos, crear, eliminar };
