// Modelo Proveedores — CRUD de proveedores y gestión de pedidos

const { getDb } = require('../database');

// ── Proveedores ───────────────────────────────────────────────

function getAll() {
  return getDb().prepare(
    'SELECT * FROM proveedores ORDER BY nombre ASC'
  ).all();
}

function getById(id) {
  return getDb().prepare('SELECT * FROM proveedores WHERE id = ?').get(id);
}

function getByNombre(nombre) {
  return getDb().prepare('SELECT * FROM proveedores WHERE nombre = ?').get(nombre);
}

function search(q) {
  const t = `%${q}%`;
  return getDb().prepare(`
    SELECT * FROM proveedores
    WHERE nombre LIKE ? OR telefono LIKE ? OR email LIKE ?
    ORDER BY nombre ASC
  `).all(t, t, t);
}

function create(data) {
  const db = getDb();
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO proveedores (nombre, telefono, email, direccion, notas, sync_status, updated_at)
    VALUES (@nombre, @telefono, @email, @direccion, @notas, 'pending', datetime('now'))
  `).run({
    nombre:    data.nombre,
    telefono:  data.telefono  || null,
    email:     data.email     || null,
    direccion: data.direccion || null,
    notas:     data.notas     || null,
  });
  return getById(lastInsertRowid);
}

function update(id, data) {
  getDb().prepare(`
    UPDATE proveedores SET
      nombre    = @nombre,
      telefono  = @telefono,
      email     = @email,
      direccion = @direccion,
      notas     = @notas,
      sync_status = 'pending',
      updated_at  = datetime('now')
    WHERE id = @id
  `).run({ id, ...data });
  return getById(id);
}

function remove(id) {
  getDb().prepare('DELETE FROM proveedores WHERE id = ?').run(id);
}

// ── Artículos con stock bajo (agrupados por proveedor) ────────

function articulosConStockBajo() {
  return getDb().prepare(`
    SELECT id, codigo, nombre, proveedor, stock_actual, stock_minimo,
           costo_unitario, unidad_medida
    FROM articulos
    WHERE stock_actual <= stock_minimo
    ORDER BY proveedor ASC, nombre ASC
  `).all();
}

// ── Pedidos ───────────────────────────────────────────────────

function getPedidos() {
  return getDb().prepare(`
    SELECT
      p.*,
      COALESCE(pr.nombre, p.proveedor_nombre) AS proveedor_label,
      COUNT(d.id)                              AS total_items
    FROM pedidos_proveedor p
    LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
    LEFT JOIN pedidos_proveedor_detalle d ON d.pedido_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
}

function getPedidoById(id) {
  const pedido = getDb().prepare(`
    SELECT p.*, COALESCE(pr.nombre, p.proveedor_nombre) AS proveedor_label
    FROM pedidos_proveedor p
    LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
    WHERE p.id = ?
  `).get(id);
  if (!pedido) return null;

  const detalle = getDb().prepare(`
    SELECT d.*, a.nombre AS articulo_nombre, a.codigo AS articulo_codigo, a.unidad_medida
    FROM pedidos_proveedor_detalle d
    LEFT JOIN articulos a ON a.id = d.articulo_id
    WHERE d.pedido_id = ?
    ORDER BY a.nombre ASC
  `).all(id);

  return { ...pedido, detalle };
}

function crearPedido(proveedorId, proveedorNombre, items) {
  const db = getDb();

  const insertPedido = db.prepare(`
    INSERT INTO pedidos_proveedor
      (proveedor_id, proveedor_nombre, estado, created_at)
    VALUES (@proveedor_id, @proveedor_nombre, 'pendiente', datetime('now'))
  `);
  const insertDetalle = db.prepare(`
    INSERT INTO pedidos_proveedor_detalle
      (pedido_id, articulo_id, cantidad_sugerida, cantidad_pedida, costo_unitario)
    VALUES (@pedido_id, @articulo_id, @cantidad_sugerida, @cantidad_pedida, @costo_unitario)
  `);

  const { lastInsertRowid: pedidoId } = insertPedido.run({
    proveedor_id:     proveedorId     || null,
    proveedor_nombre: proveedorNombre || null,
  });

  for (const item of items) {
    insertDetalle.run({
      pedido_id:         pedidoId,
      articulo_id:       item.articulo_id,
      cantidad_sugerida: item.cantidad_sugerida,
      cantidad_pedida:   item.cantidad_pedida ?? item.cantidad_sugerida,
      costo_unitario:    item.costo_unitario  ?? 0,
    });
  }

  return getPedidoById(pedidoId);
}

function marcarRecibido(pedidoId, itemsRecibidos) {
  const db = getDb();

  const transaction = db.transaction(() => {
    for (const item of itemsRecibidos) {
      db.prepare(
        'UPDATE pedidos_proveedor_detalle SET recibido = ? WHERE id = ?'
      ).run(item.recibido, item.detalle_id);

      if (item.articulo_id && item.recibido > 0) {
        db.prepare(`
          UPDATE articulos SET
            stock_actual = stock_actual + ?,
            sync_status  = 'pending',
            updated_at   = datetime('now')
          WHERE id = ?
        `).run(item.recibido, item.articulo_id);
      }
    }
    db.prepare(
      "UPDATE pedidos_proveedor SET estado = 'recibido' WHERE id = ?"
    ).run(pedidoId);
  });

  transaction();
  return getPedidoById(pedidoId);
}

module.exports = {
  getAll, getById, getByNombre, search,
  create, update, remove,
  articulosConStockBajo,
  getPedidos, getPedidoById, crearPedido, marcarRecibido,
};
