const { doc, setDoc, getDoc } = require('firebase/firestore');
const { app } = require('electron');
const path    = require('path');
const fs      = require('fs');

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

module.exports = {
  syncPendientes,
  contarPendientes,
  verificarLicencia,
  guardarTokenLocal,
  verificarTokenLocal,
};
