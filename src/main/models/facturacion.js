// Orquestación de la emisión de comprobantes fiscales en la venta.
//
// Une las piezas del módulo fiscal directo (sin afipsdk):
//   certs.js        → certificado + clave + config del comercio (CUIT, ambiente, ptoVenta)
//   fiscal/*        → WSAA + WSFEv1 + armado del comprobante (A/B/C, IVA, QR)
//   comprobantes.js → persistencia legal del CAE en SQLite
//
// El emisor (CUIT, producción/homologación, condición fiscal, punto de venta) NUNCA
// se hardcodea: sale del onboarding fiscal que cargó el comercio. Así cada instalación
// factura con SU propio certificado y en SU ambiente real.

const { app }      = require('electron');
const Certs        = require('../fiscal/certs');
const comprobante  = require('../fiscal/comprobante');
const wsfe         = require('../fiscal/wsfev1');
const Comprobantes = require('./comprobantes');

// Arma el emisor desde el onboarding. Lanza errores claros (los ve el cajero) si
// falta algo, en vez de emitir con datos por defecto inválidos.
function _emisor() {
  const cred = Certs.cargarCredenciales();
  if (!cred) throw new Error('No hay un certificado fiscal activo. Completá el onboarding fiscal en Configuración.');
  const cfg = Certs.obtenerConfig();
  if (!cfg.cuit || String(cfg.cuit).length !== 11) {
    throw new Error('Falta configurar el CUIT del emisor en el onboarding fiscal.');
  }
  return {
    cert:       cred.cert,
    key:        cred.key,
    cuit:       cfg.cuit,
    condicion:  cfg.condicionFiscal,            // 'monotributo' | 'responsable_inscripto'
    ptoVenta:   cfg.ptoVenta,
    production: cfg.ambiente === 'produccion',
  };
}

// Cola de serialización: ARCA numera por (PtoVta, CbteTipo); dos pedidos de CAE en
// paralelo pelean por el mismo número. Serializamos para no chocar (error 10016).
let _caeQueue = Promise.resolve();
function _serial(fn) {
  const r = _caeQueue.then(() => fn());
  _caeQueue = r.then(() => {}, () => {});
  return r;
}

// Estado de los servidores de ARCA (FEDummy) en el ambiente configurado.
async function estadoServidor() {
  const emisor = _emisor();
  return wsfe.dummy(emisor.production);
}

/**
 * Emite el comprobante fiscal de una venta ya registrada y lo persiste.
 * @param {object} o
 * @param {number} [o.transaccionId]  Para asociar e idempotencia (no re-emite si ya hay).
 * @param {number} o.total            Total cobrado (se usa tal cual para Factura C).
 * @param {Array}  [o.items]          [{ importe, tasaIva }] — sólo para Responsable Inscripto (A/B).
 * @param {object} [o.receptor]       { condicionIVAId, docTipo, docNro } — default consumidor final.
 * @returns {Promise<object>}  El registro guardado en comprobantes_fiscales.
 */
async function emitir({ transaccionId, total, items, receptor } = {}) {
  return _serial(async () => {
    const emisor = _emisor();

    // Idempotencia: si la venta ya tiene comprobante, devolverlo en vez de duplicar
    // (un reintento del cajero no debe pedir un CAE nuevo).
    if (transaccionId != null) {
      const ya = Comprobantes.obtenerPorTransaccion(transaccionId);
      if (ya) return ya;
    }

    // Monotributo → Factura C: no discrimina IVA, una sola línea con el total exacto
    // cobrado (evita descuadres por redondeo). Responsable Inscripto → desglose real
    // por línea con su tasa de IVA para que A/B salgan correctas.
    let lineas;
    if (emisor.condicion === 'responsable_inscripto' && Array.isArray(items) && items.length) {
      lineas = items.map(it => ({ importe: Number(it.importe || 0), tasaIva: Number(it.tasaIva || 0) }));
    } else {
      lineas = [{ importe: Number(total || 0), tasaIva: 0 }];
    }

    const r = await comprobante.emitir({
      emisor,
      receptor: receptor || null,
      items: lineas,
      cacheDir: app.getPath('userData'),
    });

    return Comprobantes.guardar({ ...r, transaccionId: transaccionId ?? null });
  });
}

module.exports = { estadoServidor, emitir };
