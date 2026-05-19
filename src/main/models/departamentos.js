const { getDb } = require('../database');

function getAll() {
  return getDb().prepare('SELECT * FROM departamentos ORDER BY nombre').all();
}

function getById(id) {
  return getDb().prepare('SELECT * FROM departamentos WHERE id = ?').get(id);
}

function create({ nombre, color = '#6b7280' }) {
  const result = getDb()
    .prepare('INSERT INTO departamentos (nombre, color) VALUES (?, ?)')
    .run(nombre.trim(), color);
  return getById(result.lastInsertRowid);
}

function update(id, data) {
  const fields = [];
  const params = {};
  if (data.nombre !== undefined) { fields.push('nombre = @nombre'); params.nombre = data.nombre.trim(); }
  if (data.color  !== undefined) { fields.push('color = @color');   params.color  = data.color; }
  if (fields.length === 0) throw new Error('Sin campos para actualizar');
  getDb().prepare(`UPDATE departamentos SET ${fields.join(', ')} WHERE id = @id`).run({ ...params, id });
  return getById(id);
}

function remove(id) {
  const db    = getDb();
  const count = db.prepare('SELECT COUNT(*) AS n FROM articulos WHERE departamento_id = ?').get(id).n;
  if (count > 0)
    throw new Error(`No se puede eliminar: hay ${count} artículo${count !== 1 ? 's' : ''} asignado${count !== 1 ? 's' : ''} a este departamento.`);
  return db.prepare('DELETE FROM departamentos WHERE id = ?').run(id);
}

module.exports = { getAll, getById, create, update, remove };
