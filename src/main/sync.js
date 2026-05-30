const { doc, setDoc, getDoc } = require('firebase/firestore');
const { app }  = require('electron');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

// ── Criptografía de credenciales ───────────────────────────────
// Clave AES-256 derivada del negocioId (SHA-256, 32 bytes).
function _clave(negocioId) {
  return crypto.createHash('sha256').update(negocioId).digest();
}

// Retorna "iv:authTag:cifrado" en hex.
function encriptar(texto, negocioId) {
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', _clave(negocioId), iv);
  const enc    = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}

// Inversa de encriptar(). Lanza si los datos están corruptos o la clave es incorrecta.
function desencriptar(dato, negocioId) {
  const [ivHex, tagHex, encHex] = dato.split(':');
  const dec = crypto.createDecipheriv('aes-256-gcm', _clave(negocioId), Buffer.from(ivHex, 'hex'));
  dec.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([dec.update(Buffer.from(encHex, 'hex')), dec.final()]).toString('utf8');
}

// Sube todos los registros pendientes de SQLite a Firestore y los marca 'synced'.
// authInst es la instancia de Firebase Auth; si currentUser es null la sync se cancela
// porque Firestore rechazaría las escrituras por falta de sesión (inMemoryPersistence).
// Retorna { sincronizados: N, fallidos: M, error?: string }
async function syncPendientes(db, firestoreInst, negocioId, authInst) {
  if (!authInst.currentUser) {
    console.warn('[sync] auth.currentUser es null — sin sesión activa, sync omitida');
    return { sincronizados: 0, fallidos: 0, error: 'sin_sesion' };
  }

  let sincronizados = 0;
  let fallidos      = 0;

  for (const tabla of ['articulos', 'clientes', 'transacciones']) {
    const rows = db
      .prepare(`SELECT * FROM ${tabla} WHERE sync_status = 'pending'`)
      .all();

    for (const row of rows) {
      try {
        await setDoc(
          doc(firestoreInst, 'negocios', negocioId, tabla, String(row.id)),
          row,
          { merge: true }
        );
        db.prepare(`UPDATE ${tabla} SET sync_status = 'synced' WHERE id = ?`)
          .run(row.id);
        sincronizados++;
      } catch (err) {
        console.error(`[sync] fallo en ${tabla}/${row.id} — ${err.code ?? ''} | ${err.message}`);
        fallidos++;
      }
    }
  }

  return { sincronizados, fallidos };
}

// Cuenta el total de registros con sync_status = 'pending' en las tres tablas.
function contarPendientes(db) {
  let total = 0;
  for (const tabla of ['articulos', 'clientes', 'transacciones']) {
    const row = db
      .prepare(`SELECT COUNT(*) as count FROM ${tabla} WHERE sync_status = 'pending'`)
      .get();
    total += row.count;
  }
  return total;
}

// Lee el campo 'licencia' del documento negocios/{negocioId} en Firestore.
// Retorna:
//   { activa: true,  vencimiento: Date,  razon: 'ok'       }
//   { activa: false, razon: 'inactiva'                      }
//   { activa: false, razon: 'no_existe'                     }
//   { activa: false, razon: 'error', detalle: string        }
async function verificarLicencia(firestoreInst, negocioId) {
  try {
    const snap = await getDoc(doc(firestoreInst, 'negocios', negocioId));

    if (!snap.exists()) return { activa: false, razon: 'no_existe' };

    const lic = snap.data()?.licencia;
    if (!lic) return { activa: false, razon: 'no_existe' };

    const vencimiento = lic.vencimiento?.toDate
      ? lic.vencimiento.toDate()
      : new Date(lic.vencimiento);

    return {
      activa:      lic.activa === true,
      vencimiento,
      razon:       lic.activa === true ? 'ok' : 'inactiva',
    };
  } catch (err) {
    return { activa: false, razon: 'error', detalle: err.message };
  }
}

function tokenPath() {
  return path.join(app.getPath('userData'), 'license.json');
}

function guardarTokenLocal(token) {
  fs.writeFileSync(tokenPath(), JSON.stringify(token), 'utf8');
}

function verificarTokenLocal() {
  try {
    const data = JSON.parse(fs.readFileSync(tokenPath(), 'utf8'));
    if (!data?.negocioId) return { activa: false };
    if (data.vencimiento > Date.now()) return { activa: true, negocioId: data.negocioId };
    return { activa: false, vencido: true };
  } catch {
    return { activa: false };
  }
}

// Retorna el token completo (incluyendo credenciales cifradas) si es válido, null si no.
// Usar cuando se necesita reautenticar: verificarTokenLocal() descarta las credenciales.
function leerTokenRaw() {
  try {
    const data = JSON.parse(fs.readFileSync(tokenPath(), 'utf8'));
    return (data?.negocioId && data.vencimiento > Date.now()) ? data : null;
  } catch {
    return null;
  }
}

module.exports = {
  encriptar,
  desencriptar,
  syncPendientes,
  contarPendientes,
  verificarLicencia,
  guardarTokenLocal,
  verificarTokenLocal,
  leerTokenRaw,
};
