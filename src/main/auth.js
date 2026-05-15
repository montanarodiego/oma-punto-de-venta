const { signInWithEmailAndPassword, signOut } = require('firebase/auth');

async function loginConEmail(authInst, email, password) {
  const cred = await signInWithEmailAndPassword(authInst, email, password);
  return cred.user;
}

async function cerrarSesion(authInst) {
  await signOut(authInst);
}

module.exports = { loginConEmail, cerrarSesion };
