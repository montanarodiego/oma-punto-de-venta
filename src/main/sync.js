const { doc, setDoc, getDoc } = require('firebase/firestore');
const { app } = require('electron');
const path    = require('path');
const fs      = require('fs');

// Sube todos los registros pendientes de SQLite a Firestore y los marca 'synced'.
async function syncPendientes(db, firestoreInst, negocioId) {
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
      } catch {
        // sin internet o error puntual — el registro queda 'pending' para el próximo ciclo
      }
    }
  }
}

// Lee el campo 'licencia' del documento negocios/{negocioId} en Firestore.
async function verificarLicencia(firestoreInst, negocioId) {
  try {
    const snap = await getDoc(doc(firestoreInst, 'negocios', negocioId));
    if (!snap.exists()) return { activa: false };

    const lic = snap.data()?.licencia;
    if (!lic) return { activa: false };

    const vencimiento = lic.vencimiento?.toDate
      ? lic.vencimiento.toDate()
      : new Date(lic.vencimiento);

    return { activa: lic.activa === true, vencimiento };
  } catch {
    return { activa: false };
  }
}

function tokenPath() {
  return path.join(app.getPath('userData'), 'license.json');
}

// Persiste el token de licencia en disco (userData/license.json).
// token: { negocioId, activa, vencimiento (ms epoch), timestamp }
function guardarTokenLocal(token) {
  fs.writeFileSync(tokenPath(), JSON.stringify(token), 'utf8');
}

// Lee y valida el token local.
// → { activa: true, negocioId }  si válido
// → { activa: false }            si no existe
// → { activa: false, vencido: true } si venció
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

module.exports = { syncPendientes, verificarLicencia, guardarTokenLocal, verificarTokenLocal };
