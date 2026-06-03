const { getDb } = require('../database');

// Argentina es UTC-3 sin cambio de horario desde 1999.
// Todos los timestamps se guardan como UTC con datetime('now').
// utcRange() convierte una fecha local (YYYY-MM-DD) a los límites UTC
// correctos para usar en BETWEEN, evitando que ventas nocturnas caigan
// en el día siguiente al agrupar por fecha.
const TZ_OFFSET_H = 3; // horas a sumar para pasar ART → UTC

function utcRange(localDate, endOfDay) {
  const [y, m, d] = localDate.split('-').map(Number);
  const utcH   = (endOfDay ? 23 : 0) + TZ_OFFSET_H;
  const overflow = utcH >= 24;
  const h  = utcH % 24;
  const tail = endOfDay ? ':59:59' : ':00:00';
  if (!overflow) return `${localDate} ${String(h).padStart(2, '0')}${tail}`;
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return `${next} ${String(h).padStart(2, '0')}${tail}`;
}

// Atajo para envolver columna de timestamp en la conversión ART.
// Uso: dt('t.created_at') → "datetime(t.created_at, '-3 hours')"
function dt(col) { return `datetime(${col}, '-3 hours')`; }

function ventasPorPeriodo(desde, hasta) {
  const db = getDb();
  const d  = utcRange(desde, false);
  const h  = utcRange(hasta, true);

  const resumen = db.prepare(`
    SELECT
      COUNT(*)                          AS cantidad,
      COALESCE(SUM(monto_total),    0)  AS total,
      COALESCE(SUM(monto_impuesto), 0)  AS total_iva,
      COALESCE(SUM(subtotal),       0)  AS total_sin_iva
    FROM transacciones
    WHERE created_at BETWEEN ? AND ?
      AND estado != 'cancelada'
  `).get(d, h);

  // Ganancia bruta: (precio_efectivo - costo) × cantidad.
  // precio_efectivo = precio_al_momento × (1 - descuento_porcentaje / 100)
  const gananciaBruta = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN dt.articulo_id IS NOT NULL
        THEN dt.cantidad * (dt.precio_al_momento * (1.0 - dt.descuento_porcentaje / 100.0) - a.costo_unitario)
        ELSE 0 END
    ), 0) AS ganancia_bruta
    FROM detalle_transaccion dt
    LEFT JOIN articulos a ON a.id = dt.articulo_id
    JOIN transacciones t ON t.id = dt.transaccion_id
    WHERE t.created_at BETWEEN ? AND ?
      AND t.estado != 'cancelada'
  `).get(d, h);

  resumen.ganancia_bruta = gananciaBruta.ganancia_bruta;

  const porFormaPago = db.prepare(`
    SELECT forma_pago, SUM(cantidad) AS cantidad, SUM(total) AS total FROM (
      SELECT forma_pago, 1 AS cantidad,
        CASE WHEN forma_pago_2 IS NULL THEN monto_total
             ELSE monto_total - COALESCE(monto_pago_2, 0) END AS total
      FROM transacciones
      WHERE created_at BETWEEN ? AND ? AND estado != 'cancelada'
      UNION ALL
      SELECT forma_pago_2 AS forma_pago, 1 AS cantidad, COALESCE(monto_pago_2, 0) AS total
      FROM transacciones
      WHERE created_at BETWEEN ? AND ? AND estado != 'cancelada'
        AND forma_pago_2 IS NOT NULL
    ) GROUP BY forma_pago ORDER BY total DESC
  `).all(d, h, d, h);

  const transacciones = db.prepare(`
    SELECT id, created_at, forma_pago, forma_pago_2, monto_pago_2, subtotal, monto_impuesto, monto_total
    FROM transacciones
    WHERE created_at BETWEEN ? AND ?
      AND estado != 'cancelada'
    ORDER BY created_at DESC
  `).all(d, h);

  return { resumen, porFormaPago, transacciones };
}

function articulosMasVendidos(desde, hasta) {
  const d = utcRange(desde, false);
  const h = utcRange(hasta, true);

  return getDb().prepare(`
    SELECT
      a.codigo,
      a.nombre,
      CAST(SUM(dt.cantidad) AS REAL)       AS cantidad_total,
      COALESCE(SUM(dt.importe_total), 0)   AS importe_total,
      COALESCE(SUM(dt.cantidad * (dt.precio_al_momento * (1.0 - dt.descuento_porcentaje / 100.0) - a.costo_unitario)), 0)
                                           AS ganancia
    FROM detalle_transaccion dt
    JOIN articulos    a ON a.id = dt.articulo_id
    JOIN transacciones t ON t.id = dt.transaccion_id
    WHERE t.created_at BETWEEN ? AND ?
      AND t.estado != 'cancelada'
    GROUP BY dt.articulo_id
    ORDER BY cantidad_total DESC
  `).all(d, h);
}

function utilidadBruta(desde, hasta) {
  const d = utcRange(desde, false);
  const h = utcRange(hasta, true);

  const items = getDb().prepare(`
    SELECT
      a.codigo,
      a.nombre,
      a.costo_unitario,
      CAST(SUM(dt.cantidad) AS REAL)                                  AS cantidad_total,
      AVG(dt.precio_al_momento)                                       AS precio_venta_promedio,
      COALESCE(SUM(dt.cantidad * (dt.precio_al_momento * (1.0 - dt.descuento_porcentaje / 100.0) - a.costo_unitario)), 0)
                                                                      AS utilidad_total
    FROM detalle_transaccion dt
    JOIN articulos    a ON a.id = dt.articulo_id
    JOIN transacciones t ON t.id = dt.transaccion_id
    WHERE t.created_at BETWEEN ? AND ?
      AND t.estado != 'cancelada'
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

