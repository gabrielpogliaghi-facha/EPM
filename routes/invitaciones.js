const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const EXPIRA_DIAS = 7;

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
function calcExpires() {
  return new Date(Date.now() + EXPIRA_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

// ── GET /api/invitaciones ─────────────────────────────────────────────────────
router.get('/', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  try {
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

// ── POST /api/invitaciones — genera link de invitación ────────────────────────
router.post('/', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  const { rol_id, cursos_ids, nota } = req.body;
  if (!rol_id) return res.status(400).json({ error: 'El rol es requerido' });

  try {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tHash    = hashToken(rawToken);

    const r = await db.execute({
      sql: `INSERT INTO invitaciones (institucion_id, nota, rol_id, token_hash, expires_at, cursos_ids, created_by)
            VALUES (?,?,?,?,?,?,?)`,
      args: [req.user.institucion_id, nota?.trim() || null, rol_id,
             tHash, calcExpires(), JSON.stringify(cursos_ids || []), req.user.id],
    });

    const id = Number(r.lastInsertRowid);
    const { rows: rolRows } = await db.execute({ sql: 'SELECT nombre FROM roles WHERE id=?', args: [rol_id] });

    res.status(201).json({
      id,
      token:      rawToken,
      rol_nombre: rolRows[0]?.nombre || '',
      expires_at: calcExpires(),
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear invitación' });
  }
});

// ── POST /api/invitaciones/:id/reenviar — regenera token ─────────────────────
router.post('/:id/reenviar', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM invitaciones WHERE id=? AND institucion_id=?',
      args: [req.params.id, req.user.institucion_id],
    });
    const inv = rows[0];
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (inv.estado === 'aceptada') return res.status(400).json({ error: 'La invitación ya fue aceptada' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await db.execute({
      sql: `UPDATE invitaciones SET token_hash=?, estado='pendiente', expires_at=?, updated_at=datetime('now') WHERE id=?`,
      args: [hashToken(rawToken), calcExpires(), inv.id],
    });

    const { rows: rolRows } = await db.execute({ sql: 'SELECT nombre FROM roles WHERE id=?', args: [inv.rol_id] });
    res.json({ id: inv.id, token: rawToken, rol_nombre: rolRows[0]?.nombre || '' });
  } catch(e) {
    res.status(500).json({ error: 'Error al regenerar invitación' });
  }
});

// ── DELETE /api/invitaciones/:id ─────────────────────────────────────────────
router.delete('/:id', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM invitaciones WHERE id=? AND institucion_id=?',
      args: [req.params.id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (rows[0].estado === 'aceptada') return res.status(400).json({ error: 'No se puede eliminar una invitación ya aceptada' });

    if (rows[0].estado === 'pendiente') {
      await db.execute({ sql: "UPDATE invitaciones SET estado='cancelada', updated_at=datetime('now') WHERE id=?", args: [req.params.id] });
    } else {
      await db.execute({ sql: 'DELETE FROM invitaciones WHERE id=?', args: [req.params.id] });
    }
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al eliminar invitación' });
  }
});

// ── GET /api/invitaciones/verificar/:token — público ─────────────────────────
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
    if (new Date(inv.expires_at) < new Date())  return res.status(400).json({ error: 'Esta invitación expiró. Pedí un nuevo link.' });

    res.json({
      rol_nombre: inv.rol_nombre,
      rol_id:     inv.rol_id,
      nota:       inv.nota || null,
    });
  } catch(e) {
    res.status(500).json({ error: 'Error al verificar invitación' });
  }
});

// ── POST /api/invitaciones/aceptar — público ─────────────────────────────────
router.post('/aceptar', async (req, res) => {
  const { token, nombre, email, password } = req.body;
  if (!token || !nombre?.trim() || !email?.trim() || !password || password.length < 6)
    return res.status(400).json({ error: 'Token, nombre, email y contraseña (mín. 6 caracteres) requeridos' });

  try {
    const tHash = hashToken(token);
    const { rows } = await db.execute({ sql: 'SELECT * FROM invitaciones WHERE token_hash=?', args: [tHash] });
    const inv = rows[0];
    if (!inv)                                  return res.status(404).json({ error: 'Invitación no encontrada' });
    if (inv.estado !== 'pendiente')            return res.status(400).json({ error: 'Esta invitación ya fue utilizada o cancelada' });
    if (new Date(inv.expires_at) < new Date()) return res.status(400).json({ error: 'Esta invitación expiró. Pedí un nuevo link.' });

    const emailNorm = email.toLowerCase().trim();
    const { rows: dup } = await db.execute({ sql: 'SELECT id FROM usuarios WHERE email=?', args: [emailNorm] });
    if (dup[0]) return res.status(400).json({ error: 'Ya existe una cuenta con ese email. Iniciá sesión.' });

    const r = await db.execute({
      sql: 'INSERT INTO usuarios (institucion_id, nombre, email, password_hash, rol_id) VALUES (?,?,?,?,?)',
      args: [inv.institucion_id, nombre.trim(), emailNorm, bcrypt.hashSync(password, 10), inv.rol_id],
    });
    const usuarioId = Number(r.lastInsertRowid);

    const cursosIds = JSON.parse(inv.cursos_ids || '[]');
    for (const cid of cursosIds) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO usuarios_cursos (usuario_id, curso_id) VALUES (?,?)',
        args: [usuarioId, cid],
      });
    }

    await db.execute({
      sql: "UPDATE invitaciones SET estado='aceptada', email=?, accepted_by=?, updated_at=datetime('now') WHERE id=?",
      args: [emailNorm, usuarioId, inv.id],
    });

    res.json({ ok: true, mensaje: '¡Cuenta creada! Ya podés iniciar sesión.' });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear la cuenta' });
  }
});

module.exports = router;
