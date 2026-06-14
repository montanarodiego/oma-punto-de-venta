const { getDb } = require('../database');
const { registrarMovimiento } = require('./inventario');
const { aCentavos, redondear } = require('../money');

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
      WHERE date(datetime(t.created_at, '-3 hours')) = date(datetime('now', '-3 hours'))
      ORDER BY t.id DESC
      LIMIT ?
    `)
    .all(limite ?? 50);
}

function create({ transaccion, detalle }) {
  const db = getDb();

  // ── I-1: validación anti-tampering server-side ────────────────────────────
  // No se confía en precios ni importes que manda el renderer. Se validan contra
  // la DB y se recalculan. Bloquea precios por debajo del mínimo legítimo
  // (lista / mayoreo / promo) y montos totales manipulados. La validación corre
  // ANTES de la transacción: una venta rechazada no escribe nada en la DB.
  const tienePromos = !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='promociones'")
    .get();
  const getArtPV    = db.prepare('SELECT * FROM articulos WHERE id = ?');
  const getPromosPV = tienePromos
    ? db.prepare('SELECT cantidad_desde, cantidad_hasta, precio_promocional FROM promociones WHERE articulo_id = ?')
    : null;

  let sumImportesCent = 0;
  const detalleValidado = (detalle ?? []).map((item) => {
    const cantidad = Number(item.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error('Cantidad inválida en un ítem de la venta.');
    }
    const descPct = Number(item.descuento_porcentaje ?? 0);
    if (!Number.isFinite(descPct) || descPct < 0 || descPct > 100) {
      throw new Error('Descuento por ítem fuera de rango (0–100%).');
    }
    const precio = Number(item.precio_al_momento);
    if (!Number.isFinite(precio) || precio < 0) {
      throw new Error('Precio inválido en un ítem de la venta.');
    }

    // Los ítems libres (sin articulo_id) llevan precio que tipea el cajero: no hay
    // referencia en la DB contra la cual validar. Los registrados sí se validan.
    if (item.articulo_id != null) {
      const art = getArtPV.get(item.articulo_id);
      if (!art) throw new Error(`Artículo ID ${item.articulo_id} no encontrado.`);

      // Precios legítimos para esta cantidad: lista, mayoreo (si está cargado) y
      // promos cuya franja de cantidad aplique.
      const preciosValidos = [Number(art.precio_unitario) || 0];
      if (Number(art.precio_mayoreo) > 0) preciosValidos.push(Number(art.precio_mayoreo));
      if (getPromosPV) {
        for (const p of getPromosPV.all(item.articulo_id)) {
          const aplica = cantidad >= p.cantidad_desde &&
            (p.cantidad_hasta == null || cantidad <= p.cantidad_hasta);
          if (aplica) preciosValidos.push(Number(p.precio_promocional) || 0);
        }
      }
      const pisoCent = Math.min(...preciosValidos.map(aCentavos));
      if (aCentavos(precio) < pisoCent) {
        throw new Error(
          `Precio de "${art.nombre}" por debajo del mínimo permitido ` +
          `($${pisoCent / 100}). Venta rechazada por seguridad.`,
        );
      }
    }

    // importe_total SIEMPRE recalculado en el backend.
    const importe = redondear(precio * cantidad * (1 - descPct / 100));
    sumImportesCent += aCentavos(importe);
    return { ...item, cantidad, descuento_porcentaje: descPct, importe_total: importe };
  });

  // Coherencia del total: el monto cobrado no puede ser menor que el subtotal
  // (suma de importes de línea) menos el descuento global. IVA y propina solo suman.
  const descGlobalCent = aCentavos(Number(transaccion.descuento_global ?? 0));
  if (descGlobalCent < 0 || descGlobalCent > sumImportesCent + 1) {
    throw new Error('Descuento global inválido (excede el subtotal).');
  }
  const ivaCent  = aCentavos(Number(transaccion.monto_impuesto ?? 0));
  const propCent = aCentavos(Number(transaccion.propina ?? 0));
  if (ivaCent < 0 || propCent < 0) throw new Error('Impuesto o propina inválidos.');

  const montoTotal = Number(transaccion.monto_total);
  if (!Number.isFinite(montoTotal) || montoTotal < 0) {
    throw new Error('Monto total inválido.');
  }
  const TOL = detalleValidado.length + 2; // absorbe redondeo de ≤1 centavo por línea
  const minTotalCent = sumImportesCent - descGlobalCent;
  if (aCentavos(montoTotal) + TOL < minTotalCent) {
    throw new Error('El monto total no coincide con el detalle. Venta rechazada por seguridad.');
  }

  detalle = detalleValidado;

  const insert = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(`
        INSERT INTO transacciones
          (monto_total, subtotal, monto_impuesto, descuento_global, notas,
           propina, estado, turno_id, forma_pago, forma_pago_2, monto_pago_2,
           cuenta_cliente_id, sync_status, created_at)
        VALUES
          (@monto_total, @subtotal, @monto_impuesto, @descuento_global, @notas,
           @propina, 'vigente', @turno_id, @forma_pago, @forma_pago_2, @monto_pago_2,
           @cuenta_cliente_id, 'pending', datetime('now'))
      `)
      .run({
        descuento_global:  transaccion.descuento_global  ?? 0,
        notas:             transaccion.notas              ?? null,
        turno_id:          transaccion.turno_id           ?? null,
        propina:           transaccion.propina            ?? 0,
        forma_pago_2:      transaccion.forma_pago_2       ?? null,
        monto_pago_2:      transaccion.monto_pago_2       ?? null,
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

    // Actualizar saldo_vencido del cliente cuando hay pago en cuenta corriente
    if (transaccion.cuenta_cliente_id) {
      const fp  = transaccion.forma_pago;
      const fp2 = transaccion.forma_pago_2  ?? null;
      const m2  = transaccion.monto_pago_2  ?? 0;
      const mt  = transaccion.monto_total   ?? 0;
      let montoCuentaCorriente = 0;

      if (fp === 'cuenta_corriente' && !fp2) {
        montoCuentaCorriente = mt;
      } else if (fp === 'cuenta_corriente' && fp2) {
        montoCuentaCorriente = mt - m2;
      } else if (fp2 === 'cuenta_corriente') {
        montoCuentaCorriente = m2;
      }

      if (montoCuentaCorriente > 0) {
        db.prepare(`
          UPDATE clientes
          SET saldo_vencido = saldo_vencido + ?,
              sync_status   = 'pending',
              updated_at    = datetime('now')
          WHERE id = ?
        `).run(montoCuentaCorriente, transaccion.cuenta_cliente_id);
      }
    }

    return lastInsertRowid;
  });

  return getById(insert());
}

function getUltima(turnoId) {
  if (!turnoId) return null;
  return getDb()
    .prepare(`
      SELECT id FROM transacciones
      WHERE turno_id = ? AND estado != 'cancelada'
      ORDER BY id DESC LIMIT 1
    `)
    .get(turnoId) ?? null;
}

module.exports = { getAll, getById, getByFecha, getRecientes, create, getUltima };
