const { signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { desencriptar } = require('./sync');

async function loginConEmail(authInst, email, password) {
  const cred = await signInWithEmailAndPassword(authInst, email, password);
  return cred.user;
}

// Re-autentica silenciosamente usando las credenciales encriptadas del token local.
// No lanza — si falla (sin red, credenciales cambiadas) la app sigue funcionando
// offline y el sync quedará pendiente hasta la próxima sesión manual.
async function reautenticarDesdeToken(authInst, token) {
  if (!token?.credenciales?.email || !token?.credenciales?.password) return;
  try {
    const email    = desencriptar(token.credenciales.email,    token.negocioId);
    const password = desencriptar(token.credenciales.password, token.negocioId);
    await signInWithEmailAndPassword(authInst, email, password);
  } catch { /* fallo silencioso — sin internet o credenciales cambiadas */ }
}

async function cerrarSesion(authInst) {
  await signOut(authInst);
}

module.exports = { loginConEmail, reautenticarDesdeToken, cerrarSesion };
