const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const db       = require('../db');
const { verifyToken }         = require('../middleware/auth');
const { requirePermiso }      = require('../middleware/permission');
const { sendMail, buildInvitacionEmail } = require('../utils/mailer');

const EXPIRA_DIAS = 7;

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
function expiresAt() {
  return new Date(Date.now() + EXPIRA_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

async function enviarInvitacion(db, inv, req) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tHash    = hashToken(rawToken);
  const exp      = expiresAt();

  // Obtener nombre del rol
  const { rows: rolRows } = await db.execute({ sql: 'SELECT nombre FROM roles WHERE id=?', args: [inv.rol_id] });
  const rolNombre = rolRows[0]?.nombre || 'Docente';

  // Obtener nombres de cursos
  let cursoNombres = [];
  if (inv.cursos_ids?.length) {
    const ph = inv.cursos_ids.map(() => '?').join(',');
    const { rows: cRows } = await db.execute({ sql: `SELECT nombre FROM cursos WHERE id IN (${ph})`, args: inv.cursos_ids });
    cursoNombres = cRows.map(r => r.nombre);
  }

  // Guardar en DB
  const r = await db.execute({
    sql: `INSERT INTO invitaciones (institucion_id, email, rol_id, token_hash, expires_at, cursos_ids, created_by)
          VALUES (?,?,?,?,?,?,?)`,
    args: [req.user.institucion_id, inv.email.toLowerCase().trim(), inv.rol_id,
           tHash, exp, JSON.stringify(inv.cursos_ids || []), req.user.id],
  });

  // Protocolo: en Render (proxy SSL) usar x-forwarded-proto; fallback a req.protocol
  const proto   = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${proto}://${req.get('host')}`;
  console.log(`📩 [Invitaciones] Enviando invitación a: ${inv.email} | baseUrl: ${baseUrl} | rol: ${rolNombre}`);

  try {
    const mailResult = await sendMail({
      to:      inv.email,
      subject: 'Te invitamos a unirte al sistema de gestión de la EPM',
      html:    buildInvitacionEmail({ baseUrl, token: rawToken, rolNombre, cursoNombres }),
    });
    if (mailResult?.skipped) {
      console.warn(`⚠️  [Invitaciones] Email NO enviado a ${inv.email} — Gmail no configurado`);
    }
  } catch(e) {
    // El email falló pero la invitación ya está guardada en la DB.
    // Loggeamos completo para verlo en Render, pero no fallamos el request.
    console.error(`❌ [Invitaciones] Falló el envío a ${inv.email} — invitación guardada de todos modos (id=${Number(r.lastInsertRowid)})`);
  }

  return Number(r.lastInsertRowid);
}

// ── GET /api/invitaciones — lista (requiere admin) ────────────────────────────
router.get('/', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  try {
    // Marcar expiradas automáticamente
    await db.execute({
      sql: `UPDATE invitaciones SET estado='expirada', updated_at=datetime('now')
            WHERE estado='pendiente' AND expires_at < datetime('now')`,
      args: [],
    });
    const { rows } = await db.execute({
      sql: `SELECT i.*, r.nombre AS rol_nombre, u.nombre AS creado_por_nombre
            FROM invitaciones i
            LEFT JOIN roles r ON r.id = i.rol_id
            LEFT JOIN usuarios u ON u.id = i.created_by
            WHERE i.institucion_id=?
            ORDER BY i.created_at DESC`,
      args: [req.user.institucion_id],
    });
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener invitaciones' });
  }
});

// ── POST /api/invitaciones — crear (simple o bulk) ────────────────────────────
router.post('/', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  const { emails, rol_id, cursos_ids } = req.body;
  if (!emails?.length) return res.status(400).json({ error: 'Al menos un email es requerido' });
  if (!rol_id)         return res.status(400).json({ error: 'El rol es requerido' });

  // Normalizar lista de emails
  const lista = (Array.isArray(emails) ? emails : [emails])
    .map(e => e.toLowerCase().trim())
    .filter(e => e && e.includes('@'));

  if (!lista.length) return res.status(400).json({ error: 'No hay emails válidos' });

  try {
    const resultados = [];
    for (const email of lista) {
      // Verificar si ya existe usuario con ese email
      const { rows: exist } = await db.execute({ sql: 'SELECT id FROM usuarios WHERE email=?', args: [email] });
      if (exist[0]) { resultados.push({ email, estado: 'ya_registrado' }); continue; }

      // Verificar si ya hay invitación pendiente
      const { rows: pendiente } = await db.execute({
        sql: "SELECT id FROM invitaciones WHERE email=? AND estado='pendiente' AND expires_at > datetime('now') AND institucion_id=?",
        args: [email, req.user.institucion_id],
      });
      if (pendiente[0]) { resultados.push({ email, estado: 'ya_invitado' }); continue; }

      await enviarInvitacion(db, { email, rol_id, cursos_ids: cursos_ids || [] }, req);
      resultados.push({ email, estado: 'enviada' });
    }
    res.status(201).json({ resultados });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear invitación' });
  }
});

