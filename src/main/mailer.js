const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'oma.technologies.venta@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
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

module.exports = { enviarReporte, enviarCodigoReset };
