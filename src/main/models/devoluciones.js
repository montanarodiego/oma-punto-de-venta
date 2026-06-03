const { getDb } = require('../database');
const { registrarMovimiento } = require('./inventario');

function cancelarTransaccion({ transaccionId, turnoId, motivo }) {
  const db    = getDb();
  const trans = db.prepare('SELECT * FROM transacciones WHERE id = ?').get(transaccionId);
  if (!trans) throw new Error('Transacción no encontrada');
  if (trans.estado === 'cancelada') throw new Error('Esta transacción ya fue cancelada');

  const detalle = db.prepare(`
    SELECT dt.*, COALESCE(a.nombre, dt.descripcion_libre) AS nombre
    FROM detalle_transaccion dt
    LEFT JOIN articulos a ON a.id = dt.articulo_id
    WHERE dt.transaccion_id = ?
  `).all(transaccionId);

  const op = db.transaction(() => {
    const updateStock = db.prepare(`
      UPDATE articulos
      SET stock_actual = stock_actual + ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    const getArt = db.prepare('SELECT stock_actual, costo_unitario, precio_unitario FROM articulos WHERE id = ?');
    for (const item of detalle) {
      if (item.articulo_id) {
        const art      = getArt.get(item.articulo_id);
        const anterior = art ? art.stock_actual : 0;
        updateStock.run(item.cantidad, item.articulo_id);
        registrarMovimiento(db, {
          articulo_id:        item.articulo_id,
          tipo:               'devolucion',
          cantidad_anterior:  anterior,
          cantidad_cambio:    item.cantidad,
          cantidad_resultante: anterior + item.cantidad,
          costo_unitario:     art ? art.costo_unitario  : 0,
          precio_unitario:    art ? art.precio_unitario : item.precio_al_momento,
          motivo,
          referencia_id:      transaccionId,
        });
      }
    }

    const dvInfo = db.prepare(`
      INSERT INTO devoluciones (transaccion_id, turno_id, motivo, monto_devuelto, tipo)
      VALUES (?, ?, ?, ?, 'total')
    `).run(transaccionId, turnoId ?? null, motivo, trans.monto_total);

    const insertDet = db.prepare(`
      INSERT INTO devoluciones_detalle
        (devolucion_id, detalle_id, articulo_id, descripcion, cantidad, precio_unitario, importe)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of detalle) {
      insertDet.run(
        dvInfo.lastInsertRowid,
        item.id,
        item.articulo_id ?? null,
        item.nombre,
        item.cantidad,
        item.precio_al_momento,
        item.importe_total,
      );
    }

    db.prepare(`
      UPDATE transacciones
      SET estado = 'cancelada', motivo_cancelacion = ?
      WHERE id = ?
    `).run(motivo, transaccionId);

    return db.prepare('SELECT * FROM devoluciones WHERE id = ?').get(dvInfo.lastInsertRowid);
  });

  return op();
}

function devolucionParcial({ transaccionId, turnoId, motivo, items }) {
  const db    = getDb();
  const trans = db.prepare('SELECT * FROM transacciones WHERE id = ?').get(transaccionId);
  if (!trans) throw new Error('Transacción no encontrada');
  if (trans.estado === 'cancelada') throw new Error('Esta transacción ya fue cancelada');

  const montoDevuelto = items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);

  const op = db.transaction(() => {
    const updateStock = db.prepare(`
      UPDATE articulos
      SET stock_actual = stock_actual + ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    const getArt2 = db.prepare('SELECT stock_actual, costo_unitario, precio_unitario FROM articulos WHERE id = ?');

    const dvInfo = db.prepare(`
      INSERT INTO devoluciones (transaccion_id, turno_id, motivo, monto_devuelto, tipo)
      VALUES (?, ?, ?, ?, 'parcial')
    `).run(transaccionId, turnoId ?? null, motivo, montoDevuelto);

    const insertDet = db.prepare(`
      INSERT INTO devoluciones_detalle
        (devolucion_id, detalle_id, articulo_id, descripcion, cantidad, precio_unitario, importe)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      if (item.articulo_id) {
        const art      = getArt2.get(item.articulo_id);
        const anterior = art ? art.stock_actual : 0;
        updateStock.run(item.cantidad, item.articulo_id);
        registrarMovimiento(db, {
          articulo_id:        item.articulo_id,
          tipo:               'devolucion',
          cantidad_anterior:  anterior,
          cantidad_cambio:    item.cantidad,
          cantidad_resultante: anterior + item.cantidad,
          costo_unitario:     art ? art.costo_unitario  : 0,
          precio_unitario:    art ? art.precio_unitario : item.precio_unitario,
          motivo,
          referencia_id:      transaccionId,
        });
      }
      insertDet.run(
        dvInfo.lastInsertRowid,
        item.detalle_id ?? null,
        item.articulo_id ?? null,
        item.descripcion,
        item.cantidad,
        item.precio_unitario,
        item.precio_unitario * item.cantidad,
      );
    }

    db.prepare(`
      UPDATE transacciones SET estado = 'devolucion_parcial'
      WHERE id = ? AND estado = 'vigente'
    `).run(transaccionId);

    return db.prepare('SELECT * FROM devoluciones WHERE id = ?').get(dvInfo.lastInsertRowid);
  });

  return op();
}

function getByTransaccion(transaccionId) {
  const db          = getDb();
  const devoluciones = db.prepare(
    'SELECT * FROM devoluciones WHERE transaccion_id = ? ORDER BY id DESC'
  ).all(transaccionId);
  for (const d of devoluciones) {
    d.detalle = db.prepare(
      'SELECT * FROM devoluciones_detalle WHERE devolucion_id = ?'
    ).all(d.id);
  }
  return devoluciones;
}

function getRecientes(limite = 40) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.*, c.nombre AS nombre_cliente
    FROM transacciones t
    LEFT JOIN clientes c ON c.id = t.cuenta_cliente_id
    WHERE date(datetime(t.created_at, '-3 hours')) = date(datetime('now', '-3 hours'))
    ORDER BY t.id DESC
    LIMIT ?
  `).all(limite);
  return rows;
}

module.exports = { cancelarTransaccion, devolucionParcial, getByTransaccion, getRecientes };
