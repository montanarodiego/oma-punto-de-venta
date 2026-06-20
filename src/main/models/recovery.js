// Clave de recuperación de dueño (segundo factor para recuperar el acceso de
// administrador sin email).
//
// Es un código que la app genera y muestra UNA sola vez; en disco se guarda solo
// su hash bcrypt (clave `recovery_code_hash` en `configuracion`). La recuperación
// del admin exige DOS factores: el licenseKey (vendor-tied, lo re-suministra OmaTech)
// + esta clave (la guarda el dueño, no la ve un empleado que mira el licenseKey).
//
// Estructura preparada para subir de nivel a futuro (TOTP, PIN rotativo, validación
// server-side): el enganche es único — verificar() y el handler auth:recuperarAdmin.

const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { getDb } = require('../database');

const CLAVE = 'recovery_code_hash';

function _get() {
  return getDb().prepare('SELECT valor FROM configuracion WHERE clave = ?').get(CLAVE)?.valor ?? null;
}
function _set(valor) {
  getDb().prepare(
    'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ' +
    'ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
  ).run(CLAVE, valor);
}

// ¿Hay una clave de recuperación configurada en esta instalación?
function tiene() {
  return !!_get();
}

// Genera una clave OMA-REC-XXXX-XXXX (alfabeto sin caracteres ambiguos), guarda solo
// su hash y devuelve el texto plano para mostrarlo UNA vez. Regenerar invalida la previa.
function generar() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0, I/1, L
  const grupo = () => Array.from({ length: 4 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
  const codigo = `OMA-REC-${grupo()}-${grupo()}`;
  _set(bcrypt.hashSync(codigo, 10));
  return codigo;
}

// Compara el código ingresado contra el hash guardado. Normaliza a mayúsculas y sin
// espacios; el resto del formato (prefijo + guiones) debe coincidir.
function verificar(codigo) {
  const hash = _get();
  if (!hash) return false;
  try {
    return bcrypt.compareSync(String(codigo || '').trim().toUpperCase(), hash);
  } catch {
    return false;
  }
}

module.exports = { tiene, generar, verificar };
