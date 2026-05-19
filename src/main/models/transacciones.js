const { getDb } = require('../database');
const { registrarMovimiento } = require('./inventario');

function getAll() {
  return getDb()
    .prepare("SELECT * FROM transacciones WHERE estado != 'cancelada' ORDER BY created_at DESC")
    .all();
}

function getById(id) {
  const transaccion = getDb()
    .prepare('SELECT * FROM transacciones WHERE id = ?')
    .get(id);
  if (!transaccion) return null;

  transaccion.detalle = getDb()
    .prepare(`
      SELECT dt.*,
        COALESCE(a.nombre, dt.descripcion_libre) AS nombre,
        COALESCE(a.codigo, '')                   AS codigo,
        COALESCE(a.unidad_medida, 'unidad')      AS unidad_medida
      FROM detalle_transaccion dt
      LEFT JOIN articulos a ON a.id = dt.articulo_id
      WHERE dt.transaccion_id = ?
    `)
    .all(id);

  return transaccion;
}

function getByFecha(desde, hasta) {
  return getDb()
    .prepare(`
      SELECT * FROM transacciones
      WHERE created_at BETWEEN ? AND ? AND estado != 'cancelada'
      ORDER BY created_at DESC
    `)
    .all(desde, hasta);
}

function getRecientes(limite = 50) {
  return getDb()
    .prepare(`
      SELECT t.*, c.nombre AS nombre_cliente
      FROM transacciones t
      LEFT JOIN clientes c ON c.id = t.cuenta_cliente_id
      WHERE date(t.created_at) = date('now')
      ORDER BY t.id DESC
      LIMIT ?
    `)
    .all(limite ?? 50);
}

function create({ transaccion, detalle }) {
  const db = getDb();

  const insert = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(`
        INSERT INTO transacciones
          (monto_total, subtotal, monto_impuesto, descuento_global, notas,
           propina, estado, turno_id, forma_pago, cuenta_cliente_id, sync_status, created_at)
        VALUES
          (@monto_total, @subtotal, @monto_impuesto, @descuento_global, @notas,
           @propina, 'vigente', @turno_id, @forma_pago, @cuenta_cliente_id, 'pending', datetime('now'))
      `)
      .run({
        descuento_global:  transaccion.descuento_global  ?? 0,
        notas:             transaccion.notas              ?? null,
        turno_id:          transaccion.turno_id           ?? null,
        propina:           transaccion.propina            ?? 0,
        ...transaccion,
      });

    const insertDetalle = db.prepare(`
      INSERT INTO detalle_transaccion
        (transaccion_id, articulo_id, descripcion_libre,
         cantidad, precio_al_momento, descuento_porcentaje, importe_total)
      VALUES
        (@transaccion_id, @articulo_id, @descripcion_libre,
         @cantidad, @precio_al_momento, @descuento_porcentaje, @importe_total)
    `);

    const getArt = db.prepare('SELECT * FROM articulos WHERE id = ?');
    const getComps = db.prepare('SELECT * FROM kits_componentes WHERE kit_id = ?');
    const updateStock = db.prepare(`
      UPDATE articulos
      SET stock_actual = stock_actual - ?,
          sync_status  = 'pending',
          updated_at   = datetime('now')
      WHERE id = ?
    `);

    for (const item of detalle) {
      const row = {
        ...item,
        transaccion_id:       lastInsertRowid,
        descripcion_libre:    item.descripcion_libre    ?? null,
        descuento_porcentaje: item.descuento_porcentaje ?? 0,
      };

      if (item.articulo_id != null) {
        const art = getArt.get(item.articulo_id);
        if (!art) throw new Error(`Artículo ID ${item.articulo_id} no encontrado.`);

        insertDetalle.run(row);

        if (art.usa_inventario) {
          if (art.es_kit) {
            const componentes = getComps.all(item.articulo_id);
            // Fetch and validate all components first
            const compArts = componentes.map(comp => {
              const compArt = getArt.get(comp.componente_id);
              if (!compArt) throw new Error(`Componente ID ${comp.componente_id} no encontrado.`);
              const needed = comp.cantidad * item.cantidad;
              if (compArt.stock_actual < needed) {
                throw new Error(
                  `Stock insuficiente para "${compArt.nombre}" (componente de kit). ` +
                  `Disponible: ${compArt.stock_actual}, necesario: ${needed}.`
                );
              }
              return { comp, compArt };
            });
            // Then update and log each component
            for (const { comp, compArt } of compArts) {
              const delta = comp.cantidad * item.cantidad;
              updateStock.run(delta, comp.componente_id);
              registrarMovimiento(db, {
                articulo_id:        comp.componente_id,
                tipo:               'venta',
                cantidad_anterior:  compArt.stock_actual,
                cantidad_cambio:    -delta,
                cantidad_resultante: compArt.stock_actual - delta,
                costo_unitario:     compArt.costo_unitario,
                precio_unitario:    compArt.precio_unitario,
                motivo:             `Kit: ${art.nombre}`,
                referencia_id:      lastInsertRowid,
              });
            }
          } else {
            if (art.stock_actual < item.cantidad) {
              throw new Error(
                `Stock insuficiente para "${art.nombre}". ` +
                `Disponible: ${art.stock_actual}, pedido: ${item.cantidad}.`
              );
            }
            updateStock.run(item.cantidad, item.articulo_id);
            registrarMovimiento(db, {
              articulo_id:        item.articulo_id,
              tipo:               'venta',
              cantidad_anterior:  art.stock_actual,
              cantidad_cambio:    -item.cantidad,
              cantidad_resultante: art.stock_actual - item.cantidad,
              costo_unitario:     art.costo_unitario,
              precio_unitario:    art.precio_unitario,
              referencia_id:      lastInsertRowid,
            });
          }
        }
      } else {
        insertDetalle.run({ ...row, articulo_id: null });
      }
    }

    return lastInsertRowid;
  });

  return getById(insert());
}

module.exports = { getAll, getById, getByFecha, getRecientes, create };