function ventasPorDia(desde, hasta) {
  const db = getDb();
  const d  = utcRange(desde, false);
  const h  = utcRange(hasta, true);

  return db.prepare(`
    WITH g AS (
      SELECT dt.transaccion_id,
        SUM(CASE WHEN dt.articulo_id IS NOT NULL
          THEN dt.cantidad * (dt.precio_al_momento * (1.0 - dt.descuento_porcentaje / 100.0) - a.costo_unitario)
          ELSE 0 END) AS ganancia
      FROM detalle_transaccion dt
      LEFT JOIN articulos a ON a.id = dt.articulo_id
      GROUP BY dt.transaccion_id
    )
    SELECT
      DATE(${dt('t.created_at')})          AS fecha,
      COUNT(*)                             AS cantidad,
      COALESCE(SUM(t.monto_total), 0)      AS total,
      COALESCE(SUM(g.ganancia),   0)       AS ganancia
    FROM transacciones t
    LEFT JOIN g ON g.transaccion_id = t.id
    WHERE t.created_at BETWEEN ? AND ?
      AND t.estado != 'cancelada'
    GROUP BY DATE(${dt('t.created_at')})
    ORDER BY fecha ASC
  `).all(d, h);
}

function ventasPorHora(fecha) {
  const db = getDb();
  const d  = utcRange(fecha, false);
  const h  = utcRange(fecha, true);

  return db.prepare(`
    SELECT
      CAST(strftime('%H', ${dt('created_at')}) AS INTEGER) AS hora,
      COUNT(*)                                             AS cantidad,
      COALESCE(SUM(monto_total), 0)                        AS total
    FROM transacciones
    WHERE created_at BETWEEN ? AND ?
      AND estado != 'cancelada'
    GROUP BY strftime('%H', ${dt('created_at')})
    ORDER BY hora ASC
  `).all(d, h);
}

function mejorDia(desde, hasta) {
  const db = getDb();
  const d  = utcRange(desde, false);
  const h  = utcRange(hasta, true);

  return db.prepare(`
    SELECT
      DATE(${dt('created_at')})              AS fecha,
      COUNT(*)                               AS cantidad,
      COALESCE(SUM(monto_total), 0)          AS total
    FROM transacciones
    WHERE created_at BETWEEN ? AND ?
      AND estado != 'cancelada'
    GROUP BY DATE(${dt('created_at')})
    ORDER BY total DESC
    LIMIT 1
  `).get(d, h) || null;
}

