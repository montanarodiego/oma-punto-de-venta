const Afip = require('@afipsdk/afip.js');
const fs   = require('fs');
const path = require('path');

// Instancia lazy — se crea la primera vez que se usa, no al cargar el módulo.
// Así el proceso main no se cae al arrancar si el token todavía no está configurado;
// el error queda atrapado por el try/catch de ipc.js y llega al renderer como { ok: false }.
let _afip = null;
function getAfip() {
  if (_afip) return _afip;
  const token = process.env.AFIP_ACCESS_TOKEN;
  if (!token) throw new Error('Falta configurar AFIP_ACCESS_TOKEN en el archivo .env');
  const cuit = parseInt(process.env.AFIP_CUIT || '20111111112', 10);
  const certPath = path.join(__dirname, '..', '..', '..', 'cert.crt');
  const keyPath  = path.join(__dirname, '..', '..', '..', 'private.key');
  if (!fs.existsSync(certPath)) throw new Error('Falta el archivo cert.crt en la raíz del proyecto');
  if (!fs.existsSync(keyPath))  throw new Error('Falta el archivo private.key en la raíz del proyecto');
  const cert = fs.readFileSync(certPath, 'utf8');
  const key  = fs.readFileSync(keyPath,  'utf8');
  _afip = new Afip({ CUIT: cuit, production: false, access_token: token, cert, key });
  return _afip;
}

// Enriquece errores de afip.js volcando todo lo que se pueda extraer del objeto.
// El interceptor axios del SDK rethrowea con err.status y err.data como props directas,
// NO bajo err.response — por eso se chequean en ambos lugares.
function afipErr(err) {
  console.error('[facturacion] error completo:', err);

  const status = err.status     ?? err.response?.status ?? null;
  const data   = err.data       ?? err.response?.data   ?? null;

  const parts = [err.message];
  if (status != null) parts.push(`HTTP ${status}`);
  if (data   != null) {
    parts.push(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    if (data && typeof data === 'object') {
      if (data.error)       parts.push(`error: ${data.error}`);
      if (data.message)     parts.push(`message: ${data.message}`);
      if (data.details)     parts.push(`details: ${JSON.stringify(data.details)}`);
      if (data.data_errors) parts.push(`data_errors: ${JSON.stringify(data.data_errors)}`);
    }
  }

  return Object.assign(
    new Error(parts.join(' | ')),
    { afipData: data, afipStatus: status }
  );
}

// Cola de serialización — evita dos pedidos de CAE en paralelo para el mismo PtoVta
let _caeQueue = Promise.resolve();
function serializarCAE(fn) {
  const result = _caeQueue.then(() => fn());
  _caeQueue = result.then(() => {}, () => {});
  return result;
}

async function estadoServidor() {
  try {
    return await getAfip().ElectronicBilling.getServerStatus();
  } catch (err) { throw afipErr(err); }
}

async function getUltimoComprobante() {
  try {
    return await getAfip().ElectronicBilling.getLastVoucher(1, 11);
  } catch (err) { throw afipErr(err); }
}

async function emitirFacturaC(importeTotal) {
  return serializarCAE(async () => {
    const fecha = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    try { return await getAfip().ElectronicBilling.createNextVoucher({
      CantReg:    1,
      PtoVta:     1,
      CbteTipo:   11,
      Concepto:   1,
      DocTipo:    99,
      DocNro:     0,
      CbteFch:    fecha,
      ImpTotal:   importeTotal,
      ImpTotConc: 0,
      ImpNeto:    importeTotal,
      ImpOpEx:    0,
      ImpIVA:     0,
      ImpTrib:    0,
      MonId:      'PES',
      MonCotiz:   1,
      CondicionIVAReceptorId: 5,
    }); } catch (err) { throw afipErr(err); }
  });
}

module.exports = { estadoServidor, getUltimoComprobante, emitirFacturaC };
