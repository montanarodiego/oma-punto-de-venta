const { getDb } = require('../database');

const CAMPOS_EDITABLES = [
  'codigo', 'nombre', 'descripcion', 'costo_unitario', 'precio_unitario', 'precio_mayoreo',
  'stock_actual', 'stock_minimo', 'proveedor', 'unidad_medida', 'tasa_iva',
  'departamento_id', 'es_kit', 'usa_inventario',
];

const CAMPOS_PRECIO = ['precio_unitario', 'costo_unitario', 'precio_mayoreo'];

const SEL = `
  SELECT a.*,
    d.nombre AS departamento_nombre,
    d.color  AS departamento_color
  FROM articulos a
  LEFT JOIN departamentos d ON d.id = a.departamento_id
`;

function getAll() {
  return getDb().prepare(`${SEL} ORDER BY a.nombre`).all();
}

function getById(id) {
  return getDb().prepare(`${SEL} WHERE a.id = ?`).get(id);
}

function getByCodigo(codigo) {
  return getDb().prepare(`${SEL} WHERE a.codigo = ?`).get(codigo);
}

function search(query) {
  const db = getDb();
  const q  = (query ?? '').trim();
  if (!q) return db.prepare(`${SEL} ORDER BY a.nombre LIMIT 100`).all();

  // Código exacto → sólo ese ítem (lectores de código de barras)
  const byCode = db.prepare(`${SEL} WHERE a.codigo = ?`).get(q);
  if (byCode) return [byCode];

  // Cada palabra del query debe aparecer en nombre o código (AND implícito)
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const like = `%${words[0]}%`;
    return db.prepare(`${SEL} WHERE a.nombre LIKE ? OR a.codigo LIKE ? ORDER BY a.nombre LIMIT 100`).all(like, like);
  }
  const conds  = words.map(() => '(a.nombre LIKE ? OR a.codigo LIKE ?)').join(' AND ');
  const params = words.flatMap(w => [`%${w}%`, `%${w}%`]);
  return db.prepare(`${SEL} WHERE ${conds} ORDER BY a.nombre LIMIT 100`).all(...params);
}

