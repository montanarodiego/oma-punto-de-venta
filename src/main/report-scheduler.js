'use strict';
const { getDb }                 = require('./database');
const { generarYEnviarReporte } = require('./report-mailer');

let timer = null;

function getCfg(db, k, def = '') {
  return db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(k)?.valor ?? def;
}

function leerConfig(db) {
  return {
    activo:     getCfg(db, 'reporte_email_activo',     '0') === '1',
    email:      getCfg(db, 'reporte_email_destino',    ''),
    frecuencia: getCfg(db, 'reporte_email_frecuencia', 'diario'),
    hora:       getCfg(db, 'reporte_email_hora',       '08:00'),
    diaSemana:  parseInt(getCfg(db, 'reporte_email_dia_semana', '1')),
    diaMes:     parseInt(getCfg(db, 'reporte_email_dia_mes',    '1')),
    ultimoEnvio:getCfg(db, 'reporte_email_ultimo_envio', ''),
  };
}

// Retorna el Date del último horario programado que ya pasó
function ultimoHorarioProgramado(cfg) {
  const [hh, mm] = cfg.hora.split(':').map(Number);
  const ahora    = new Date();

  if (cfg.frecuencia === 'diario') {
    const c = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hh, mm, 0);
    if (ahora >= c) return c;
    c.setDate(c.getDate() - 1);
    return c;
  }

  if (cfg.frecuencia === 'semanal') {
    const c = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hh, mm, 0);
    let n = 0;
    while (c.getDay() !== cfg.diaSemana && n++ < 7) c.setDate(c.getDate() - 1);
    if (ahora >= c) return c;
    c.setDate(c.getDate() - 7);
    return c;
  }

  if (cfg.frecuencia === 'mensual') {
    const lastDay = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    const dia     = Math.min(cfg.diaMes, lastDay);
    const c       = new Date(ahora.getFullYear(), ahora.getMonth(), dia, hh, mm, 0);
    if (ahora >= c) return c;
    const lastDayPrev = new Date(ahora.getFullYear(), ahora.getMonth(), 0).getDate();
    return new Date(ahora.getFullYear(), ahora.getMonth() - 1, Math.min(cfg.diaMes, lastDayPrev), hh, mm, 0);
  }

  return null;
}

function deberiaEnviar(cfg) {
  if (!cfg.activo || !cfg.email) return false;
  const uh = ultimoHorarioProgramado(cfg);
  if (!uh || uh > new Date()) return false;
  if (cfg.ultimoEnvio) {
    const ultimo = new Date(cfg.ultimoEnvio);
    if (ultimo >= uh) return false;
  }
  return true;
}

async function tick() {
  let db;
  try { db = getDb(); } catch { return; }
  const cfg = leerConfig(db);
  if (!deberiaEnviar(cfg)) return;
  try {
    await generarYEnviarReporte(cfg.email, cfg.frecuencia, db);
    db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)')
      .run('reporte_email_ultimo_envio', new Date().toISOString());
    console.log('[report-scheduler] Reporte enviado a', cfg.email);
  } catch (err) {
    console.error('[report-scheduler] Error al enviar reporte:', err.message);
  }
}

function iniciar() {
  // Verificar 5 s después del inicio (da tiempo a que la DB quede lista)
  // Cubre el caso donde la app estuvo cerrada durante el horario programado
  setTimeout(() => tick().catch(() => {}), 5000);

  // Luego verificar cada minuto
  timer = setInterval(() => tick().catch(() => {}), 60 * 1000);
}

function detener() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { iniciar, detener, tick };
