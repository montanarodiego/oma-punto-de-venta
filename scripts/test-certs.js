// Prueba de onboarding del certificado (Fase 6) sin Electron.
// Mockea el módulo 'electron' para que app.getPath apunte a un temp dir.
//   node scripts/test-certs.js
const Module = require('module');
const os = require('os'), path = require('path'), fs = require('fs');
const { generateKeyPairSync } = require('crypto');
const forge = require('node-forge');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oma-fiscal-'));
const orig = Module._load;
Module._load = function (req) {
  if (req === 'electron') return { app: { getPath: () => tmp } };
  return orig.apply(this, arguments);
};

const certs = require('../src/main/fiscal/certs');

function buscarSerial(subject) {
  const a = subject.attributes.find(x => x.type === '2.5.4.5');
  return a ? a.value : null;
}

// Simula a ARCA: firma un cert X.509 para una publicKey dada con una CA propia.
function emitirCertFalso(publicKey) {
  const ca = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01');
  cert.validity.notAfter = new Date('2028-01-01');
  cert.setSubject([{ shortName: 'CN', value: 'oma_test' }]);
  cert.setIssuer([{ shortName: 'CN', value: 'AC FAKE ARCA' }]);
  cert.sign(ca.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

let fallos = 0;
const check = (cond, msg) => { console.log(cond ? '✓' : '✗', msg); if (!cond) fallos++; };

// 1) Generar CSR
const { csrPem, alias } = certs.generarCSR({ cuit: '20-41140438-3', razonSocial: 'Kiosco Test SRL', alias: 'oma_test' });
const csr = forge.pki.certificationRequestFromPem(csrPem);
check(csr.verify(), 'CSR con firma válida');
check(csr.subject.getField('CN').value === 'oma_test', 'CSR subject CN = alias');
check(csr.subject.getField('O').value === 'Kiosco Test SRL', 'CSR subject O = razón social');
check(buscarSerial(csr.subject) === 'CUIT 20411404383', 'CSR serialNumber = "CUIT <cuit>" (CUIT normalizado)');
check(certs.estado().estadoCert === 'csr_pendiente', 'estado = csr_pendiente tras generar CSR');

// 2) Importar el cert correcto (misma publicKey)
const certPem = emitirCertFalso(csr.publicKey);
const info = certs.importarCertificado(certPem);
check(!!info.vencimiento, 'cert importado devuelve vencimiento');
check(certs.estado().estadoCert === 'activo', 'estado = activo tras importar cert');
const cred = certs.cargarCredenciales();
check(!!(cred && cred.cert && cred.key), 'cargarCredenciales devuelve cert + key');

// 3) Rechazar un cert ajeno (otra publicKey)
certs.limpiarCertificado();
certs.generarCSR({ cuit: '20411404383', razonSocial: 'Otro', alias: 'oma2' }); // nueva key
const otraKey = forge.pki.rsa.generateKeyPair(2048);
const certAjeno = emitirCertFalso(forge.pki.setRsaPublicKey(otraKey.publicKey.n, otraKey.publicKey.e));
let rechazado = false;
try { certs.importarCertificado(certAjeno); } catch { rechazado = true; }
check(rechazado, 'cert con clave que NO coincide es rechazado');

console.log(fallos === 0 ? '\n✓✓✓ ONBOARDING DEL CERTIFICADO OK' : `\n✗ ${fallos} fallo(s)`);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
process.exit(fallos ? 1 : 0);