function searchPaged({ query = '', departamento_id = null, limit = 200, offset = 0 } = {}) {
  const db = getDb();
  const q  = (query ?? '').trim();

  let rows, total;

  if (!q && departamento_id === null) {
    total = db.prepare('SELECT COUNT(*) AS c FROM articulos').get().c;
    rows  = db.prepare(`${SEL} ORDER BY a.nombre LIMIT ? OFFSET ?`).all(limit, offset);
    return { rows, total };
  }

  if (!q && departamento_id !== null) {
    total = db.prepare('SELECT COUNT(*) AS c FROM articulos WHERE departamento_id = ?').get(departamento_id).c;
    rows  = db.prepare(`${SEL} WHERE a.departamento_id = ? ORDER BY a.nombre LIMIT ? OFFSET ?`).all(departamento_id, limit, offset);
    return { rows, total };
  }

  // Búsqueda por texto: FTS5 + filtro de departamento
  const term = q.replace(/['"*]/g, '') + '*';
  try {
    const depFilter = departamento_id !== null ? 'AND a.departamento_id = ?' : '';
    const countArgs = departamento_id !== null ? [term, departamento_id] : [term];
    const rowArgs   = departamento_id !== null ? [term, departamento_id, limit, offset] : [term, limit, offset];

    total = db.prepare(`
      SELECT COUNT(*) AS c
      FROM articulos_fts f
      JOIN articulos a ON a.id = f.rowid
      WHERE articulos_fts MATCH ? ${depFilter}
    `).get(...countArgs).c;

    rows = db.prepare(`
      ${SEL}
      JOIN articulos_fts f ON f.rowid = a.id
      WHERE articulos_fts MATCH ? ${depFilter}
      ORDER BY f.rank
      LIMIT ? OFFSET ?
    `).all(...rowArgs);
  } catch {
    const like = `%${q}%`;
    if (departamento_id !== null) {
      total = db.prepare('SELECT COUNT(*) AS c FROM articulos WHERE (nombre LIKE ? OR codigo LIKE ?) AND departamento_id = ?').get(like, like, departamento_id).c;
      rows  = db.prepare(`${SEL} WHERE (a.nombre LIKE ? OR a.codigo LIKE ?) AND a.departamento_id = ? ORDER BY a.nombre LIMIT ? OFFSET ?`).all(like, like, departamento_id, limit, offset);
    } else {
      total = db.prepare('SELECT COUNT(*) AS c FROM articulos WHERE nombre LIKE ? OR codigo LIKE ?').get(like, like).c;
      rows  = db.prepare(`${SEL} WHERE a.nombre LIKE ? OR a.codigo LIKE ? ORDER BY a.nombre LIMIT ? OFFSET ?`).all(like, like, limit, offset);
    }
  }

  return { rows, total };
}

function create(data) {
  const stmt = getDb().prepare(`
    INSERT INTO articulos
      (codigo, nombre, descripcion, costo_unitario, precio_unitario, precio_mayoreo,
       stock_actual, stock_minimo, proveedor, unidad_medida, tasa_iva,
       departamento_id, es_kit, usa_inventario, sync_status, updated_at)
    VALUES
      (@codigo, @nombre, @descripcion, @costo_unitario, @precio_unitario, @precio_mayoreo,
       @stock_actual, @stock_minimo, @proveedor, @unidad_medida, @tasa_iva,
       @departamento_id, @es_kit, @usa_inventario, 'pending', datetime('now'))
  `);
  const result = stmt.run({
    codigo:          data.codigo          ?? '',
    nombre:          data.nombre          ?? '',
    descripcion:     data.descripcion     ?? null,
    costo_unitario:  data.costo_unitario  ?? 0,
    precio_unitario: data.precio_unitario ?? 0,
    precio_mayoreo:  data.precio_mayoreo  ?? 0,
    stock_actual:    data.stock_actual    ?? 0,
    stock_minimo:    data.stock_minimo    ?? 0,
    proveedor:       data.proveedor       ?? null,
    unidad_medida:   data.unidad_medida   ?? 'unidad',
    tasa_iva:        data.tasa_iva        ?? '21',
    departamento_id: data.departamento_id ?? null,
    es_kit:          data.es_kit          ?? 0,
    usa_inventario:  data.usa_inventario  ?? 1,
  });
  return getById(result.lastInsertRowid);
}

function update(id, data, usuario = null) {
  const campos = Object.keys(data).filter(k => CAMPOS_EDITABLES.includes(k));
  if (campos.length === 0) throw new Error('Sin campos válidos para actualizar');

  const db    = getDb();
  const antes = db.prepare('SELECT precio_unitario, costo_unitario, precio_mayoreo FROM articulos WHERE id = ?').get(id);

  const set = campos.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE articulos SET ${set}, sync_status = 'pending', updated_at = datetime('now') WHERE id = @id`)
    .run({ ...data, id });

  if (antes) {
    const stmtHist = db.prepare(`
      INSERT INTO precio_historial (articulo_id, campo, valor_anterior, valor_nuevo, usuario_id, usuario_nombre)
      VALUES (@articulo_id, @campo, @valor_anterior, @valor_nuevo, @usuario_id, @usuario_nombre)
    `);
    for (const campo of CAMPOS_PRECIO) {
      if (data[campo] !== undefined && Number(data[campo]) !== Number(antes[campo])) {
        stmtHist.run({
          articulo_id:    id,
          campo,
          valor_anterior: Number(antes[campo] ?? 0),
          valor_nuevo:    Number(data[campo]),
          usuario_id:     usuario?.id     ?? null,
          usuario_nombre: usuario?.nombre ?? null,
        });
      }
    }
  }

  return getById(id);
}

function getPrecioHistorial(articulo_id) {
  return getDb()
    .prepare('SELECT * FROM precio_historial WHERE articulo_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(articulo_id);
}

function remove(id) {
  return getDb().prepare('DELETE FROM articulos WHERE id = ?').run(id);
}

module.exports = { getAll, getById, getByCodigo, search, searchPaged, create, update, remove, getPrecioHistorial };
