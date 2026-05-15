const { getDb } = require('../database');

function getAll() {
  return getDb().prepare('SELECT * FROM clientes ORDER BY nombre').all();
}

function getById(id) {
  return getDb().prepare('SELECT * FROM clientes WHERE id = ?').get(id);
}

function search(query) {
  const like = `%${query}%`;
  return getDb()
    .prepare('SELECT * FROM clientes WHERE nombre LIKE ? OR telefono LIKE ? ORDER BY nombre')
    .all(like, like);
}

function create(data) {
  const stmt = getDb().prepare(`
    INSERT INTO clientes
      (nombre, telefono, direccion, limite_credito, saldo_vencido, sync_status, updated_at)
    VALUES
      (@nombre, @telefono, @direccion, @limite_credito, @saldo_vencido, 'pending', datetime('now'))
  `);
  const result = stmt.run(data);
  return getById(result.lastInsertRowid);
}

function update(id, data) {
  const fields = Object.keys(data)
    .map(k => `${k} = @${k}`)
    .join(', ');
  getDb()
    .prepare(`UPDATE clientes SET ${fields}, sync_status = 'pending', updated_at = datetime('now') WHERE id = @id`)
    .run({ ...data, id });
  return getById(id);
}

function remove(id) {
  return getDb().prepare('DELETE FROM clientes WHERE id = ?').run(id);
}

module.exports = { getAll, getById, search, create, update, remove };
