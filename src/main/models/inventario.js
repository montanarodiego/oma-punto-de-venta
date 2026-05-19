const { getDb } = require('../database');

// Called from within other models' db.transaction() — does NOT open its own transaction
function registrarMovimiento(db, {
  articulo_id, tipo, cantidad_anterior, cantidad_cambio,
  cantidad_resultante, costo_unitario, precio_unitario,
  motivo, usuario, referencia_id,
}) {
  db.prepare(`
    INSERT INTO movimientos_inventario
      (articulo_id, tipo, cantidad_anterior, cantidad_cambio,
       cantidad_resultante, costo_unitario, precio_unitario,
       motivo, usuario, referencia_id, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    articulo_id,
    tipo,
    cantidad_anterior   ?? 0,
    cantidad_cambio     ?? 0,
    cantidad_resultante ?? 0,
    costo_unitario  ?? 0,
    precio_unitario ?? 0,
    motivo  ?? null,
    usuario ?? null,
    referencia_id ?? null,
  );
}

function ajustar({ articulo_id, tipo_ajuste, cantidad, motivo, usuario }) {
  const db  = getDb();
  const art = db.prepare('SELECT * FROM articulos WHERE id = ?').get(articulo_id);
  if (!art) throw new Error('Artículo no encontrado.');
  if (!(cantidad > 0)) throw new Error('La cantidad debe ser mayor a 0.');
  if (!['entrada', 'salida', 'correccion'].includes(tipo_ajuste))
    throw new Error('Tipo de ajuste inválido.');

  return db.transaction(() => {
    const anterior = art.stock_actual;
    let nuevo, cambio;

    if (tipo_ajuste === 'entrada') {
      cambio = cantidad;
      nuevo  = anterior + cantidad;
    } else if (tipo_ajuste === 'salida') {
      cambio = -cantidad;
      nuevo  = anterior - cantidad;
    } else {
      // corrección: cantidad es el nuevo total absoluto
      cambio = cantidad - anterior;
      nuevo  = cantidad;
    }

    db.prepare(`
      UPDATE articulos SET
        stock_actual = ?,
        sync_status  = 'pending',
        updated_at   = datetime('now')
      WHERE id = ?
    `).run(nuevo, articulo_id);

    registrarMovimiento(db, {
      articulo_id,
      tipo:               'ajuste',
      cantidad_anterior:  anterior,
      cantidad_cambio:    cambio,
      cantidad_resultante: nuevo,
      costo_unitario:     art.costo_unitario,
      precio_unitario:    art.precio_unitario,
      motivo:             motivo || tipo_ajuste,
      usuario:            usuario || null,
    });

    return { anterior, nuevo, cambio };
  })();
}

function listarMovimientos({ articulo_id, desde, hasta, tipo } = {}) {
  const db   = getDb();
  const cond = [];
  const args = [];

  if (articulo_id) { cond.push('m.articulo_id = ?');  args.push(articulo_id); }
  if (desde)       { cond.push("m.fecha >= ?");        args.push(desde); }
  if (hasta)       { cond.push("m.fecha <= ?");        args.push(hasta + ' 23:59:59'); }
  if (tipo)        { cond.push('m.tipo = ?');          args.push(tipo); }

  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

  return db.prepare(`
    SELECT m.*,
           a.nombre        AS articulo_nombre,
           a.codigo        AS articulo_codigo,
           a.unidad_medida
    FROM movimientos_inventario m
    LEFT JOIN articulos a ON a.id = m.articulo_id
    ${where}
    ORDER BY m.fecha DESC, m.id DESC
  `).all(...args);
}

function kardex(articulo_id) {
  const db  = getDb();
  const art = db.prepare(`
    SELECT a.*, d.nombre AS departamento_nombre, d.color AS departamento_color
    FROM articulos a
    LEFT JOIN departamentos d ON d.id = a.departamento_id
    WHERE a.id = ?
  `).get(articulo_id);

  if (!art) throw new Error('Artículo no encontrado.');

  const movimientos = db.prepare(`
    SELECT * FROM movimientos_inventario
    WHERE articulo_id = ?
    ORDER BY fecha ASC, id ASC
  `).all(articulo_id);

  return { articulo: art, movimientos };
}

function stockBajo() {
  return getDb().prepare(`
    SELECT a.*, d.nombre AS departamento_nombre, d.color AS departamento_color
    FROM articulos a
    LEFT JOIN departamentos d ON d.id = a.departamento_id
    WHERE a.usa_inventario = 1
      AND a.stock_minimo > 0
      AND a.stock_actual <= a.stock_minimo
    ORDER BY (a.stock_minimo - a.stock_actual) DESC, a.nombre ASC
  `).all();
}

module.exports = { registrarMovimiento, ajustar, listarMovimientos, kardex, stockBajo };
