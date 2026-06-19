// Código QR obligatorio de ARCA (RG 4892) para comprobantes electrónicos.
//
// El QR codifica la URL  https://www.afip.gob.ar/fe/qr/?p=<base64>  donde el
// base64 es un JSON con los datos del comprobante. El ORDEN y los nombres de
// los campos son los de la especificación oficial (QRespecificaciones.pdf);
// validado reproduciendo el ejemplo oficial de ARCA byte por byte.
//
// Doc: https://www.afip.gob.ar/fe/qr/  ·  https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf

const URL_BASE = 'https://www.afip.gob.ar/fe/qr/';

// yyyymmdd → yyyy-mm-dd (la spec del QR usa formato RFC3339 full-date)
function fechaQR(yyyymmdd) {
  const s = String(yyyymmdd);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s; // ya viene con guiones
}

/**
 * Construye la URL del QR de ARCA a partir de los datos del comprobante.
 * @param {object} o
 * @param {number|string} o.cuit     CUIT del emisor
 * @param {number} o.ptoVta
 * @param {number} o.tipoCmp         tipo de comprobante (1/6/11/...)
 * @param {number} o.nroCmp          número del comprobante
 * @param {number} o.importe         importe total
 * @param {string} [o.moneda='PES']
 * @param {number} [o.ctz=1]         cotización
 * @param {number} [o.tipoDocRec]    tipo de doc del receptor (opcional)
 * @param {number|string} [o.nroDocRec] nro de doc del receptor (opcional)
 * @param {string} o.fecha          fecha de emisión (yyyymmdd o yyyy-mm-dd)
 * @param {number|string} o.cae     CAE
 * @returns {string} URL completa para el QR
 */
function construirUrl(o) {
  // El orden de las claves importa: debe coincidir con la spec de ARCA.
  const datos = {
    ver: 1,
    fecha: fechaQR(o.fecha),
    cuit: Number(o.cuit),
    ptoVta: Number(o.ptoVta),
    tipoCmp: Number(o.tipoCmp),
    nroCmp: Number(o.nroCmp),
    importe: Number(o.importe),
    moneda: o.moneda || 'PES',
    ctz: Number(o.ctz ?? 1),
  };
  if (o.tipoDocRec != null) datos.tipoDocRec = Number(o.tipoDocRec);
  if (o.nroDocRec != null)  datos.nroDocRec = Number(o.nroDocRec);
  datos.tipoCodAut = 'E';            // E = CAE (A sería CAEA)
  datos.codAut = Number(o.cae);

  const b64 = Buffer.from(JSON.stringify(datos), 'utf8').toString('base64');
  return `${URL_BASE}?p=${b64}`;
}

module.exports = { construirUrl, URL_BASE };
