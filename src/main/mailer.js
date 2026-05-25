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

module.exports = { enviarReporte };
