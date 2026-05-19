// Modelo Pedidos de Compra — ciclo borrador → enviado → recibido / cancelado
const { getDb }             = require('../database');
const { registrarMovimiento } = require('./inventario');

function listar() {
  return getDb().prepare(`
    SELECT
      p.*,
      COALESCE(pv.nombre, p.proveedor_nombre) AS proveedor_label,
      COUNT(i.id) AS total_items
    FROM pedidos_compra p
    LEFT JOIN proveedores pv ON pv.id = p.proveedor_id
    LEFT JOIN pedidos_compra_items i ON i.pedido_id = p.id
    GROUP BY p.id
    ORDER BY p.fecha_creacion DESC
  `).all();
}

function getById(id) {
  const db = getDb();
  const pedido = db.prepare(`
    SELECT p.*, COALESCE(pv.nombre, p.proveedor_nombre) AS proveedor_label
    FROM pedidos_compra p
    LEFT JOIN proveedores pv ON pv.id = p.proveedor_id
    WHERE p.id = ?
  `).get(id);
  if (!pedido) return null;

  const items = db.prepare(`
    SELECT i.*, a.nombre AS articulo_nombre, a.codigo AS articulo_codigo, a.unidad_medida
    FROM pedidos_compra_items i
    LEFT JOIN articulos a ON a.id = i.articulo_id
    WHERE i.pedido_id = ?
    ORDER BY i.id
  `).all(id);

  return { ...pedido, items };
}

function crear(data) {
  const db = getDb();
  let pedidoId;
  db.transaction(() => {
    const res = db.prepare(`
      INSERT INTO pedidos_compra
        (proveedor_id, proveedor_nombre, estado, notas, usuario_id, fecha_creacion)
      VALUES (?, ?, 'borrador', ?, ?, datetime('now'))
    `).run(data.proveedor_id || null, data.proveedor_nombre || null,
           data.notas || null, data.usuario_id || null);
    pedidoId = res.lastInsertRowid;

    const ins = db.prepare(`
      INSERT INTO pedidos_compra_items
        (pedido_id, articulo_id, descripcion_libre, cantidad_pedida, costo_unitario)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of (data.items || [])) {
      ins.run(pedidoId,
              item.articulo_id       || null,
              item.descripcion_libre || null,
              item.cantidad_pedida,
              item.costo_unitario    || 0);
    }
  })();
  return getById(pedidoId);
}

function actualizar(id, data) {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`
      UPDATE pedidos_compra
         SET proveedor_id     = ?,
             proveedor_nombre = ?,
             notas            = ?
       WHERE id = ? AND estado = 'borrador'
    `).run(data.proveedor_id || null, data.proveedor_nombre || null,
           data.notas || null, id);

    if (data.items !== undefined) {
      db.prepare('DELETE FROM pedidos_compra_items WHERE pedido_id = ?').run(id);
      const ins = db.prepare(`
        INSERT INTO pedidos_compra_items
          (pedido_id, articulo_id, descripcion_libre, cantidad_pedida, costo_unitario)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const item of data.items) {
        ins.run(id,
                item.articulo_id       || null,
                item.descripcion_libre || null,
                item.cantidad_pedida,
                item.costo_unitario    || 0);
      }
    }
  })();
  return getById(id);
}

function marcarEnviado(id) {
  getDb().prepare(`
    UPDATE pedidos_compra
       SET estado = 'enviado', fecha_envio = datetime('now')
     WHERE id = ? AND estado = 'borrador'
  `).run(id);
  return getById(id);
}

function recibir(id, itemsRecibidos) {
  const db = getDb();
  db.transaction(() => {
    const getArt = db.prepare(
      'SELECT stock_actual, costo_unitario, precio_unitario FROM articulos WHERE id = ?'
    );

    for (const item of itemsRecibidos) {
      db.prepare(`
        UPDATE pedidos_compra_items
           SET cantidad_recibida = ?, costo_unitario = ?
         WHERE id = ?
      `).run(item.cantidad_recibida, item.costo_unitario, item.item_id);

      if (item.articulo_id && item.cantidad_recibida > 0) {
        const art      = getArt.get(item.articulo_id);
        const anterior = art ? art.stock_actual : 0;
        const resultado = anterior + item.cantidad_recibida;
        const costoProm = item.costo_unitario > 0
          ? item.costo_unitario
          : (art ? art.costo_unitario : 0);

        db.prepare(`
          UPDATE articulos
             SET stock_actual   = ?,
                 costo_unitario = ?,
                 sync_status    = 'pending',
                 updated_at     = datetime('now')
           WHERE id = ?
        `).run(resultado, costoProm, item.articulo_id);

        registrarMovimiento(db, {
          articulo_id:         item.articulo_id,
          tipo:                'recepcion_pedido',
          cantidad_anterior:   anterior,
          cantidad_cambio:     item.cantidad_recibida,
          cantidad_resultante: resultado,
          costo_unitario:      costoProm,
          precio_unitario:     art ? art.precio_unitario : 0,
          motivo:              `Pedido de compra #${id}`,
          referencia_id:       id,
        });
      }
    }

    db.prepare(`
      UPDATE pedidos_compra
         SET estado = 'recibido', fecha_recepcion = datetime('now')
       WHERE id = ?
    `).run(id);
  })();
  return getById(id);
}

function cancelar(id) {
  getDb().prepare(`
    UPDATE pedidos_compra
       SET estado = 'cancelado'
     WHERE id = ? AND estado IN ('borrador', 'enviado')
  `).run(id);
  return getById(id);
}

module.exports = { listar, getById, crear, actualizar, marcarEnviado, recibir, cancelar };
