// Persistencia de comprobantes fiscales autorizados por ARCA (Fase 4).
// Guarda el resultado de comprobante.emitir() para reimpresión y respaldo legal.
const { getDb } = require('../database');

// Guarda un comprobante. `c` es lo que devuelve fiscal/comprobante.emitir(),
// más transaccionId y qrUrl (fiscal/qr.construirUrl). Devuelve el registro guardado.
function guardar(c) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO comprobantes_fiscales
      (transaccion_id, cuit_emisor, pto_venta, cbte_tipo, cbte_nro, cae, cae_vto,
       cbte_fch, doc_tipo, doc_nro, cond_iva_receptor, imp_neto, imp_iva, imp_total,
       moneda, cotizacion, alicuotas_json, qr_url, ambiente)
    VALUES
      (@transaccion_id, @cuit_emisor, @pto_venta, @cbte_tipo, @cbte_nro, @cae, @cae_vto,
       @cbte_fch, @doc_tipo, @doc_nro, @cond_iva_receptor, @imp_neto, @imp_iva, @imp_total,
       @moneda, @cotizacion, @alicuotas_json, @qr_url, @ambiente)
  `).run({
    transaccion_id:    c.transaccionId ?? null,
    cuit_emisor:       String(c.cuitEmisor),
    pto_venta:         c.ptoVta,
    cbte_tipo:         c.tipo,
    cbte_nro:          c.nro,
    cae:               c.cae,
    cae_vto:           c.caeVto,
    cbte_fch:          c.cbteFch,
    doc_tipo:          c.docTipo,
    doc_nro:           String(c.docNro ?? 0),
    cond_iva_receptor: c.condicionIVAId,
    imp_neto:          c.neto,
    imp_iva:           c.iva,
    imp_total:         c.total,
    moneda:            c.moneda ?? 'PES',
    cotizacion:        c.cotizacion ?? 1,
    alicuotas_json:    c.alicuotas ? JSON.stringify(c.alicuotas) : null,
    qr_url:            c.qrUrl,
    ambiente:          c.production ? 'produccion' : 'homologacion',
  });
  return getById(info.lastInsertRowid);
}

function getById(id) {
  return getDb().prepare('SELECT * FROM comprobantes_fiscales WHERE id = ?').get(id);
}

function obtenerPorTransaccion(transaccionId) {
  return getDb()
    .prepare('SELECT * FROM comprobantes_fiscales WHERE transaccion_id = ? ORDER BY id DESC LIMIT 1')
    .get(transaccionId);
}

module.exports = { guardar, getById, obtenerPorTransaccion };
