const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const admin = [verifyToken, requirePermiso('administrar_usuarios_roles')];

async function hayOtroAdmin(excludeId = null) {
  const sql = `
    SELECT COUNT(*) AS c FROM usuarios u
    JOIN roles_permisos rp ON rp.rol_id    = u.rol_id
    JOIN permisos p         ON rp.permiso_id = p.id
    WHERE p.codigo = 'administrar_usuarios_roles' AND u.activo = 1
    ${excludeId ? 'AND u.id != ?' : ''}
  `;
  const args = excludeId ? [excludeId] : [];
  const { rows } = await db.execute({ sql, args });
  return Number(rows[0].c) > 0;
}

// GET /api/usuarios  →  solo activos
// GET /api/usuarios?inactivos=1  →  solo inactivos
router.get('/', ...admin, async (req, res) => {
  const soloInactivos = req.query.inactivos === '1';
  try {
    const { rows: usuarios } = await db.execute({
      sql: `SELECT u.id, u.nombre, u.email, u.activo, u.created_at,
                   r.id AS rol_id, r.nombre AS rol_nombre
            FROM   usuarios u JOIN roles r ON u.rol_id = r.id
            WHERE  u.institucion_id = ? AND u.activo = ?
            ORDER BY u.nombre`,
      args: [req.user.institucion_id, soloInactivos ? 0 : 1],
    });

    const result = await Promise.all(usuarios.map(async u => {
      const { rows: cursos } = await db.execute({
        sql: `SELECT c.id, c.nombre FROM usuarios_cursos uc JOIN cursos c ON uc.curso_id = c.id WHERE uc.usuario_id = ? AND uc.materia_id IS NULL`,
        args: [u.id],
      });
      return { ...u, cursos };
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios/:id/reactivar  (debe ir ANTES de /:id para no colisionar)
router.post('/:id/reactivar', ...admin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id, nombre FROM usuarios WHERE id=? AND institucion_id=? AND activo=0',
      args: [id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Usuario inactivo no encontrado' });
    await db.execute({ sql: "UPDATE usuarios SET activo=1, updated_at=datetime('now') WHERE id=?", args: [id] });
    res.json({ ok: true, nombre: rows[0].nombre });
  } catch(e) {
    res.status(500).json({ error: 'Error al reactivar usuario' });
  }
});

// POST /api/usuarios
router.post('/', ...admin, async (req, res) => {
  const { nombre, email, password, rol_id, cursos } = req.body;
  if (!nombre?.trim() || !email?.trim() || !password || !rol_id)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const r = await db.execute({
      sql: 'INSERT INTO usuarios (institucion_id, nombre, email, password_hash, rol_id) VALUES (?,?,?,?,?)',
      args: [req.user.institucion_id, nombre.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password, 10), Number(rol_id)],
    });
    const userId = Number(r.lastInsertRowid);

    if (Array.isArray(cursos) && cursos.length > 0) {
      await db.batch(
        cursos.map(cid => ({ sql: 'INSERT INTO usuarios_cursos (usuario_id, curso_id) VALUES (?,?)', args: [userId, Number(cid)] })),
        'write'
      );
    }
    res.status(201).json({ id: userId });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', ...admin, async (req, res) => {
  const { nombre, email, rol_id } = req.body;
  if (!nombre?.trim() || !email?.trim() || !rol_id)
    return res.status(400).json({ error: 'Nombre, email y rol son requeridos' });

  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id, rol_id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1',
      args: [id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    const nuevoRolId = Number(rol_id);
    if (nuevoRolId !== Number(rows[0].rol_id)) {
      const { rows: nuevoRolRows } = await db.execute({
        sql: `SELECT 1 FROM roles_permisos rp JOIN permisos p ON rp.permiso_id=p.id WHERE rp.rol_id=? AND p.codigo='administrar_usuarios_roles'`,
        args: [nuevoRolId],
      });
      if (!nuevoRolRows[0] && !(await hayOtroAdmin(id))) {
        return res.status(409).json({ error: 'Este cambio dejaría el sistema sin administrador.' });
      }
    }

    await db.execute({
      sql: `UPDATE usuarios SET nombre=?,email=?,rol_id=?,updated_at=datetime('now') WHERE id=?`,
      args: [nombre.trim(), email.toLowerCase().trim(), nuevoRolId, id],
    });
    res.json({ success: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PUT /api/usuarios/:id/password
router.put('/:id/password', ...admin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1',
      args: [id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.execute({
      sql: "UPDATE usuarios SET password_hash=?,updated_at=datetime('now') WHERE id=?",
      args: [bcrypt.hashSync(password, 10), id],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// PUT /api/usuarios/:id/cursos
router.put('/:id/cursos', ...admin, async (req, res) => {
  const { cursos } = req.body;
  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1',
      args: [id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    const stmts = [{ sql: 'DELETE FROM usuarios_cursos WHERE usuario_id=? AND materia_id IS NULL', args: [id] }];
    if (Array.isArray(cursos)) {
      cursos.forEach(cid => stmts.push({ sql: 'INSERT INTO usuarios_cursos (usuario_id, curso_id) VALUES (?,?)', args: [id, Number(cid)] }));
    }
    await db.batch(stmts, 'write');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar cursos' });
  }
});

// DELETE /api/usuarios/:id — soft delete
router.delete('/:id', ...admin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(409).json({ error: 'No podés dar de baja tu propia cuenta' });

  try {
    const { rows } = await db.execute({
      sql: 'SELECT id, nombre FROM usuarios WHERE id=? AND institucion_id=? AND activo=1',
      args: [id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!(await hayOtroAdmin(id)))
      return res.status(409).json({ error: 'Este usuario es el único administrador del sistema y no puede eliminarse.' });

    await db.execute({ sql: "UPDATE usuarios SET activo=0,updated_at=datetime('now') WHERE id=?", args: [id] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al dar de baja usuario' });
  }
});

module.exports = router;
