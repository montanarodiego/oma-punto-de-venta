// WSAA — Web Service de Autenticación y Autorización de ARCA.
//
// Implementación DIRECTA contra ARCA (sin intermediarios tipo afipsdk): armamos
// el Login Ticket Request (LTR), lo firmamos como CMS/PKCS#7 con el cert+key del
// comercio (node-forge, JS puro — sin binarios nativos, ideal para Electron) y lo
// mandamos al endpoint LoginCms por SOAP. ARCA devuelve un Ticket de Acceso (TA)
// con token + sign que vale 12 hs y habilita las llamadas a WSFEv1.
//
// Doc oficial: https://www.afip.gob.ar/ws/documentacion/wsaa.asp
//
// REGLA CRÍTICA: ARCA RECHAZA pedir un TA nuevo si ya hay uno vigente para el
// mismo (CUIT + service). Por eso cacheamos el TA en memoria y en disco y sólo
// pedimos uno nuevo cuando está por vencer. Pedir TA en cada factura = bloqueo.

const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const axios = require('axios');
const forge = require('node-forge');

const ENDPOINTS = {
  homo: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
  prod: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
};

// Margen de seguridad: renovamos el TA si le quedan menos de 10 min de vida.
const MARGEN_MS = 10 * 60 * 1000;

// Cache en memoria por clave `service:cuit:env` → { token, sign, expiration(ms) }
const _memo = new Map();

// ── Fechas ISO 8601 con offset local (-03:00 en AR). ARCA es quisquilloso con
//    el formato; usar offset local es lo más compatible históricamente. ──
function isoConOffset(date) {
  const off = -date.getTimezoneOffset(); // minutos; AR = +180? no: getTimezoneOffset da +180 → off=-180
  const signo = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
         `T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}${signo}${hh}:${mm}`;
}

// ── Login Ticket Request: XML que pide acceso a un service (wsfe) ──
function armarLTR(service) {
  const ahora = new Date();
  const gen = new Date(ahora.getTime() - 10 * 60 * 1000); // -10 min
  const exp = new Date(ahora.getTime() + 10 * 60 * 1000); // +10 min
  const uniqueId = Math.floor(ahora.getTime() / 1000);    // segundos epoch
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${isoConOffset(gen)}</generationTime>
    <expirationTime>${isoConOffset(exp)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

// ── Firma CMS/PKCS#7 (SHA-256), no-detached, en base64 ──
function firmarCMS(ltrXml, certPem, keyPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const key  = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(ltrXml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: false });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

function envelopeLoginCms(cmsB64) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsB64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function desescaparXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&amp;/g, '&');
}

function extraer(tag, xml) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : null;
}

// Ruta del archivo de cache del TA en disco.
function rutaCache(cacheDir, service, cuit, env) {
  const dir = cacheDir || os.tmpdir();
  return path.join(dir, `wsaa-ta-${service}-${cuit}-${env}.json`);
}

function leerCacheDisco(file) {
  try {
    const ta = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (ta && ta.expiration && ta.expiration - Date.now() > MARGEN_MS) return ta;
  } catch { /* no existe o corrupto */ }
  return null;
}

/**
 * Obtiene un Ticket de Acceso (TA) válido para `service`, reusando cache si hay.
 * @param {object} o
 * @param {string} o.cert  Certificado X.509 en PEM
 * @param {string} o.key   Clave privada en PEM
 * @param {string|number} o.cuit  CUIT del emisor (sólo para la clave de cache)
 * @param {boolean} [o.production=false]
 * @param {string}  [o.service='wsfe']
 * @param {string}  [o.cacheDir]  Carpeta para persistir el TA (userData en Electron)
 * @returns {Promise<{token:string, sign:string, expiration:number, cuit:string}>}
 */
async function obtenerTA({ cert, key, cuit, production = false, service = 'wsfe', cacheDir } = {}) {
  if (!cert || !key) throw new Error('WSAA: faltan el certificado y/o la clave privada');
  const env = production ? 'prod' : 'homo';
  const memoKey = `${service}:${cuit}:${env}`;

  // 1) cache en memoria
  const enMemo = _memo.get(memoKey);
  if (enMemo && enMemo.expiration - Date.now() > MARGEN_MS) return enMemo;

  // 2) cache en disco
  const file = rutaCache(cacheDir, service, cuit, env);
  const enDisco = leerCacheDisco(file);
  if (enDisco) { _memo.set(memoKey, enDisco); return enDisco; }

  // 3) pedir TA nuevo a ARCA
  const ltr = armarLTR(service);
  const cms = firmarCMS(ltr, cert, key);
  const soap = envelopeLoginCms(cms);

  let resp;
  try {
    resp = await axios.post(ENDPOINTS[env], soap, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
      timeout: 30000,
    });
  } catch (err) {
    // ARCA devuelve los errores como soap:Fault con HTTP 500
    const body = err.response?.data ? String(err.response.data) : '';
    const fault = extraer('faultstring', body);
    throw new Error(`WSAA ${env}: ${fault || err.message}`);
  }

  const body = String(resp.data);
  const ret = extraer('loginCmsReturn', body);
  if (!ret) throw new Error(`WSAA ${env}: respuesta sin loginCmsReturn — ${body.slice(0, 400)}`);

  const tr = desescaparXml(ret);
  const token = extraer('token', tr);
  const sign  = extraer('sign', tr);
  const expStr = extraer('expirationTime', tr);
  if (!token || !sign) throw new Error(`WSAA ${env}: TA sin token/sign — ${tr.slice(0, 400)}`);

  const ta = { token, sign, expiration: expStr ? new Date(expStr).getTime() : Date.now() + 12 * 3600 * 1000, cuit: String(cuit) };

  // persistir
  _memo.set(memoKey, ta);
  try { fs.writeFileSync(file, JSON.stringify(ta), 'utf8'); } catch { /* best-effort */ }

  return ta;
}

module.exports = { obtenerTA, ENDPOINTS, _internos: { armarLTR, firmarCMS, isoConOffset } };
