const { getDb } = require('../database');

const CAMPOS_EDITABLES = ['nombre', 'telefono', 'direccion', 'limite_credito'];

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

function getTransacciones(clienteId) {
  return getDb()
    .prepare(`
      SELECT id, monto_total, subtotal, monto_impuesto, forma_pago, sync_status, created_at
      FROM transacciones
      WHERE cuenta_cliente_id = ?
      ORDER BY created_at DESC
    `)
    .all(clienteId);
}

function create(data) {
  const stmt = getDb().prepare(`
    INSERT INTO clientes
      (nombre, telefono, direccion, limite_credito, saldo_vencido, sync_status, updated_at)
    VALUES
      (@nombre, @telefono, @direccion, @limite_credito, 0, 'pending', datetime('now'))
  `);
  const result = stmt.run(data);
  return getById(result.lastInsertRowid);
}

function update(id, data) {
  const campos = Object.keys(data).filter(k => CAMPOS_EDITABLES.includes(k));
  if (campos.length === 0) throw new Error('Sin campos válidos para actualizar');
  const set = campos.map(k => `${k} = @${k}`).join(', ');
  getDb()
    .prepare(`UPDATE clientes SET ${set}, sync_status = 'pending', updated_at = datetime('now') WHERE id = @id`)
    .run({ ...data, id });
  return getById(id);
}

function registrarPago(id, monto) {
  const db     = getDb();
  const cliente = getById(id);
  if (!cliente) throw new Error('Cliente no encontrado');
  if (monto <= 0) throw new Error('El monto debe ser mayor a 0');
  if (Number(cliente.saldo_vencido) <= 0) throw new Error('El cliente no tiene saldo vencido');

  const nuevoSaldo = Math.max(0, Number(cliente.saldo_vencido) - monto);
  db.prepare(`
    UPDATE clientes
    SET saldo_vencido = ?, sync_status = 'pending', updated_at = datetime('now')
    WHERE id = ?
  `).run(nuevoSaldo, id);

  return getById(id);
}

function remove(id) {
  return getDb().prepare('DELETE FROM clientes WHERE id = ?').run(id);
}

module.exports = { getAll, getById, search, getTransacciones, create, update, registrarPago, remove };