// ── POST /api/invitaciones/:id/reenviar ──────────────────────────────────────
// Debe ir ANTES de /:id para que Express no lo confunda
router.post('/:id/reenviar', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM invitaciones WHERE id=? AND institucion_id=?',
      args: [req.params.id, req.user.institucion_id],
    });
    const inv = rows[0];
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (inv.estado === 'aceptada') return res.status(400).json({ error: 'La invitación ya fue aceptada' });

    // Cancelar la vieja y crear una nueva
    await db.execute({
      sql: "UPDATE invitaciones SET estado='cancelada', updated_at=datetime('now') WHERE id=?",
      args: [inv.id],
    });

    await enviarInvitacion(db, {
      email:      inv.email,
      rol_id:     inv.rol_id,
      cursos_ids: JSON.parse(inv.cursos_ids || '[]'),
    }, req);

    res.json({ ok: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al reenviar invitación' });
  }
});

// ── DELETE /api/invitaciones/:id ─────────────────────────────────────────────
// Pendiente → cancela (soft). Cancelada/expirada → elimina físicamente.
// Aceptada → no se puede borrar (tiene usuario creado).
router.delete('/:id', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM invitaciones WHERE id=? AND institucion_id=?',
      args: [req.params.id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (rows[0].estado === 'aceptada') return res.status(400).json({ error: 'No se puede eliminar una invitación ya aceptada' });

    if (rows[0].estado === 'pendiente') {
      // Soft-cancel: mantener el registro para auditoría
      await db.execute({
        sql: "UPDATE invitaciones SET estado='cancelada', updated_at=datetime('now') WHERE id=?",
        args: [req.params.id],
      });
    } else {
      // Cancelada o expirada: eliminar físicamente
      await db.execute({ sql: 'DELETE FROM invitaciones WHERE id=?', args: [req.params.id] });
    }
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al eliminar invitación' });
  }
});

// ── GET /api/invitaciones/verificar/:token — público ──────────────────────────
router.get('/verificar/:token', async (req, res) => {
  try {
    const tHash = hashToken(req.params.token);
    const { rows } = await db.execute({
      sql: `SELECT i.*, r.nombre AS rol_nombre
            FROM invitaciones i JOIN roles r ON r.id = i.rol_id
            WHERE i.token_hash=?`,
      args: [tHash],
    });
    const inv = rows[0];
    if (!inv)                                   return res.status(404).json({ error: 'Invitación no encontrada' });
    if (inv.estado === 'aceptada')              return res.status(400).json({ error: 'Esta invitación ya fue utilizada' });
    if (inv.estado === 'cancelada')             return res.status(400).json({ error: 'Esta invitación fue cancelada' });
    if (new Date(inv.expires_at) < new Date())  return res.status(400).json({ error: 'Esta invitación expiró. Pedí una nueva.' });

    res.json({ email: inv.email, rol_nombre: inv.rol_nombre, rol_id: inv.rol_id });
  } catch(e) {
    res.status(500).json({ error: 'Error al verificar invitación' });
  }
});

// ── POST /api/invitaciones/aceptar — público ─────────────────────────────────
router.post('/aceptar', async (req, res) => {
  const { token, nombre, password } = req.body;
  if (!token || !nombre?.trim() || !password || password.length < 6)
    return res.status(400).json({ error: 'Token, nombre y contraseña (mín. 6 caracteres) requeridos' });

  try {
    const tHash = hashToken(token);
    const { rows } = await db.execute({
      sql: 'SELECT * FROM invitaciones WHERE token_hash=?',
      args: [tHash],
    });
    const inv = rows[0];
    if (!inv)                                  return res.status(404).json({ error: 'Invitación no encontrada' });
    if (inv.estado !== 'pendiente')            return res.status(400).json({ error: 'Esta invitación ya fue utilizada o cancelada' });
    if (new Date(inv.expires_at) < new Date()) return res.status(400).json({ error: 'Esta invitación expiró. Pedí una nueva.' });

    // Verificar que el email no esté ya registrado
    const { rows: dup } = await db.execute({ sql: 'SELECT id FROM usuarios WHERE email=?', args: [inv.email] });
    if (dup[0]) return res.status(400).json({ error: 'Ya existe una cuenta con ese email. Iniciá sesión.' });

    const hash = bcrypt.hashSync(password, 10);
    const r = await db.execute({
      sql: 'INSERT INTO usuarios (institucion_id, nombre, email, password_hash, rol_id) VALUES (?,?,?,?,?)',
      args: [inv.institucion_id, nombre.trim(), inv.email, hash, inv.rol_id],
    });
    const usuarioId = Number(r.lastInsertRowid);

    // Asignar cursos
    const cursosIds = JSON.parse(inv.cursos_ids || '[]');
    for (const cid of cursosIds) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO usuarios_cursos (usuario_id, curso_id) VALUES (?,?)',
        args: [usuarioId, cid],
      });
    }

    // Marcar invitación como aceptada
    await db.execute({
      sql: "UPDATE invitaciones SET estado='aceptada', accepted_by=?, updated_at=datetime('now') WHERE id=?",
      args: [usuarioId, inv.id],
    });

    res.json({ ok: true, mensaje: '¡Cuenta creada! Ya podés iniciar sesión.' });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear la cuenta' });
  }
});

module.exports = router;
