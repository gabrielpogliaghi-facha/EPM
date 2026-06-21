const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const admin = [verifyToken, requirePermiso('administrar_usuarios_roles')];

// Verifica que exista al menos 1 administrador activo, opcionalmente excluyendo un usuario
function hayOtroAdmin(excludeId = null) {
  const sql = `
    SELECT COUNT(*) AS c FROM usuarios u
    JOIN roles_permisos rp ON rp.rol_id    = u.rol_id
    JOIN permisos p         ON rp.permiso_id = p.id
    WHERE p.codigo = 'administrar_usuarios_roles' AND u.activo = 1
    ${excludeId ? 'AND u.id != ?' : ''}
  `;
  const row = excludeId
    ? db.prepare(sql).get(excludeId)
    : db.prepare(sql).get();
  return row.c > 0;
}

// GET /api/usuarios
router.get('/', ...admin, (req, res) => {
  const usuarios = db.prepare(`
    SELECT u.id, u.nombre, u.email, u.activo, u.created_at,
           r.id AS rol_id, r.nombre AS rol_nombre
    FROM   usuarios u
    JOIN   roles r ON u.rol_id = r.id
    WHERE  u.institucion_id = ?
    ORDER  BY u.nombre
  `).all(req.user.institucion_id);

  res.json(usuarios.map(u => ({
    ...u,
    cursos: db.prepare(`
      SELECT c.id, c.nombre FROM usuarios_cursos uc
      JOIN cursos c ON uc.curso_id = c.id
      WHERE uc.usuario_id = ? AND uc.materia_id IS NULL
    `).all(u.id)
  })));
});

// POST /api/usuarios
router.post('/', ...admin, (req, res) => {
  const { nombre, email, password, rol_id } = req.body;
  if (!nombre?.trim() || !email?.trim() || !password || !rol_id)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const r = db.prepare(`
      INSERT INTO usuarios (institucion_id, nombre, email, password_hash, rol_id)
      VALUES (?,?,?,?,?)
    `).run(req.user.institucion_id, nombre.trim(), email.toLowerCase().trim(),
           bcrypt.hashSync(password, 10), Number(rol_id));
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', ...admin, (req, res) => {
  const { nombre, email, rol_id } = req.body;
  if (!nombre?.trim() || !email?.trim() || !rol_id)
    return res.status(400).json({ error: 'Nombre, email y rol son requeridos' });

  const id = Number(req.params.id);
  const u  = db.prepare('SELECT id, rol_id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1')
               .get(id, req.user.institucion_id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  const nuevoRolId = Number(rol_id);
  if (nuevoRolId !== u.rol_id) {
    const nuevoTieneAdmin = db.prepare(`
      SELECT 1 FROM roles_permisos rp JOIN permisos p ON rp.permiso_id=p.id
      WHERE rp.rol_id=? AND p.codigo='administrar_usuarios_roles'
    `).get(nuevoRolId);
    if (!nuevoTieneAdmin && !hayOtroAdmin(id)) {
      return res.status(409).json({ error: 'Este cambio dejaría el sistema sin administrador.' });
    }
  }

  try {
    db.prepare(`UPDATE usuarios SET nombre=?,email=?,rol_id=?,updated_at=datetime('now') WHERE id=?`)
      .run(nombre.trim(), email.toLowerCase().trim(), nuevoRolId, id);
    res.json({ success: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PUT /api/usuarios/:id/password
router.put('/:id/password', ...admin, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const id = Number(req.params.id);
  const u  = db.prepare('SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1')
               .get(id, req.user.institucion_id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  db.prepare("UPDATE usuarios SET password_hash=?,updated_at=datetime('now') WHERE id=?")
    .run(bcrypt.hashSync(password, 10), id);
  res.json({ success: true });
});

// PUT /api/usuarios/:id/cursos
router.put('/:id/cursos', ...admin, (req, res) => {
  const { cursos } = req.body;
  const id = Number(req.params.id);
  const u  = db.prepare('SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1')
               .get(id, req.user.institucion_id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM usuarios_cursos WHERE usuario_id=? AND materia_id IS NULL').run(id);
    if (Array.isArray(cursos)) {
      const ins = db.prepare('INSERT INTO usuarios_cursos (usuario_id, curso_id) VALUES (?,?)');
      cursos.forEach(cid => ins.run(id, Number(cid)));
    }
    db.exec('COMMIT');
    res.json({ success: true });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Error al actualizar cursos' });
  }
});

// DELETE /api/usuarios/:id — soft delete
router.delete('/:id', ...admin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(409).json({ error: 'No podés dar de baja tu propia cuenta' });

  const u = db.prepare('SELECT id, nombre FROM usuarios WHERE id=? AND institucion_id=? AND activo=1')
              .get(id, req.user.institucion_id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (!hayOtroAdmin(id))
    return res.status(409).json({ error: 'Este usuario es el único administrador del sistema y no puede eliminarse.' });

  db.prepare("UPDATE usuarios SET activo=0,updated_at=datetime('now') WHERE id=?").run(id);
  res.json({ success: true });
});

module.exports = router;
