// Activación de licencia vía custom token (modelo nuevo, reemplaza la cuenta de
// sync compartida de oma-creds.json).
//
// Flujo: el desktop guarda un `licenseKey` secreto (no adivinable) y se lo manda
// al endpoint /api/activar de OMA Manager. El server valida la licencia contra el
// proyecto omatechpos y devuelve un custom token de Firebase scopeado al negocio.
// El desktop hace signInWithCustomToken con ese token.
//
// El licenseKey se guarda cifrado con safeStorage (DPAPI en Windows) en userData.
// Durante la transición también se acepta `license_key` desde oma-creds.json, para
// poder provisionar/testear sin la pantalla de onboarding todavía.

const { app, safeStorage } = require('electron');
const path = require('path');
const fs   = require('fs');
const { signInWithCustomToken } = require('firebase/auth');

// URL del endpoint de activación. Configurable por env o por oma-creds.activar_url;
// el default debe apuntar al deploy real de OMA Manager en Vercel.
function _activarUrl() {
  if (process.env.OMA_ACTIVAR_URL) return process.env.OMA_ACTIVAR_URL;
  try {
    const creds = require('./credentials');
    if (creds.activar_url) return creds.activar_url;
  } catch {}
  return 'https://oma-manager.vercel.app/api/activar';
}

function _keyPath() {
  return path.join(app.getPath('userData'), 'oma-license-key');
}

// Guarda el licenseKey cifrado en userData. Usa safeStorage (OS keychain/DPAPI);
// si no está disponible, cae a texto plano con prefijo PLAIN: (mejor que embeberlo
// en el installer, pero safeStorage está disponible en Windows/macOS normalmente).
function guardarLicenseKey(key) {
  if (!key || typeof key !== 'string') throw new Error('licenseKey inválido.');
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key)
    : Buffer.from('PLAIN:' + key, 'utf8');
  fs.writeFileSync(_keyPath(), buf);
}

function _leerLicenseKeyStore() {
  try {
    const buf = fs.readFileSync(_keyPath());
    if (buf.slice(0, 6).toString('utf8') === 'PLAIN:') return buf.slice(6).toString('utf8');
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
    return null;
  } catch {
    return null;
  }
}

// Devuelve el licenseKey: primero del store cifrado, luego de oma-creds.json
// (mecanismo de transición). null si no hay ninguno → se usa el modelo viejo.
function leerLicenseKey() {
  const fromStore = _leerLicenseKeyStore();
  if (fromStore) return fromStore;
  try {
    const creds = require('./credentials');
    if (creds.license_key) return creds.license_key;
  } catch {}
  return null;
}

// POST /api/activar { licenseKey } → { token, negocioId, vencimiento }.
// Luego signInWithCustomToken. Lanza si la licencia es inválida/suspendida/vencida
// o si no hay red. Timeout de 10s para no colgar el arranque offline.
async function activar(authInst, licenseKey) {
  const resp = await fetch(_activarUrl(), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ licenseKey }),
    signal:  AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    let msg = 'Activación rechazada.';
    try { const j = await resp.json(); if (j && j.error) msg = j.error; } catch {}
    const err = new Error(msg);
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  if (!data || !data.token || !data.negocioId) {
    throw new Error('Respuesta de activación inválida.');
  }

  await signInWithCustomToken(authInst, data.token);
  return { negocioId: data.negocioId, vencimiento: data.vencimiento ?? null };
}

module.exports = { leerLicenseKey, guardarLicenseKey, activar };
