const { getDb } = require('../database');

function ventasPorPeriodo(desde, hasta) {
  const db  = getDb();
  const d   = desde + ' 00:00:00';
  const h   = hasta  + ' 23:59:59';

  const resumen = db.prepare(`
    SELECT
      COUNT(*)                          AS cantidad,
      COALESCE(SUM(monto_total),    0)  AS total,
      COALESCE(SUM(monto_impuesto), 0)  AS total_iva,
      COALESCE(SUM(subtotal),       0)  AS total_sin_iva
    FROM transacciones
    WHERE created_at BETWEEN ? AND ?
  `).get(d, h);

  // Ganancia bruta: (precio_al_momento - costo_unitario) * cantidad
  // Para Productos Comunes (articulo_id NULL) ganancia = 0
  const gananciaBruta = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN dt.articulo_id IS NOT NULL
        THEN dt.cantidad * (dt.precio_al_momento - a.costo_unitario)
        ELSE 0 END
    ), 0) AS ganancia_bruta
    FROM detalle_transaccion dt
    LEFT JOIN articulos a ON a.id = dt.articulo_id
    JOIN transacciones t ON t.id = dt.transaccion_id
    WHERE t.created_at BETWEEN ? AND ?
  `).get(d, h);

  resumen.ganancia_bruta = gananciaBruta.ganancia_bruta;

  const porFormaPago = db.prepare(`
    SELECT
      forma_pago,
      COUNT(*)                         AS cantidad,
      COALESCE(SUM(monto_total), 0)    AS total
    FROM transacciones
    WHERE created_at BETWEEN ? AND ?
    GROUP BY forma_pago
    ORDER BY total DESC
  `).all(d, h);

  const transacciones = db.prepare(`
    SELECT id, created_at, forma_pago, subtotal, monto_impuesto, monto_total
    FROM transacciones
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC
  `).all(d, h);

  return { resumen, porFormaPago, transacciones };
}

function articulosMasVendidos(desde, hasta) {
  const d = desde + ' 00:00:00';
  const h = hasta  + ' 23:59:59';

  return getDb().prepare(`
    SELECT
      a.codigo,
      a.nombre,
      CAST(SUM(dt.cantidad) AS REAL)       AS cantidad_total,
      COALESCE(SUM(dt.importe_total), 0)   AS importe_total,
      COALESCE(SUM(dt.cantidad * (dt.precio_al_momento - a.costo_unitario)), 0)
                                           AS ganancia
    FROM detalle_transaccion dt
    JOIN articulos    a ON a.id = dt.articulo_id
    JOIN transacciones t ON t.id = dt.transaccion_id
    WHERE t.created_at BETWEEN ? AND ?
    GROUP BY dt.articulo_id
    ORDER BY cantidad_total DESC
  `).all(d, h);
}

function utilidadBruta(desde, hasta) {
  const d = desde + ' 00:00:00';
  const h = hasta  + ' 23:59:59';

  const items = getDb().prepare(`
    SELECT
      a.codigo,
      a.nombre,
      a.costo_unitario,
      CAST(SUM(dt.cantidad) AS REAL)                                  AS cantidad_total,
      AVG(dt.precio_al_momento)                                       AS precio_venta_promedio,
      COALESCE(SUM(dt.cantidad * (dt.precio_al_momento - a.costo_unitario)), 0)
                                                                      AS utilidad_total
    FROM detalle_transaccion dt
    JOIN articulos    a ON a.id = dt.articulo_id
    JOIN transacciones t ON t.id = dt.transaccion_id
    WHERE t.created_at BETWEEN ? AND ?
    GROUP BY dt.articulo_id
    ORDER BY utilidad_total DESC
  `).all(d, h);

  const totalUtilidad = items.reduce((s, i) => s + Number(i.utilidad_total), 0);
  return { items, totalUtilidad };
}

function saldosClientes() {
  const clientes = getDb().prepare(`
    SELECT id, nombre, telefono, limite_credito, saldo_vencido
    FROM clientes
    WHERE saldo_vencido > 0
    ORDER BY saldo_vencido DESC
  `).all();

  const totalDeuda = clientes.reduce((s, c) => s + Number(c.saldo_vencido), 0);
  return { clientes, totalDeuda };
}

module.exports = { ventasPorPeriodo, articulosMasVendidos, utilidadBruta, saldosClientes };
