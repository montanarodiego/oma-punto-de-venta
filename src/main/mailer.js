const nodemailer   = require('nodemailer');
const credentials  = require('./credentials');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: credentials.GMAIL_USER,
    pass: credentials.GMAIL_APP_PASSWORD,
  },
});

async function enviarReporte({ tipo, modulo, descripcion, nombre, version, negocio }) {
  await transporter.sendMail({
    from: 'OmaTech POS <oma.technologies.venta@gmail.com>',
    to: 'oma.technologies.venta@gmail.com',
    subject: `[Reporte POS] ${tipo} — ${modulo}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1d4ed8;">Nuevo reporte de problema</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:600;width:140px;">Tipo:</td><td style="padding:8px 0;">${tipo}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Módulo:</td><td style="padding:8px 0;">${modulo}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;">Descripción:</td><td style="padding:8px 0;white-space:pre-wrap;">${descripcion}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Nombre:</td><td style="padding:8px 0;">${nombre || 'No especificado'}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;color:#6b7280;font-size:13px;">
          <tr><td style="padding:4px 0;width:140px;">Versión del POS:</td><td style="padding:4px 0;">${version}</td></tr>
          <tr><td style="padding:4px 0;">Negocio:</td><td style="padding:4px 0;">${negocio || 'No configurado'}</td></tr>
          <tr><td style="padding:4px 0;">Fecha:</td><td style="padding:4px 0;">${new Date().toLocaleString('es-AR')}</td></tr>
        </table>
      </div>
    `,
  });
}

async function enviarCodigoReset({ email, nombre, codigo }) {
  await transporter.sendMail({
    from:    'OmaTech POS <oma.technologies.venta@gmail.com>',
    to:      email,
    subject: 'Código de recuperación — OmaTech POS',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f8fafc;border-radius:12px;padding:32px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:22px;font-weight:800;color:#2563eb;letter-spacing:-.5px;">OmaTech POS</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px;">Recuperación de contraseña</div>
        </div>
        <p style="color:#374151;font-size:14px;margin:0 0 10px;">Hola <strong>${nombre}</strong>,</p>
        <p style="color:#374151;font-size:14px;margin:0 0 20px;">Tu código de verificación es:</p>
        <div style="background:#1e3a8a;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
          <span style="font-size:40px;font-weight:900;color:#fff;letter-spacing:12px;font-family:monospace;">${codigo}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;margin:0 0 6px;">Este código vence en <strong>15 minutos</strong>.</p>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Si no solicitaste el cambio, ignorá este mensaje.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">OmaTech POS — Sistema de Punto de Venta</p>
      </div>
    `,
  });
}

async function enviarCorte({ emailDestino, resumen, negocioNombre, operadorNombre }) {
  const fmt = (n) => `$${(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fechaCierre = resumen.fecha_cierre
    ? new Date(resumen.fecha_cierre).toLocaleString('es-AR', { hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
    : new Date().toLocaleString('es-AR', { hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });
  const dif = (resumen.efectivo_real ?? 0) - (resumen.efectivo_esperado ?? 0);
  const difColor = dif >= 0 ? '#16a34a' : '#dc2626';
  const difLabel = dif >= 0 ? `Sobrante: ${fmt(dif)}` : `Faltante: ${fmt(Math.abs(dif))}`;

  await transporter.sendMail({
    from:    `${negocioNombre || 'OmaTech POS'} <oma.technologies.venta@gmail.com>`,
    to:      emailDestino,
    subject: `Cierre de turno — ${negocioNombre || 'OmaTech POS'} — ${fechaCierre}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;border-radius:12px;padding:28px;">
        <div style="font-size:18px;font-weight:800;color:#1e3a8a;margin-bottom:4px;">${negocioNombre || 'OmaTech POS'}</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:20px;">Resumen de cierre de turno</div>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:7px 0;color:#6b7280;width:50%;">Operador:</td><td style="padding:7px 0;font-weight:600;">${operadorNombre || '—'}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Fecha y hora:</td><td style="padding:7px 0;font-weight:600;">${fechaCierre}</td></tr>
        </table>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:7px 0;color:#6b7280;">Total de ventas:</td><td style="padding:7px 0;font-weight:700;text-align:right;">${fmt(resumen.total_ventas)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Efectivo:</td><td style="padding:7px 0;text-align:right;">${fmt(resumen.ventas_efectivo)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Débito:</td><td style="padding:7px 0;text-align:right;">${fmt(resumen.ventas_debito)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Crédito:</td><td style="padding:7px 0;text-align:right;">${fmt(resumen.ventas_credito)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Transferencia:</td><td style="padding:7px 0;text-align:right;">${fmt(resumen.ventas_transferencia)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Cta. Corriente:</td><td style="padding:7px 0;text-align:right;">${fmt(resumen.ventas_cuenta_corriente)}</td></tr>
        </table>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:7px 0;color:#6b7280;">Efectivo inicial:</td><td style="padding:7px 0;text-align:right;">${fmt(resumen.efectivo_inicial)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Efectivo esperado:</td><td style="padding:7px 0;text-align:right;">${fmt(resumen.efectivo_esperado)}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Efectivo real:</td><td style="padding:7px 0;text-align:right;">${fmt(resumen.efectivo_real)}</td></tr>
          <tr><td style="padding:7px 0;font-weight:700;color:${difColor};">${difLabel}</td><td></td></tr>
        </table>

        <div style="margin-top:20px;font-size:11px;color:#9ca3af;text-align:center;">OmaTech POS — generado automáticamente al cerrar turno</div>
      </div>
    `,
  });
}

module.exports = { enviarReporte, enviarCodigoReset, enviarCorte };
