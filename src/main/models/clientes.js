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
        AND estado != 'cancelada'
      ORDER BY created_at DESC
    `)
    .all(clienteId);
}

function listarPagos(clienteId) {
  return getDb()
    .prepare('SELECT * FROM pagos_clientes WHERE cliente_id = ? ORDER BY created_at DESC')
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

function registrarPago(id, monto, formaPago) {
  const db      = getDb();
  const cliente = getById(id);
  if (!cliente)                           throw new Error('Cliente no encontrado');
  if (monto <= 0)                         throw new Error('El monto debe ser mayor a 0');
  if (Number(cliente.saldo_vencido) <= 0) throw new Error('El cliente no tiene saldo vencido');

  const nuevoSaldo = Math.max(0, Number(cliente.saldo_vencido) - monto);
  db.transaction(() => {
    db.prepare(`
      UPDATE clientes SET saldo_vencido = ?, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?
    `).run(nuevoSaldo, id);
    db.prepare(`
      INSERT INTO pagos_clientes (cliente_id, monto, tipo, forma_pago) VALUES (?, ?, 'abono', ?)
    `).run(id, monto, formaPago || 'efectivo');
  })();

  return getById(id);
}

function cancelarPago(pagoId) {
  const db   = getDb();
  const pago = db.prepare('SELECT * FROM pagos_clientes WHERE id = ?').get(pagoId);
  if (!pago)                       throw new Error('Pago no encontrado');
  if (pago.estado === 'cancelado') throw new Error('Este pago ya fue cancelado');
  if (pago.tipo   !== 'abono')     throw new Error('Solo se pueden cancelar abonos');

  let clienteActualizado;
  db.transaction(() => {
    db.prepare(`UPDATE pagos_clientes SET estado = 'cancelado' WHERE id = ?`).run(pagoId);
    db.prepare(`
      INSERT INTO pagos_clientes (cliente_id, monto, tipo, forma_pago, pago_orig_id)
      VALUES (?, ?, 'dev_abono', ?, ?)
    `).run(pago.cliente_id, pago.monto, pago.forma_pago, pagoId);
    db.prepare(`
      UPDATE clientes
         SET saldo_vencido = saldo_vencido + ?,
             sync_status   = 'pending',
             updated_at    = datetime('now')
       WHERE id = ?
    `).run(pago.monto, pago.cliente_id);
    clienteActualizado = getById(pago.cliente_id);
  })();

  return clienteActualizado;
}

function liquidarDeuda(id, formaPago) {
  const cliente = getById(id);
  if (!cliente) throw new Error('Cliente no encontrado');
  const saldo = Number(cliente.saldo_vencido);
  if (saldo <= 0) throw new Error('El cliente no tiene deuda pendiente');
  return registrarPago(id, saldo, formaPago || 'efectivo');
}

function remove(id) {
  return getDb().prepare('DELETE FROM clientes WHERE id = ?').run(id);
}

module.exports = {
  getAll, getById, search, getTransacciones,
  listarPagos, cancelarPago, liquidarDeuda,
  create, update, registrarPago, remove,
};
