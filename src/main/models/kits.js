const { getDb } = require('../database');

function getComponentes(kitId) {
  return getDb().prepare(`
    SELECT kc.*, a.nombre, a.codigo, a.unidad_medida, a.stock_actual
    FROM kits_componentes kc
    JOIN articulos a ON a.id = kc.componente_id
    WHERE kc.kit_id = ?
    ORDER BY a.nombre
  `).all(kitId);
}

function setComponentes(kitId, componentes) {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM kits_componentes WHERE kit_id = ?').run(kitId);
    const ins = db.prepare(
      'INSERT INTO kits_componentes (kit_id, componente_id, cantidad) VALUES (?, ?, ?)'
    );
    for (const c of componentes) {
      if (c.componente_id && c.cantidad > 0) ins.run(kitId, c.componente_id, c.cantidad);
    }
  })();
  return getComponentes(kitId);
}

module.exports = { getComponentes, setComponentes };
