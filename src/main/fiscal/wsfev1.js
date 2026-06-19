// WSFEv1 — Web Service de Facturación Electrónica de ARCA (RG 4291).
//
// Implementación DIRECTA por SOAP, sin intermediarios. Usa el Ticket de Acceso
// (TA) que entrega wsaa.js. Endpoints y estructura tomados del manual oficial:
//   homologación: https://wswhomo.afip.gov.ar/wsfev1/service.asmx
//   producción:   https://servicios1.afip.gov.ar/wsfev1/service.asmx
//   manual: afip.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf
//
// Métodos implementados: FEDummy (estado), FECompUltimoAutorizado (último nro),
// FECAESolicitar (pedir CAE). El armado del comprobante (tipos A/B/C, IVA) vive
// en comprobante.js (Fase 3); acá sólo va la plomería SOAP + parseo.

const axios = require('axios');

const NS  = 'http://ar.gov.afip.dif.FEV1/';
const ENDPOINTS = {
  homo: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  prod: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
};

// ── parseo XML por regex (respuestas de ARCA son planas y estables) ──
function uno(tag, xml) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}
function bloque(tag, xml) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : '';
}
function todos(tag, xml) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const out = []; let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
function pares(xml) { // extrae {Code, Msg} de un bloque
  return { code: uno('Code', xml), msg: uno('Msg', xml) };
}

// POST SOAP genérico. `inner` es el XML interno del método (sin el envelope).
async function llamar(method, inner, production) {
  const env = production ? 'prod' : 'homo';
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${NS}">
  <soap:Body>
    <ar:${method}>${inner}</ar:${method}>
  </soap:Body>
</soap:Envelope>`;
  let resp;
  try {
    resp = await axios.post(ENDPOINTS[env], soap, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': `${NS}${method}` },
      timeout: 30000,
    });
  } catch (err) {
    const body = err.response?.data ? String(err.response.data) : '';
    const fault = uno('faultstring', body);
    throw new Error(`WSFEv1 ${method} (${env}): ${fault || err.message}`);
  }
  if (process.env.WSFE_DEBUG) console.error(`\n[wsfe raw ${method}]\n`, String(resp.data), '\n');
  return String(resp.data);
}

function authXml(ta, cuit) {
  return `<ar:Auth><ar:Token>${ta.token}</ar:Token><ar:Sign>${ta.sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`;
}

// Lanza si la respuesta trae <Errors><Err>. Devuelve el XML tal cual si está limpia.
function chequearErrores(xml, method) {
  const errBlock = bloque('Errors', xml);
  const errs = todos('Err', errBlock).map(pares).filter(e => e.code || e.msg);
  if (errs.length) {
    const e = new Error(`WSFEv1 ${method}: ${errs.map(x => `[${x.code}] ${x.msg}`).join(' | ')}`);
    e.afipErrors = errs;
    throw e;
  }
  return xml;
}

// ── FEDummy: estado de los servidores (no requiere auth) ──
async function dummy(production = false) {
  const xml = await llamar('FEDummy', '', production);
  return {
    appServer:  uno('AppServer', xml),
    dbServer:   uno('DbServer', xml),
    authServer: uno('AuthServer', xml),
  };
}

// ── FECompUltimoAutorizado: último nro autorizado para (PtoVta, CbteTipo) ──
async function ultimoAutorizado({ ta, cuit, ptoVta, cbteTipo, production = false }) {
  const inner = `${authXml(ta, cuit)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo>`;
  const xml = chequearErrores(await llamar('FECompUltimoAutorizado', inner, production), 'FECompUltimoAutorizado');
  return parseInt(uno('CbteNro', xml) || '0', 10);
}

// ── FECAESolicitar: pide el CAE para UN comprobante ──
// cab: { PtoVta, CbteTipo }
// det: { Concepto, DocTipo, DocNro, CbteDesde, CbteHasta, CbteFch, ImpTotal,
//        ImpTotConc, ImpNeto, ImpOpEx, ImpTrib, ImpIVA, MonId, MonCotiz,
//        CondicionIVAReceptorId, Iva:[{Id,BaseImp,Importe}] }
async function solicitarCAE({ ta, cuit, cab, det, production = false }) {
  const ivaXml = (det.Iva && det.Iva.length)
    ? `<ar:Iva>${det.Iva.map(a =>
        `<ar:AlicIva><ar:Id>${a.Id}</ar:Id><ar:BaseImp>${a.BaseImp}</ar:BaseImp><ar:Importe>${a.Importe}</ar:Importe></ar:AlicIva>`
      ).join('')}</ar:Iva>`
    : '';

  const inner = `${authXml(ta, cuit)}
<ar:FeCAEReq>
  <ar:FeCabReq>
    <ar:CantReg>1</ar:CantReg>
    <ar:PtoVta>${cab.PtoVta}</ar:PtoVta>
    <ar:CbteTipo>${cab.CbteTipo}</ar:CbteTipo>
  </ar:FeCabReq>
  <ar:FeDetReq>
    <ar:FECAEDetRequest>
      <ar:Concepto>${det.Concepto}</ar:Concepto>
      <ar:DocTipo>${det.DocTipo}</ar:DocTipo>
      <ar:DocNro>${det.DocNro}</ar:DocNro>
      <ar:CbteDesde>${det.CbteDesde}</ar:CbteDesde>
      <ar:CbteHasta>${det.CbteHasta}</ar:CbteHasta>
      <ar:CbteFch>${det.CbteFch}</ar:CbteFch>
      <ar:ImpTotal>${det.ImpTotal}</ar:ImpTotal>
      <ar:ImpTotConc>${det.ImpTotConc}</ar:ImpTotConc>
      <ar:ImpNeto>${det.ImpNeto}</ar:ImpNeto>
      <ar:ImpOpEx>${det.ImpOpEx}</ar:ImpOpEx>
      <ar:ImpTrib>${det.ImpTrib}</ar:ImpTrib>
      <ar:ImpIVA>${det.ImpIVA}</ar:ImpIVA>
      <ar:MonId>${det.MonId}</ar:MonId>
      <ar:MonCotiz>${det.MonCotiz}</ar:MonCotiz>
      <ar:CondicionIVAReceptorId>${det.CondicionIVAReceptorId}</ar:CondicionIVAReceptorId>
      ${ivaXml}
    </ar:FECAEDetRequest>
  </ar:FeDetReq>
</ar:FeCAEReq>`;

  const xml = chequearErrores(await llamar('FECAESolicitar', inner, production), 'FECAESolicitar');

  // Ojo: el manual dice <FEDetResponse> pero la respuesta REAL usa <FECAEDetResponse>.
  const det0 = bloque('FECAEDetResponse', xml);
  const resultado = uno('Resultado', det0) || uno('Resultado', xml); // A=aprobado, R=rechazado
  const obs = todos('Observaciones', bloque('Obs', det0)).map(pares).filter(o => o.code || o.msg);

  if (resultado !== 'A') {
    const msg = obs.length ? obs.map(o => `[${o.code}] ${o.msg}`).join(' | ') : 'rechazado sin observaciones';
    const e = new Error(`WSFEv1 FECAESolicitar: comprobante RECHAZADO — ${msg}`);
    e.observaciones = obs;
    throw e;
  }

  return {
    resultado,
    cae:    uno('CAE', det0),
    caeVto: uno('CAEFchVto', det0), // yyyymmdd
    nro:    parseInt(uno('CbteHasta', det0) || '0', 10),
    cbteFch: uno('CbteFch', det0),
    observaciones: obs,
  };
}

module.exports = { dummy, ultimoAutorizado, solicitarCAE, ENDPOINTS };
