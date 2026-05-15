const { getDb } = require('../database');

function getAll() {
  return getDb().prepare('SELECT * FROM articulos ORDER BY nombre').all();
}

function getById(id) {
  return getDb().prepare('SELECT * FROM articulos WHERE id = ?').get(id);
}

function getByCodigo(codigo) {
  return getDb().prepare('SELECT * FROM articulos WHERE codigo = ?').get(codigo);
}

function search(query) {
  const like = `%${query}%`;
  return getDb()
    .prepare('SELECT * FROM articulos WHERE nombre LIKE ? OR codigo LIKE ? ORDER BY nombre')
    .all(like, like);
}

function create(data) {
  const stmt = getDb().prepare(`
    INSERT INTO articulos
      (codigo, nombre, descripcion, costo_unitario, precio_unitario,
       stock_actual, stock_minimo, proveedor, sync_status, updated_at)
    VALUES
      (@codigo, @nombre, @descripcion, @costo_unitario, @precio_unitario,
       @stock_actual, @stock_minimo, @proveedor, 'pending', datetime('now'))
  `);
  const result = stmt.run(data);
  return getById(result.lastInsertRowid);
}

function update(id, data) {
  const fields = Object.keys(data)
    .map(k => `${k} = @${k}`)
    .join(', ');
  getDb()
    .prepare(`UPDATE articulos SET ${fields}, sync_status = 'pending', updated_at = datetime('now') WHERE id = @id`)
    .run({ ...data, id });
  return getById(id);
}

function remove(id) {
  return getDb().prepare('DELETE FROM articulos WHERE id = ?').run(id);
}

module.exports = { getAll, getById, getByCodigo, search, create, update, remove };
