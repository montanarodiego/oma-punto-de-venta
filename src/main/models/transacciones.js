const { getDb } = require('../database');

function getAll() {
  return getDb()
    .prepare('SELECT * FROM transacciones ORDER BY created_at DESC')
    .all();
}

function getById(id) {
  const transaccion = getDb()
    .prepare('SELECT * FROM transacciones WHERE id = ?')
    .get(id);
  if (!transaccion) return null;

  transaccion.detalle = getDb()
    .prepare(`
      SELECT dt.*, a.nombre, a.codigo
      FROM detalle_transaccion dt
      JOIN articulos a ON a.id = dt.articulo_id
      WHERE dt.transaccion_id = ?
    `)
    .all(id);

  return transaccion;
}

function getByFecha(desde, hasta) {
  return getDb()
    .prepare(
      'SELECT * FROM transacciones WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC'
    )
    .all(desde, hasta);
}

function create({ transaccion, detalle }) {
  const db = getDb();

  const insert = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(`
        INSERT INTO transacciones
          (monto_total, subtotal, monto_impuesto, forma_pago, cuenta_cliente_id, sync_status, created_at)
        VALUES
          (@monto_total, @subtotal, @monto_impuesto, @forma_pago, @cuenta_cliente_id, 'pending', datetime('now'))
      `)
      .run(transaccion);

    const insertDetalle = db.prepare(`
      INSERT INTO detalle_transaccion
        (transaccion_id, articulo_id, cantidad, precio_al_momento, importe_total)
      VALUES
        (@transaccion_id, @articulo_id, @cantidad, @precio_al_momento, @importe_total)
    `);

    const checkStock = db.prepare('SELECT stock_actual, nombre FROM articulos WHERE id = ?');
    const updateStock = db.prepare(`
      UPDATE articulos
      SET stock_actual = stock_actual - ?,
          sync_status  = 'pending',
          updated_at   = datetime('now')
      WHERE id = ?
    `);

    for (const item of detalle) {
      const art = checkStock.get(item.articulo_id);
      if (!art) throw new Error(`Artículo ID ${item.articulo_id} no encontrado.`);
      if (art.stock_actual < item.cantidad) {
        throw new Error(
          `Stock insuficiente para "${art.nombre}". ` +
          `Disponible: ${art.stock_actual}, pedido: ${item.cantidad}.`
        );
      }
      insertDetalle.run({ ...item, transaccion_id: lastInsertRowid });
      updateStock.run(item.cantidad, item.articulo_id);
    }

    return lastInsertRowid;
  });

  return getById(insert());
}

module.exports = { getAll, getById, getByFecha, create };
