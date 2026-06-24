const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { Resend } = require('resend');
const db      = require('../db');
const { verifyToken } = require('../middleware/auth');

const JWT_SECRET     = process.env.JWT_SECRET     || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const resend = new Resend(process.env.RESEND_API_KEY);

function buildResetEmail(baseUrl, token, userName) {
  const link = `${baseUrl}/?token=${token}`;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resetear contraseña - EPM</title></head>
<body style="margin:0;padding:0;background:#f0f2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,.15);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:32px 40px;text-align:center;">
          <div style="background:#fff;display:inline-block;border-radius:12px;padding:8px 16px;margin-bottom:16px;">
            <img src="${baseUrl}/logo-epm.jpg" alt="EPM" width="48" height="48" style="display:block;border-radius:6px;object-fit:contain;" />
          </div>
          <h1 style="color:#a5b4fc;font-size:22px;font-weight:800;margin:0;">EPM</h1>
          <p style="color:rgba(255,255,255,.6);font-size:13px;margin:4px 0 0;">Sistema de Gestión Escolar</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <h2 style="color:#1e1b4b;font-size:20px;font-weight:700;margin:0 0 12px;">Hola, ${userName}</h2>
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta en EPM.<br>
            Hacé clic en el botón de abajo para elegir una nueva contraseña.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${link}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:700;display:inline-block;letter-spacing:.3px;">
              Resetear contraseña
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 8px;">
            Este enlace expira en <strong>1 hora</strong> y solo puede usarse una vez.
          </p>
          <p style="color:#9ca3af;font-size:13px;margin:0;">
            Si no solicitaste restablecer tu contraseña, ignorá este correo — tu cuenta está segura.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#d1d5db;font-size:12px;margin:0;">
            EPM – Escuela de Música &nbsp;|&nbsp; Sistema de Gestión Escolar
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const { rows } = await db.execute({
      sql: `SELECT u.*, r.nombre AS rol_nombre, i.nombre AS institucion_nombre
            FROM   usuarios u
            JOIN   roles r         ON u.rol_id        = r.id
            JOIN   instituciones i ON u.institucion_id = i.id
            WHERE  u.email = ? AND u.activo = 1`,
      args: [email.toLowerCase().trim()],
    });
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const { rows: permRows } = await db.execute({
      sql: `SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON rp.permiso_id = p.id WHERE rp.rol_id = ?`,
      args: [user.rol_id],
    });
    const permisos = permRows.map(r => r.codigo);

    const payload = {
      id: Number(user.id), nombre: user.nombre, email: user.email,
      rol_id: Number(user.rol_id), rol_nombre: user.rol_nombre,
      institucion_id: Number(user.institucion_id), institucion_nombre: user.institucion_nombre,
      permisos,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: payload });
  } catch (e) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  // Respuesta genérica siempre (no revelar si el email existe o no)
  const ok = { message: 'Si el email existe en el sistema, te enviamos un correo con instrucciones.' };

  if (!email?.trim()) return res.json(ok);

  try {
    const { rows } = await db.execute({
      sql: 'SELECT id, nombre, email FROM usuarios WHERE email=? AND activo=1',
      args: [email.toLowerCase().trim()],
    });
    if (!rows[0]) return res.json(ok);

    const user = rows[0];

    // Invalidar tokens previos del usuario
    await db.execute({ sql: 'UPDATE password_reset_tokens SET used=1 WHERE usuario_id=?', args: [user.id] });

    // Generar token: raw → enviar en email; hash → guardar en DB
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

    await db.execute({
      sql: 'INSERT INTO password_reset_tokens (usuario_id, token_hash, expires_at) VALUES (?,?,?)',
      args: [user.id, tokenHash, expiresAt],
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const html = buildResetEmail(baseUrl, rawToken, user.nombre);

    await resend.emails.send({
      from: 'EPM Sistema <onboarding@resend.dev>',
      to:   user.email,
      subject: 'Restablecer contraseña – EPM',
      html,
    });

    res.json(ok);
  } catch (e) {
    console.error('forgot-password error:', e.message);
    res.json(ok); // siempre respuesta genérica, incluso en error
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6)
    return res.status(400).json({ error: 'Token y contraseña (mín. 6 caracteres) requeridos' });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await db.execute({
      sql: `SELECT t.id, t.usuario_id, t.expires_at, t.used
            FROM password_reset_tokens t
            WHERE t.token_hash = ?`,
      args: [tokenHash],
    });
    const rec = rows[0];

    if (!rec || rec.used) return res.status(400).json({ error: 'El enlace no es válido o ya fue utilizado.' });
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: 'El enlace expiró. Solicitá uno nuevo.' });

    const hash = bcrypt.hashSync(password, 10);
    await db.execute({
      sql: "UPDATE usuarios SET password_hash=?,updated_at=datetime('now') WHERE id=?",
      args: [hash, rec.usuario_id],
    });
    await db.execute({ sql: 'UPDATE password_reset_tokens SET used=1 WHERE id=?', args: [rec.id] });

    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (e) {
    console.error('reset-password error:', e.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// /me consulta la DB para garantizar datos y permisos frescos, devuelve token renovado.
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT u.id, u.nombre, u.email, u.rol_id, u.institucion_id, u.activo,
                   r.nombre AS rol_nombre, i.nombre AS institucion_nombre
            FROM   usuarios u
            JOIN   roles r         ON u.rol_id        = r.id
            JOIN   instituciones i ON u.institucion_id = i.id
            WHERE  u.id = ? AND u.activo = 1`,
      args: [req.user.id],
    });
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });

    const { rows: permRows } = await db.execute({
      sql: `SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON rp.permiso_id = p.id WHERE rp.rol_id = ?`,
      args: [user.rol_id],
    });
    const permisos = permRows.map(r => r.codigo);

    const payload = {
      id: Number(user.id), nombre: user.nombre, email: user.email,
      rol_id: Number(user.rol_id), rol_nombre: user.rol_nombre,
      institucion_id: Number(user.institucion_id), institucion_nombre: user.institucion_nombre,
      permisos,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ user: payload, token });
  } catch (e) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

module.exports = router;
