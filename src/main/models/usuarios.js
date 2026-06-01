const bcrypt    = require('bcryptjs');
const { getDb } = require('../database');

function login(usuario, password) {
  const db   = getDb();
  const user  = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(usuario);
  if (!user) throw new Error('Usuario o contraseña incorrectos.');
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) throw new Error('Usuario o contraseña incorrectos.');
  return { id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol };
}

function listar() {
  return getDb()
    .prepare('SELECT id, nombre, usuario, rol, activo FROM usuarios ORDER BY id')
    .all();
}

function crear(data) {
  const db   = getDb();
  const hash  = bcrypt.hashSync(data.password, 10);
  const email = data.email ? data.email.trim().toLowerCase() : null;
  const res   = db.prepare(
    'INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo, email) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(data.nombre.trim(), data.usuario.trim(), hash, data.rol, email);
  return res.lastInsertRowid;
}

function actualizar(id, data) {
  const db    = getDb();
  const email = data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : undefined;
  if (data.password) {
    const hash = bcrypt.hashSync(data.password, 10);
    if (email !== undefined) {
      db.prepare('UPDATE usuarios SET nombre = ?, usuario = ?, password_hash = ?, rol = ?, email = ? WHERE id = ?')
        .run(data.nombre.trim(), data.usuario.trim(), hash, data.rol, email, id);
    } else {
      db.prepare('UPDATE usuarios SET nombre = ?, usuario = ?, password_hash = ?, rol = ? WHERE id = ?')
        .run(data.nombre.trim(), data.usuario.trim(), hash, data.rol, id);
    }
  } else {
    if (email !== undefined) {
      db.prepare('UPDATE usuarios SET nombre = ?, usuario = ?, rol = ?, email = ? WHERE id = ?')
        .run(data.nombre.trim(), data.usuario.trim(), data.rol, email, id);
    } else {
      db.prepare('UPDATE usuarios SET nombre = ?, usuario = ?, rol = ? WHERE id = ?')
        .run(data.nombre.trim(), data.usuario.trim(), data.rol, id);
    }
  }
}

function toggleActivo(id) {
  getDb()
    .prepare('UPDATE usuarios SET activo = CASE WHEN activo = 1 THEN 0 ELSE 1 END WHERE id = ?')
    .run(id);
}

module.exports = { login, listar, crear, actualizar, toggleActivo };
