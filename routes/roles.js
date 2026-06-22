const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const admin = [verifyToken, requirePermiso('administrar_usuarios_roles')];

// GET /api/roles
router.get('/', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  try {
    const { rows: roles } = await db.execute('SELECT id, nombre, descripcion, es_sistema FROM roles ORDER BY nombre');

    const result = await Promise.all(roles.map(async r => {
      const { rows: pRows } = await db.execute({
        sql: `SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON rp.permiso_id=p.id WHERE rp.rol_id=?`,
        args: [r.id],
      });
      const { rows: uRows } = await db.execute({
        sql: 'SELECT COUNT(*) AS c FROM usuarios WHERE rol_id=? AND activo=1',
        args: [r.id],
      });
      return { ...r, permisos: pRows.map(p => p.codigo), usuarios_count: Number(uRows[0].c) };
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener roles' });
  }
});

// GET /api/roles/permisos
router.get('/permisos', verifyToken, requirePermiso('administrar_usuarios_roles'), async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM permisos ORDER BY grupo, codigo');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener permisos' });
  }
});

// POST /api/roles
router.post('/', ...admin, async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const r = await db.execute({
      sql: 'INSERT INTO roles (institucion_id, nombre, descripcion) VALUES (?,?,?)',
      args: [req.user.institucion_id, nombre.trim(), descripcion?.trim() || null],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Error al crear rol' });
  }
});

// PUT /api/roles/:id/permisos
router.put('/:id/permisos', ...admin, async (req, res) => {
  const { permisos } = req.body;
  if (!Array.isArray(permisos)) return res.status(400).json({ error: 'Array de permisos requerido' });

  const rolId = Number(req.params.id);
  try {
    const { rows: rolRows } = await db.execute({ sql: 'SELECT id FROM roles WHERE id=?', args: [rolId] });
    if (!rolRows[0]) return res.status(404).json({ error: 'Rol no encontrado' });

    if (!permisos.includes('administrar_usuarios_roles')) {
      const { rows: otrosRows } = await db.execute({
        sql: `SELECT COUNT(*) AS c FROM usuarios u
              JOIN roles_permisos rp ON rp.rol_id    = u.rol_id
              JOIN permisos p         ON rp.permiso_id = p.id
              WHERE p.codigo='administrar_usuarios_roles' AND u.activo=1 AND u.rol_id != ?`,
        args: [rolId],
      });
      if (Number(otrosRows[0].c) === 0) {
        return res.status(409).json({ error: 'No se puede quitar "Administrar usuarios y roles" si este es el único rol con ese permiso.' });
      }
    }

    // Obtener IDs de permisos en una sola query
    const ph = permisos.map(() => '?').join(',');
    const { rows: pRows } = permisos.length > 0
      ? await db.execute({ sql: `SELECT id, codigo FROM permisos WHERE codigo IN (${ph})`, args: permisos })
      : { rows: [] };
    const permisoIds = pRows.map(p => Number(p.id));

    const stmts = [{ sql: 'DELETE FROM roles_permisos WHERE rol_id=?', args: [rolId] }];
    permisoIds.forEach(pid => stmts.push({ sql: 'INSERT INTO roles_permisos (rol_id, permiso_id) VALUES (?,?)', args: [rolId, pid] }));
    await db.batch(stmts, 'write');

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar permisos' });
  }
});

// DELETE /api/roles/:id
router.delete('/:id', ...admin, async (req, res) => {
  const rolId = Number(req.params.id);
  try {
    const { rows } = await db.execute({ sql: 'SELECT id, nombre, es_sistema FROM roles WHERE id=?', args: [rolId] });
    if (!rows[0]) return res.status(404).json({ error: 'Rol no encontrado' });
    if (rows[0].es_sistema) return res.status(409).json({ error: 'Los roles base del sistema no se pueden eliminar' });

    const { rows: uRows } = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM usuarios WHERE rol_id=? AND activo=1', args: [rolId] });
    const c = Number(uRows[0].c);
    if (c > 0) return res.status(409).json({ error: `Hay ${c} usuario(s) con este rol. Reasignálos antes de eliminar.` });

    await db.execute({ sql: 'DELETE FROM roles WHERE id=?', args: [rolId] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar rol' });
  }
});

module.exports = router;
