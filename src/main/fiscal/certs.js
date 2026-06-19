// Gestión del certificado fiscal por comercio (Fase 6 — onboarding).
//
// Flujo: la app genera el par de claves + el CSR (sin que el comercio toque
// OpenSSL), guía a subir el CSR a ARCA, y luego importa el .crt devuelto. La
// clave privada NUNCA sale de la máquina y se guarda cifrada (atada a la
// instalación). El cert se asocia al web service "wsfe" desde el Administrador
// de Relaciones de ARCA (eso es manual, fuera de la app).
//
// Doc ARCA: https://www.afip.gob.ar/ws/documentacion/certificados.asp

const fs    = require('fs');
const path  = require('path');
const { app } = require('electron');
const { generateKeyPairSync } = require('crypto');
const forge = require('node-forge');
const { encriptarLocal, desencriptarLocal } = require('../sync');

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'fiscal-config.json');
const CRED_FILE   = () => path.join(app.getPath('userData'), 'fiscal-cred.json');

const CONFIG_DEFAULT = {
  cuit: '', razonSocial: '', condicionFiscal: 'monotributo',
  ptoVenta: 1, ambiente: 'homologacion', alias: '',
};

// ── Config (no sensible): se guarda en claro ──
function obtenerConfig() {
  try { return { ...CONFIG_DEFAULT, ...JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8')) }; }
  catch { return { ...CONFIG_DEFAULT }; }
}
function guardarConfig(parcial) {
  const cfg = { ...obtenerConfig(), ...parcial };
  cfg.ptoVenta = parseInt(cfg.ptoVenta || 1, 10);
  cfg.cuit = String(cfg.cuit || '').replace(/\D/g, '');
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2), 'utf8');
  return cfg;
}

// ── Credenciales (sensibles): se guardan cifradas ──
function _leerCred() {
  try {
    const raw = JSON.parse(fs.readFileSync(CRED_FILE(), 'utf8'));
    return {
      key:  raw.keyEnc  ? desencriptarLocal(raw.keyEnc)  : null,
      cert: raw.certEnc ? desencriptarLocal(raw.certEnc) : null,
    };
  } catch { return { key: null, cert: null }; }
}
function _guardarCred({ key, cert }) {
  const out = {};
  if (key  != null) out.keyEnc  = encriptarLocal(key);
  if (cert != null) out.certEnc = encriptarLocal(cert);
  fs.writeFileSync(CRED_FILE(), JSON.stringify(out), 'utf8');
}

// Genera clave privada (RSA 2048) + CSR. Guarda la clave cifrada; NO toca el cert.
// Devuelve el CSR en PEM para que el comercio lo suba a ARCA.
function generarCSR({ cuit, razonSocial, alias }) {
  const cuitLimpio = String(cuit || '').replace(/\D/g, '');
  if (cuitLimpio.length !== 11) throw new Error('El CUIT debe tener 11 dígitos');
  if (!razonSocial) throw new Error('Falta la razón social');
  const aliasFinal = (alias || `oma_${cuitLimpio}`).trim();

  // Clave nativa (rápida, no bloquea), en PKCS#1 para que la lea node-forge y WSAA.
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding:  { type: 'pkcs1', format: 'pem' },
  });

  const fKey = forge.pki.privateKeyFromPem(privateKey);
  const fPub = forge.pki.setRsaPublicKey(fKey.n, fKey.e);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = fPub;
  csr.setSubject([
    { shortName: 'C', value: 'AR' },
    { shortName: 'O', value: razonSocial },
    { shortName: 'CN', value: aliasFinal },
    { type: '2.5.4.5', value: `CUIT ${cuitLimpio}` }, // serialNumber, como exige ARCA
  ]);
  csr.sign(fKey, forge.md.sha256.create());
  const csrPem = forge.pki.certificationRequestToPem(csr);

  // Persistir: guardamos la clave (cert queda null hasta importar) + datos
  _guardarCred({ key: privateKey, cert: null });
  guardarConfig({ cuit: cuitLimpio, razonSocial, alias: aliasFinal });

  return { csrPem, alias: aliasFinal };
}

// Importa el .crt devuelto por ARCA. Valida que sea un X.509 y que su clave
// pública coincida con la clave privada generada. Guarda el cert cifrado.
function importarCertificado(certPem) {
  const { key } = _leerCred();
  if (!key) throw new Error('Primero generá la solicitud (CSR): no hay clave privada guardada');

  let cert;
  try { cert = forge.pki.certificateFromPem(certPem); }
  catch { throw new Error('El archivo no es un certificado X.509 válido (.crt/.pem)'); }

  const fKey = forge.pki.privateKeyFromPem(key);
  const coincide = cert.publicKey.n.equals(fKey.n) && cert.publicKey.e.compareTo(fKey.e) === 0;
  if (!coincide) throw new Error('El certificado no corresponde a la clave generada en esta PC. ¿Subiste el CSR correcto a ARCA?');

  _guardarCred({ key, cert: certPem });
  return infoCert(cert);
}

function infoCert(cert) {
  const cn = cert.subject.getField('CN');
  return {
    subject: cn ? cn.value : '',
    emisor: (cert.issuer.getField('CN') || {}).value || '',
    desde: cert.validity.notBefore,
    vencimiento: cert.validity.notAfter,
  };
}

// Devuelve { cert, key } para emitir, o null si no está completo.
function cargarCredenciales() {
  const { key, cert } = _leerCred();
  if (!key || !cert) return null;
  return { key, cert };
}

// Estado para la UI (sin exponer la clave privada).
function estado() {
  const config = obtenerConfig();
  const { key, cert } = _leerCred();
  let estadoCert = 'sin_solicitar';
  let certInfo = null;
  if (key && !cert) estadoCert = 'csr_pendiente';
  if (key && cert) {
    estadoCert = 'activo';
    try { certInfo = infoCert(forge.pki.certificateFromPem(cert)); } catch { /* cert corrupto */ }
  }
  return { config, estadoCert, cert: certInfo };
}

// Borra el certificado (deja la config). Para rehacer el onboarding.
function limpiarCertificado() {
  try { fs.unlinkSync(CRED_FILE()); } catch { /* no existe */ }
  return { ok: true };
}

module.exports = {
  obtenerConfig, guardarConfig, generarCSR, importarCertificado,
  cargarCredenciales, estado, limpiarCertificado,
};
