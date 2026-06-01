const crypto = require('crypto');
const bcrypt  = require('bcryptjs');
const { getDb } = require('../database');

const EXPIRACION_MS = 15 * 60 * 1000;

function buscarPorEmail(email) {
  return getDb()
    .prepare('SELECT id, nombre, email FROM usuarios WHERE LOWER(email) = LOWER(?) AND activo = 1')
    .get(email.trim());
}

function crearToken(usuarioId) {
  const db     = getDb();
  const codigo = String(crypto.randomInt(100000, 1000000));

  db.prepare('UPDATE password_reset_tokens SET usado = 1 WHERE usuario_id = ? AND usado = 0')
    .run(usuarioId);

  db.prepare(
    'INSERT INTO password_reset_tokens (usuario_id, codigo, expires_at) VALUES (?, ?, ?)'
  ).run(usuarioId, codigo, Date.now() + EXPIRACION_MS);

  return codigo;
}

function verificarToken(email, codigo) {
  const usuario = buscarPorEmail(email);
  if (!usuario) return false;

  const token = getDb().prepare(`
    SELECT id FROM password_reset_tokens
    WHERE usuario_id = ? AND codigo = ? AND usado = 0 AND expires_at > ?
    ORDER BY id DESC LIMIT 1
  `).get(usuario.id, codigo.trim(), Date.now());

  return !!token;
}

function consumirToken(email, codigo, nuevaPassword) {
  const db      = getDb();
  const usuario = buscarPorEmail(email);
  if (!usuario) return false;

  const token = db.prepare(`
    SELECT id FROM password_reset_tokens
    WHERE usuario_id = ? AND codigo = ? AND usado = 0 AND expires_at > ?
    ORDER BY id DESC LIMIT 1
  `).get(usuario.id, codigo.trim(), Date.now());

  if (!token) return false;

  const hash = bcrypt.hashSync(nuevaPassword, 10);
  db.transaction(() => {
    db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, usuario.id);
    db.prepare('UPDATE password_reset_tokens SET usado = 1 WHERE id = ?').run(token.id);
  })();

  return true;
}

module.exports = { buscarPorEmail, crearToken, verificarToken, consumirToken };
