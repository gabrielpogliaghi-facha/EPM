const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const admin = [verifyToken, requirePermiso('administrar_usuarios_roles')];

// GET /api/roles — roles con sus permisos y cantidad de usuarios
router.get('/', verifyToken, requirePermiso('administrar_usuarios_roles'), (req, res) => {
  const roles = db.prepare('SELECT id, nombre, descripcion, es_sistema FROM roles ORDER BY nombre').all();
  res.json(roles.map(r => ({
    ...r,
    permisos: db.prepare(`
      SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON rp.permiso_id=p.id WHERE rp.rol_id=?
    `).all(r.id).map(p => p.codigo),
    usuarios_count: db.prepare('SELECT COUNT(*) AS c FROM usuarios WHERE rol_id=? AND activo=1').get(r.id).c
  })));
});

// GET /api/roles/permisos — catálogo completo
router.get('/permisos', verifyToken, requirePermiso('administrar_usuarios_roles'), (req, res) => {
  res.json(db.prepare('SELECT * FROM permisos ORDER BY grupo, codigo').all());
});

// POST /api/roles — crear rol personalizado
router.post('/', ...admin, (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const r = db.prepare('INSERT INTO roles (institucion_id, nombre, descripcion) VALUES (?,?,?)')
               .run(req.user.institucion_id, nombre.trim(), descripcion?.trim() || null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: 'Error al crear rol' });
  }
});

// PUT /api/roles/:id/permisos — actualizar permisos de un rol
router.put('/:id/permisos', ...admin, (req, res) => {
  const { permisos } = req.body;
  if (!Array.isArray(permisos)) return res.status(400).json({ error: 'Array de permisos requerido' });

  const rolId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM roles WHERE id=?').get(rolId))
    return res.status(404).json({ error: 'Rol no encontrado' });

  // Seguridad: si se quita administrar_usuarios_roles de este rol,
  // verificar que quede al menos 1 usuario admin por otro rol
  if (!permisos.includes('administrar_usuarios_roles')) {
    const otrosAdmins = db.prepare(`
      SELECT COUNT(*) AS c FROM usuarios u
      JOIN roles_permisos rp ON rp.rol_id    = u.rol_id
      JOIN permisos p         ON rp.permiso_id = p.id
      WHERE p.codigo='administrar_usuarios_roles' AND u.activo=1 AND u.rol_id != ?
    `).get(rolId).c;
    if (otrosAdmins === 0) {
      return res.status(409).json({ error: 'No se puede quitar "Administrar usuarios y roles" si este es el único rol con ese permiso.' });
    }
  }

  const permisoIds = permisos.map(codigo =>
    db.prepare('SELECT id FROM permisos WHERE codigo=?').get(codigo)?.id
  ).filter(Boolean);

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM roles_permisos WHERE rol_id=?').run(rolId);
    const ins = db.prepare('INSERT INTO roles_permisos (rol_id, permiso_id) VALUES (?,?)');
    permisoIds.forEach(pid => ins.run(rolId, pid));
    db.exec('COMMIT');
    res.json({ success: true });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Error al actualizar permisos' });
  }
});

// DELETE /api/roles/:id — solo roles no-sistema y sin usuarios
router.delete('/:id', ...admin, (req, res) => {
  const rolId = Number(req.params.id);
  const rol = db.prepare('SELECT id, nombre, es_sistema FROM roles WHERE id=?').get(rolId);
  if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
  if (rol.es_sistema) return res.status(409).json({ error: 'Los roles base del sistema no se pueden eliminar' });

  const { c } = db.prepare('SELECT COUNT(*) AS c FROM usuarios WHERE rol_id=? AND activo=1').get(rolId);
  if (c > 0) return res.status(409).json({ error: `Hay ${c} usuario(s) con este rol. Reasignálos antes de eliminar.` });

  db.prepare('DELETE FROM roles WHERE id=?').run(rolId);
  res.json({ success: true });
});

module.exports = router;
