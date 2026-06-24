const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''); // tolerar espacios en App Password
  if (!user || !pass) return null;

  // Configuración explícita: host + port 587 + STARTTLS
  // Más compatible que service:'gmail' (que usa puerto 465/SSL, problemático en algunos entornos)
  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false, // STARTTLS — se negocia después de conectar
    auth:   { user, pass },
  });
}

async function sendMail({ to, subject, html }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('⚠️  [Mailer] GMAIL_USER o GMAIL_APP_PASSWORD no configurados — email omitido.');
    return { skipped: true };
  }

  console.log(`📧 [Mailer] Intentando enviar email a: ${to} | from: ${user}`);
  const t = createTransporter();

  try {
    const info = await t.sendMail({
      from:    `EPM Escuela Popular de Música <${user}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ [Mailer] Email enviado. messageId: ${info.messageId} | accepted: ${info.accepted?.join(', ')}`);
    return info;
  } catch(err) {
    console.error(`❌ [Mailer] Error al enviar email a ${to}:`);
    console.error(`   code: ${err.code} | command: ${err.command} | response: ${err.response}`);
    console.error(`   message: ${err.message}`);
    throw err; // re-lanzar para que el caller pueda manejar
  }
}

function buildInvitacionEmail({ baseUrl, token, rolNombre, cursoNombres }) {
  const link        = `${baseUrl}/?invite=${token}`;
  const cursosTexto = cursoNombres?.length
    ? `<p style="color:#4b5563;font-size:14px;margin:0 0 8px;"><strong>Cursos asignados:</strong> ${cursoNombres.join(', ')}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invitación – EPM</title></head>
<body style="margin:0;padding:0;background:#f0f2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,.15);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:32px 40px;text-align:center;">
          <h1 style="color:#a5b4fc;font-size:24px;font-weight:800;margin:0 0 4px;">EPM</h1>
          <p style="color:rgba(255,255,255,.6);font-size:13px;margin:0;">Escuela Popular de Música</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <h2 style="color:#1e1b4b;font-size:20px;font-weight:700;margin:0 0 16px;">
            🎵 Te invitamos a unirte al sistema de gestión
          </h2>
          <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Fuiste invitado/a a crear tu cuenta en el sistema de gestión de la <strong>Escuela Popular de Música</strong>.
          </p>
          <div style="background:#f0f2ff;border-radius:10px;padding:16px;margin-bottom:24px;">
            <p style="color:#4b5563;font-size:14px;margin:0 0 8px;"><strong>Tu rol:</strong>
              <span style="background:#6366f1;color:#fff;border-radius:6px;padding:2px 10px;font-size:13px;font-weight:700;margin-left:6px;">${rolNombre}</span>
            </p>
            ${cursosTexto}
          </div>
          <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 28px;">
            Hacé click en el botón de abajo para completar tu registro y elegir tu contraseña.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${link}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:16px;font-weight:700;display:inline-block;letter-spacing:.3px;">
              Crear mi cuenta →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0 0 6px;text-align:center;">
            Este link expira en <strong>7 días</strong> y solo puede usarse una vez.
          </p>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
            Si no solicitaste esto, ignorá este email — tu cuenta está segura.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#d1d5db;font-size:12px;margin:0;">
            EPM – Escuela Popular de Música &nbsp;|&nbsp; Sistema de Gestión Escolar
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

module.exports = { sendMail, buildInvitacionEmail };