function resumenRapido(desde, hasta) {
  const db = getDb();
  const d  = utcRange(desde, false);
  const h  = utcRange(hasta, true);

  const row = db.prepare(`
    SELECT COUNT(*) AS cantidad, COALESCE(SUM(monto_total), 0) AS total
    FROM transacciones WHERE created_at BETWEEN ? AND ?
      AND estado != 'cancelada'
  `).get(d, h);

  const gan = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN dt.articulo_id IS NOT NULL
        THEN dt.cantidad * (dt.precio_al_momento * (1.0 - dt.descuento_porcentaje / 100.0) - a.costo_unitario)
        ELSE 0 END
    ), 0) AS ganancia_bruta
    FROM detalle_transaccion dt
    LEFT JOIN articulos a ON a.id = dt.articulo_id
    JOIN transacciones t ON t.id = dt.transaccion_id
    WHERE t.created_at BETWEEN ? AND ?
      AND t.estado != 'cancelada'
  `).get(d, h);

  return { cantidad: row.cantidad, total: row.total, ganancia_bruta: gan.ganancia_bruta };
}

function ventasPorCliente(desde, hasta) {
  const d = utcRange(desde, false);
  const h = utcRange(hasta, true);

  return getDb().prepare(`
    SELECT
      c.id,
      c.nombre,
      c.telefono,
      COUNT(*) AS cantidad_transacciones,
      COALESCE(SUM(t.monto_total), 0)  AS total_comprado,
      COALESCE(SUM(gan.ganancia),  0)  AS ganancia_generada
    FROM clientes c
    JOIN transacciones t ON t.cuenta_cliente_id = c.id
    LEFT JOIN (
      SELECT dt.transaccion_id,
        SUM(CASE WHEN dt.articulo_id IS NOT NULL
              THEN dt.cantidad * (dt.precio_al_momento * (1.0 - dt.descuento_porcentaje / 100.0) - a.costo_unitario)
              ELSE 0 END) AS ganancia
      FROM detalle_transaccion dt
      LEFT JOIN articulos a ON a.id = dt.articulo_id
      GROUP BY dt.transaccion_id
    ) gan ON gan.transaccion_id = t.id
    WHERE t.created_at BETWEEN ? AND ?
      AND t.estado = 'vigente'
    GROUP BY c.id, c.nombre, c.telefono
    ORDER BY total_comprado DESC
  `).all(d, h);
}

function ventasPorMes(desde, hasta) {
  const db = getDb();
  const d  = utcRange(desde, false);
  const h  = utcRange(hasta, true);

  return db.prepare(`
    WITH g AS (
      SELECT dt.transaccion_id,
        SUM(CASE WHEN dt.articulo_id IS NOT NULL
          THEN dt.cantidad * (dt.precio_al_momento * (1.0 - dt.descuento_porcentaje / 100.0) - a.costo_unitario)
          ELSE 0 END) AS ganancia
      FROM detalle_transaccion dt
      LEFT JOIN articulos a ON a.id = dt.articulo_id
      GROUP BY dt.transaccion_id
    )
    SELECT
      strftime('%Y-%m', ${dt('t.created_at')})  AS mes,
      COUNT(*)                                   AS cantidad,
      COALESCE(SUM(t.monto_total), 0)            AS total,
      COALESCE(SUM(g.ganancia), 0)               AS ganancia
    FROM transacciones t
    LEFT JOIN g ON g.transaccion_id = t.id
    WHERE t.created_at BETWEEN ? AND ?
      AND t.estado != 'cancelada'
    GROUP BY strftime('%Y-%m', ${dt('t.created_at')})
    ORDER BY mes ASC
  `).all(d, h);
}

function ventasPorDepartamento(desde, hasta) {
  const db = getDb();
  const d  = utcRange(desde, false);
  const h  = utcRange(hasta, true);

  return db.prepare(`
    SELECT
      COALESCE(dep.nombre, 'Sin departamento') AS departamento,
      COUNT(DISTINCT t.id)                      AS cantidad,
      COALESCE(SUM(dt.importe_total), 0)        AS total,
      COALESCE(SUM(dt.cantidad * (dt.precio_al_momento * (1.0 - dt.descuento_porcentaje / 100.0) - a.costo_unitario)), 0) AS ganancia
    FROM detalle_transaccion dt
    JOIN transacciones t ON t.id = dt.transaccion_id
    LEFT JOIN articulos a ON a.id = dt.articulo_id
    LEFT JOIN departamentos dep ON dep.id = a.departamento_id
    WHERE t.created_at BETWEEN ? AND ?
      AND t.estado != 'cancelada'
    GROUP BY COALESCE(dep.nombre, 'Sin departamento')
    ORDER BY total DESC
  `).all(d, h);
}

function ventasPorHoraRango(desde, hasta) {
  const db = getDb();
  const d  = utcRange(desde, false);
  const h  = utcRange(hasta, true);

  return db.prepare(`
    SELECT
      CAST(strftime('%H', ${dt('created_at')}) AS INTEGER) AS hora,
      COUNT(*)                                             AS cantidad,
      COALESCE(SUM(monto_total), 0)                        AS total
    FROM transacciones
    WHERE created_at BETWEEN ? AND ?
      AND estado != 'cancelada'
    GROUP BY strftime('%H', ${dt('created_at')})
    ORDER BY hora ASC
  `).all(d, h);
}

module.exports = {
  ventasPorPeriodo, articulosMasVendidos, utilidadBruta, saldosClientes,
  ventasPorDia, ventasPorHora, mejorDia, resumenRapido, ventasPorCliente,
  ventasPorMes, ventasPorDepartamento, ventasPorHoraRango,
};
