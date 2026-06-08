const { getDb } = require('../database');

function nowIso() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function obtenerActivo() {
  return getDb().prepare(`
    SELECT * FROM turnos
    WHERE estado = 'abierto'
    ORDER BY id DESC LIMIT 1
  `).get() ?? null;
}

function abrir(efectivoInicial) {
  const db = getDb();

  // Auto-cerrar cualquier turno abierto de un día anterior (vencido)
  const vencido = db.prepare(`
    SELECT id FROM turnos
    WHERE estado = 'abierto'
      AND DATE(fecha_apertura, 'localtime') < DATE('now', 'localtime')
    ORDER BY id DESC LIMIT 1
  `).get();
  if (vencido) {
    db.prepare("UPDATE turnos SET estado = 'cerrado', fecha_cierre = datetime('now') WHERE id = ?")
      .run(vencido.id);
  }

  if (obtenerActivo()) throw new Error('Ya hay un turno activo. Cerrá el turno actual antes de abrir uno nuevo.');
  const info = db
    .prepare("INSERT INTO turnos (efectivo_inicial, estado) VALUES (?, 'abierto')")
    .run(efectivoInicial ?? 0);
  return db.prepare('SELECT * FROM turnos WHERE id = ?').get(info.lastInsertRowid);
}

function calcularResumen(turnoId) {
  const db    = getDb();
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(turnoId);
  if (!turno) throw new Error('Turno no encontrado');

  // Para pagos mixtos: monto_pago_2 corresponde a forma_pago_2;
  //   monto de forma_pago = monto_total - COALESCE(monto_pago_2, 0)
  const r = db.prepare(`
    SELECT
      COUNT(*) AS total_transacciones,
      COALESCE(SUM(monto_total), 0) AS total_ventas,
      COALESCE(SUM(
        CASE WHEN forma_pago = 'efectivo'
          THEN CASE WHEN forma_pago_2 IS NOT NULL THEN monto_total - COALESCE(monto_pago_2,0) ELSE monto_total END
             WHEN forma_pago_2 = 'efectivo' THEN COALESCE(monto_pago_2,0) ELSE 0 END
      ), 0) AS ventas_efectivo,
      COALESCE(SUM(
        CASE WHEN forma_pago = 'tarjeta_debito'
          THEN CASE WHEN forma_pago_2 IS NOT NULL THEN monto_total - COALESCE(monto_pago_2,0) ELSE monto_total END
             WHEN forma_pago_2 = 'tarjeta_debito' THEN COALESCE(monto_pago_2,0) ELSE 0 END
      ), 0) AS ventas_debito,
      COALESCE(SUM(
        CASE WHEN forma_pago = 'tarjeta_credito'
          THEN CASE WHEN forma_pago_2 IS NOT NULL THEN monto_total - COALESCE(monto_pago_2,0) ELSE monto_total END
             WHEN forma_pago_2 = 'tarjeta_credito' THEN COALESCE(monto_pago_2,0) ELSE 0 END
      ), 0) AS ventas_credito,
      COALESCE(SUM(
        CASE WHEN forma_pago = 'transferencia'
          THEN CASE WHEN forma_pago_2 IS NOT NULL THEN monto_total - COALESCE(monto_pago_2,0) ELSE monto_total END
             WHEN forma_pago_2 = 'transferencia' THEN COALESCE(monto_pago_2,0) ELSE 0 END
      ), 0) AS ventas_transferencia,
      COALESCE(SUM(
        CASE WHEN forma_pago = 'cuenta_corriente'
          THEN CASE WHEN forma_pago_2 IS NOT NULL THEN monto_total - COALESCE(monto_pago_2,0) ELSE monto_total END
             WHEN forma_pago_2 = 'cuenta_corriente' THEN COALESCE(monto_pago_2,0) ELSE 0 END
      ), 0) AS ventas_cuenta_corriente,
      COALESCE(SUM(descuento_global), 0) AS total_descuentos,
      COALESCE(SUM(propina), 0)          AS total_propinas
    FROM transacciones
    WHERE turno_id = ?
      AND (estado IS NULL OR estado != 'cancelada')
  `).get(turnoId);

  const mov = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='entrada' THEN monto ELSE 0 END), 0) AS total_entradas,
      COALESCE(SUM(CASE WHEN tipo='salida'  THEN monto ELSE 0 END), 0) AS total_salidas
    FROM movimientos_caja WHERE turno_id = ? AND (cancelado IS NULL OR cancelado = 0)
  `).get(turnoId);

  const efectivoEsperado =
    (turno.efectivo_inicial ?? 0) +
    r.ventas_efectivo +
    (mov?.total_entradas ?? 0) -
    (mov?.total_salidas  ?? 0);

  return {
    ...turno,
    ...r,
    total_entradas:    mov?.total_entradas ?? 0,
    total_salidas:     mov?.total_salidas  ?? 0,
    efectivo_esperado: efectivoEsperado,
    total_propinas:    r.total_propinas    ?? 0,
  };
}

function cerrar(turnoId, efectivoReal, notas) {
  const db      = getDb();
  const resumen = calcularResumen(turnoId);
  const efectivoEsperado = resumen.efectivo_esperado;
  const diferencia       = (efectivoReal ?? 0) - efectivoEsperado;
  const ahora            = nowIso();

  db.prepare(`
    UPDATE turnos SET
      fecha_cierre            = ?,
      efectivo_real           = ?,
      efectivo_esperado       = ?,
      diferencia              = ?,
      total_ventas            = ?,
      total_transacciones     = ?,
      ventas_efectivo         = ?,
      ventas_debito           = ?,
      ventas_credito          = ?,
      ventas_transferencia    = ?,
      ventas_cuenta_corriente = ?,
      notas                   = ?,
      estado                  = 'cerrado'
    WHERE id = ?
  `).run(
    ahora,
    efectivoReal ?? 0,
    efectivoEsperado,
    diferencia,
    resumen.total_ventas,
    resumen.total_transacciones,
    resumen.ventas_efectivo,
    resumen.ventas_debito,
    resumen.ventas_credito,
    resumen.ventas_transferencia,
    resumen.ventas_cuenta_corriente,
    notas ?? '',
    turnoId,
  );

  return db.prepare('SELECT * FROM turnos WHERE id = ?').get(turnoId);
}

function historial(limite) {
  return getDb()
    .prepare('SELECT * FROM turnos ORDER BY id DESC LIMIT ?')
    .all(limite ?? 30);
}

function detalle(id) {
  const db    = getDb();
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(id);
  if (!turno) return null;

  const transacciones = db.prepare(`
    SELECT * FROM transacciones
    WHERE turno_id = ?
    ORDER BY id DESC
  `).all(id);

  return { turno, transacciones };
}

module.exports = { obtenerActivo, abrir, calcularResumen, cerrar, historial, detalle };
