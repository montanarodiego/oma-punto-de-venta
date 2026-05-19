const { getDb } = require('../database');
const { registrarMovimiento } = require('./inventario');

function crear(data) {
  const db = getDb();
  const { proveedor_id, proveedor_nombre, pedido_id, notas, detalle } = data;

  const totalCosto = (detalle || []).reduce((s, d) => s + (d.importe_total || 0), 0);

  const recepcionId = db.transaction(() => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO recepciones (pedido_id, proveedor_id, proveedor_nombre, notas, total_costo, created_at)
      VALUES (@pedido_id, @proveedor_id, @proveedor_nombre, @notas, @total_costo, datetime('now'))
    `).run({
      pedido_id:        pedido_id        || null,
      proveedor_id:     proveedor_id     || null,
      proveedor_nombre: proveedor_nombre || null,
      notas:            notas            || null,
      total_costo:      totalCosto,
    });

    const insDetalle = db.prepare(`
      INSERT INTO recepciones_detalle
        (recepcion_id, articulo_id, descripcion, cantidad_recibida, costo_unitario, importe_total)
      VALUES (@recepcion_id, @articulo_id, @descripcion, @cantidad_recibida, @costo_unitario, @importe_total)
    `);
    const getArt = db.prepare('SELECT stock_actual, precio_unitario FROM articulos WHERE id = ?');

    for (const d of (detalle || [])) {
      insDetalle.run({
        recepcion_id:      lastInsertRowid,
        articulo_id:       d.articulo_id       || null,
        descripcion:       d.descripcion       || null,
        cantidad_recibida: d.cantidad_recibida,
        costo_unitario:    d.costo_unitario    ?? 0,
        importe_total:     d.importe_total     ?? 0,
      });

      if (d.articulo_id && d.cantidad_recibida > 0) {
        const art      = getArt.get(d.articulo_id);
        const anterior = art ? art.stock_actual : 0;

        if (d.costo_unitario > 0) {
          db.prepare(`
            UPDATE articulos SET
              stock_actual   = stock_actual + ?,
              costo_unitario = ?,
              sync_status    = 'pending',
              updated_at     = datetime('now')
            WHERE id = ?
          `).run(d.cantidad_recibida, d.costo_unitario, d.articulo_id);
        } else {
          db.prepare(`
            UPDATE articulos SET
              stock_actual = stock_actual + ?,
              sync_status  = 'pending',
              updated_at   = datetime('now')
            WHERE id = ?
          `).run(d.cantidad_recibida, d.articulo_id);
        }

        registrarMovimiento(db, {
          articulo_id:        d.articulo_id,
          tipo:               'recepcion',
          cantidad_anterior:  anterior,
          cantidad_cambio:    d.cantidad_recibida,
          cantidad_resultante: anterior + d.cantidad_recibida,
          costo_unitario:     d.costo_unitario ?? 0,
          precio_unitario:    art ? art.precio_unitario : 0,
          referencia_id:      lastInsertRowid,
        });
      }
    }

    if (pedido_id) {
      db.prepare("UPDATE pedidos_proveedor SET estado = 'recibido' WHERE id = ?").run(pedido_id);
    }

    return lastInsertRowid;
  })();

  return getById(recepcionId);
}

function listar() {
  return getDb().prepare(`
    SELECT
      r.*,
      COALESCE(p.nombre, r.proveedor_nombre) AS proveedor_label,
      COUNT(d.id)                             AS total_items
    FROM recepciones r
    LEFT JOIN proveedores p   ON p.id = r.proveedor_id
    LEFT JOIN recepciones_detalle d ON d.recepcion_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).all();
}

function getById(id) {
  const recepcion = getDb().prepare(`
    SELECT r.*, COALESCE(p.nombre, r.proveedor_nombre) AS proveedor_label
    FROM recepciones r
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    WHERE r.id = ?
  `).get(id);
  if (!recepcion) return null;

  const detalle = getDb().prepare(`
    SELECT d.*, a.nombre AS articulo_nombre, a.codigo AS articulo_codigo, a.unidad_medida
    FROM recepciones_detalle d
    LEFT JOIN articulos a ON a.id = d.articulo_id
    WHERE d.recepcion_id = ?
    ORDER BY d.id ASC
  `).all(id);

  return { ...recepcion, detalle };
}

module.exports = { crear, listar, getById };
