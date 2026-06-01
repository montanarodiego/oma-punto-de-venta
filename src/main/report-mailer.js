'use strict';
const nodemailer   = require('nodemailer');
const Informes     = require('./models/informes');
const credentials  = require('./credentials');

// ── Helpers ──────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtMon(n, mon = '$') {
  const num = parseFloat(n || 0);
  const [int, dec] = Math.abs(num).toFixed(2).split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (num < 0 ? '-' : '') + mon + intFmt + ',' + dec;
}

function fmtNum(n) {
  return Math.round(parseFloat(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function delta(actual, anterior) {
  const a = parseFloat(actual || 0), p = parseFloat(anterior || 0);
  if (p === 0) return '<span style="color:#94a3b8;">&#8212;</span>';
  const pct  = ((a - p) / Math.abs(p)) * 100;
  const pos  = pct >= 0;
  const col  = pos ? '#16a34a' : '#dc2626';
  const arr  = pos ? '&#9650;' : '&#9660;';
  return `<span style="color:${col};font-weight:600;">${arr}&nbsp;${Math.abs(pct).toFixed(1)}%</span>`;
}

// ── Períodos según frecuencia ────────────────────────────────────
function calcularPeriodos(frecuencia) {
  const ds  = d => d.toISOString().slice(0, 10);
  const hoy = new Date();

  if (frecuencia === 'diario') {
    const ayer    = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    const antayer = new Date(hoy); antayer.setDate(antayer.getDate() - 2);
    const fmtD = d => d.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    return {
      actual:   { desde: ds(ayer),    hasta: ds(ayer) },
      anterior: { desde: ds(antayer), hasta: ds(antayer) },
      label:    fmtD(ayer).replace(/^\w/, c => c.toUpperCase()),
      labelAnt: 'Día anterior',
    };
  }

  if (frecuencia === 'semanal') {
    const hasta1 = new Date(hoy); hasta1.setDate(hasta1.getDate() - 1);
    const desde1 = new Date(hoy); desde1.setDate(desde1.getDate() - 7);
    const hasta2 = new Date(hoy); hasta2.setDate(hasta2.getDate() - 8);
    const desde2 = new Date(hoy); desde2.setDate(desde2.getDate() - 14);
    const fd = d => d.toLocaleDateString('es-AR', { day:'numeric', month:'short' });
    return {
      actual:   { desde: ds(desde1), hasta: ds(hasta1) },
      anterior: { desde: ds(desde2), hasta: ds(hasta2) },
      label:    `Semana del ${fd(desde1)} al ${fd(hasta1)}`,
      labelAnt: `Semana anterior`,
    };
  }

  // mensual
  const m1Start = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const m1End   = new Date(hoy.getFullYear(), hoy.getMonth(),     0);
  const m2Start = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
  const m2End   = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 0);
  const fm = d => d.toLocaleDateString('es-AR', { month:'long', year:'numeric' }).replace(/^\w/, c => c.toUpperCase());
  return {
    actual:   { desde: ds(m1Start), hasta: ds(m1End) },
    anterior: { desde: ds(m2Start), hasta: ds(m2End) },
    label:    fm(m1Start),
    labelAnt: fm(m2Start),
  };
}

// ── HTML del email ───────────────────────────────────────────────
function generarHTML(datos, cfg) {
  const { periodos, resumen: r, resumenAnt: ra, topProductos, formasPago } = datos;
  const mon = cfg.moneda || '$';
  const fm  = n => fmtMon(n, mon);
  const fn  = fmtNum;

  const ticketProm    = parseFloat(r.cantidad)  > 0 ? parseFloat(r.total)  / parseFloat(r.cantidad)  : 0;
  const ticketPromAnt = parseFloat(ra.cantidad) > 0 ? parseFloat(ra.total) / parseFloat(ra.cantidad) : 0;

  const FP = {
    efectivo:'Efectivo', tarjeta:'Tarjeta', debito:'D&eacute;bito',
    transferencia:'Transferencia', cuenta_corriente:'Cta. Cte.',
    qr:'QR / MercadoPago', otro:'Otro',
  };

  const maxImp = Math.max(...topProductos.map(p => parseFloat(p.importe_total) || 0), 1);

  const topRows = topProductos.slice(0, 5).map((p, i) => {
    const barPct = Math.round((parseFloat(p.importe_total) || 0) / maxImp * 100);
    return `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;width:22px;">
        <span style="font-size:12px;font-weight:700;color:#cbd5e1;">${i + 1}</span>
      </td>
      <td style="padding:11px 8px;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:13px;color:#1e293b;font-weight:500;margin-bottom:5px;">${esc(p.nombre)}</div>
        <div style="height:4px;background:#e2e8f0;border-radius:2px;">
          <div style="height:4px;width:${barPct}%;max-width:100%;background:#3b82f6;border-radius:2px;"></div>
        </div>
      </td>
      <td style="padding:11px 0;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;vertical-align:top;">
        <div style="font-size:12px;color:#94a3b8;">${fn(p.cantidad_total)} u.</div>
        <div style="font-size:13px;font-weight:700;color:#1e3a8a;">${fm(p.importe_total)}</div>
      </td>
    </tr>`;
  }).join('');

  const fpTotal = parseFloat(r.total) || 1;
  const fpRows = formasPago.map(fp => {
    const pct = ((parseFloat(fp.total) || 0) / fpTotal * 100).toFixed(0);
    return `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151;">
        ${FP[fp.forma_pago] || esc(fp.forma_pago) || '&#8212;'}
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:#94a3b8;width:70px;">
        ${fn(fp.cantidad)} venta${fp.cantidad !== 1 ? 's' : ''}
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;">
        <span style="font-size:11px;color:#94a3b8;margin-right:8px;">${pct}%</span>
        <span style="font-size:13px;font-weight:700;color:#1e3a8a;">${fm(fp.total)}</span>
      </td>
    </tr>`;
  }).join('');

  const cr = (label, av, pv, af, pf) => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${label}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:700;color:#1e293b;">${af}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px;color:#94a3b8;">${pf}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;font-size:12px;">${delta(av, pv)}</td>
    </tr>`;

  const fechaGen = new Date().toLocaleString('es-AR', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reporte de ventas &#8212; ${esc(periodos.label)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">

<table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">

  <!-- HEADER -->
  <tr>
    <td bgcolor="#1e3a8a" style="background-color:#1e3a8a;padding:26px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td>
          <div style="font-size:21px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">OmaTech POS</div>
          <div style="font-size:12px;color:#93c5fd;margin-top:3px;">Reporte autom&aacute;tico de ventas</div>
        </td>
        <td align="right">
          <div style="font-size:14px;font-weight:700;color:#dbeafe;">${esc(periodos.label)}</div>
          ${cfg.nombreNegocio ? `<div style="font-size:12px;color:#93c5fd;margin-top:2px;">${esc(cfg.nombreNegocio)}</div>` : ''}
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- KPI CARDS -->
  <tr>
    <td style="padding:24px 32px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="48%" bgcolor="#eff6ff" style="background-color:#eff6ff;border-radius:8px;padding:18px 20px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px;">TOTAL VENDIDO</div>
            <div style="font-size:26px;font-weight:800;color:#1e3a8a;letter-spacing:-1px;">${fm(r.total)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">ant. ${fm(ra.total)}</div>
          </td>
          <td width="4%"></td>
          <td width="48%" bgcolor="#f0fdf4" style="background-color:#f0fdf4;border-radius:8px;padding:18px 20px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px;">GANANCIA BRUTA</div>
            <div style="font-size:26px;font-weight:800;color:#15803d;letter-spacing:-1px;">${fm(r.ganancia_bruta)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">ant. ${fm(ra.ganancia_bruta)}</div>
          </td>
        </tr>
        <tr><td colspan="3" style="height:8px;"></td></tr>
        <tr>
          <td width="48%" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 20px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px;">TRANSACCIONES</div>
            <div style="font-size:24px;font-weight:800;color:#1e293b;">${fn(r.cantidad)}</div>
          </td>
          <td width="4%"></td>
          <td width="48%" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 20px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px;">TICKET PROMEDIO</div>
            <div style="font-size:24px;font-weight:800;color:#1e293b;">${fm(ticketProm)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- COMPARATIVA -->
  <tr>
    <td style="padding:8px 32px 16px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">
        COMPARATIVA VS PERIODO ANTERIOR (${esc(periodos.labelAnt)})
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:10px;font-weight:700;color:#cbd5e1;padding-bottom:6px;text-transform:uppercase;letter-spacing:.06em;"></td>
          <td style="font-size:10px;font-weight:700;color:#cbd5e1;padding-bottom:6px;text-align:right;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;">ACTUAL</td>
          <td style="font-size:10px;font-weight:700;color:#cbd5e1;padding-bottom:6px;text-align:right;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;">ANTERIOR</td>
          <td style="font-size:10px;font-weight:700;color:#cbd5e1;padding-bottom:6px;text-align:right;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;">VARIACI&Oacute;N</td>
        </tr>
        ${cr('Total vendido',   r.total,          ra.total,          fm(r.total),         fm(ra.total))}
        ${cr('Ganancia bruta',  r.ganancia_bruta,  ra.ganancia_bruta, fm(r.ganancia_bruta),fm(ra.ganancia_bruta))}
        ${cr('Transacciones',   r.cantidad,        ra.cantidad,       fn(r.cantidad),      fn(ra.cantidad))}
        ${cr('Ticket promedio', ticketProm,         ticketPromAnt,     fm(ticketProm),      fm(ticketPromAnt))}
      </table>
    </td>
  </tr>

  ${topProductos.length > 0 ? `
  <!-- TOP 5 PRODUCTOS -->
  <tr>
    <td style="padding:8px 32px 16px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">TOP 5 PRODUCTOS M&Aacute;S VENDIDOS</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">${topRows}</table>
    </td>
  </tr>` : ''}

  ${formasPago.length > 0 ? `
  <!-- FORMAS DE PAGO -->
  <tr>
    <td style="padding:8px 32px 24px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">VENTAS POR FORMA DE PAGO</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">${fpRows}</table>
    </td>
  </tr>` : ''}

  <!-- FOOTER -->
  <tr>
    <td bgcolor="#f8fafc" style="background-color:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:11px;color:#94a3b8;">Generado el ${fechaGen} por OmaTech POS</td>
        <td align="right" style="font-size:11px;color:#94a3b8;">Configuraci&oacute;n &rsaquo; Reportes autom&aacute;ticos</td>
      </tr></table>
    </td>
  </tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

// ── Generar datos y enviar ────────────────────────────────────────
async function generarYEnviarReporte(emailDestino, frecuencia, db) {
  const getCfg = (k, def = '') => db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(k)?.valor ?? def;

  const remitente = credentials.GMAIL_USER;
  const password  = credentials.GMAIL_APP_PASSWORD;

  if (!remitente || !password) {
    throw new Error('Las credenciales de envío no están configuradas. Contactá al soporte de OmaTech.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: remitente, pass: password },
  });

  const cfg = {
    nombreNegocio: getCfg('nombre_negocio', 'OmaTech POS'),
    moneda:        getCfg('moneda', '$'),
  };

  const periodos = calcularPeriodos(frecuencia);
  const { actual, anterior } = periodos;

  const dataAct = Informes.ventasPorPeriodo(actual.desde,   actual.hasta);
  const dataAnt = Informes.ventasPorPeriodo(anterior.desde, anterior.hasta);
  const top     = Informes.articulosMasVendidos(actual.desde, actual.hasta);

  const datos = {
    periodos,
    resumen:      dataAct.resumen,
    resumenAnt:   dataAnt.resumen,
    topProductos: top,
    formasPago:   dataAct.porFormaPago.filter(fp => fp.forma_pago),
  };

  const html = generarHTML(datos, cfg);

  const FREQ = { diario:'Diario', semanal:'Semanal', mensual:'Mensual' };
  const subject = `[${FREQ[frecuencia] || frecuencia}] Reporte de ventas — ${cfg.nombreNegocio} — ${periodos.label}`;

  await transporter.sendMail({
    from:    `OmaTech POS <${remitente}>`,
    to:      emailDestino,
    subject,
    html,
  });

  return { ok: true };
}

module.exports = { generarYEnviarReporte, calcularPeriodos };
