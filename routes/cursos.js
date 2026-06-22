const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// GET /api/cursos/mis-cursos
router.get('/mis-cursos', verifyToken, async (req, res) => {
  try {
    const tieneAdmin = req.user.permisos?.includes('administrar_cursos');
    const sql = tieneAdmin
      ? `SELECT c.id, c.nombre, c.color,
                COUNT(CASE WHEN e.activo=1 THEN 1 END) AS estudiantes
         FROM cursos c LEFT JOIN estudiantes e ON e.curso_id=c.id
         WHERE c.institucion_id=? AND c.activo=1
         GROUP BY c.id ORDER BY c.nombre`
      : `SELECT c.id, c.nombre, c.color,
                COUNT(CASE WHEN e.activo=1 THEN 1 END) AS estudiantes
         FROM usuarios_cursos uc
         JOIN cursos c ON uc.curso_id=c.id
         LEFT JOIN estudiantes e ON e.curso_id=c.id AND e.activo=1
         WHERE uc.usuario_id=? AND c.activo=1
         GROUP BY c.id ORDER BY c.nombre`;
    const arg = tieneAdmin ? req.user.institucion_id : req.user.id;
    const { rows } = await db.execute({ sql, args: [arg] });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener cursos' });
  }
});

// GET /api/cursos
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT c.id, c.nombre, c.color,
                   COUNT(CASE WHEN e.activo = 1 THEN 1 END) AS estudiantes
            FROM   cursos c LEFT JOIN estudiantes e ON e.curso_id = c.id
            WHERE  c.institucion_id = ? AND c.activo = 1
            GROUP  BY c.id ORDER BY c.nombre`,
      args: [req.user.institucion_id],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener cursos' });
  }
});

// GET /api/cursos/:id/info
router.get('/:id/info', verifyToken, requirePermiso('administrar_cursos'), async (req, res) => {
  try {
    const { rows: cRows } = await db.execute({
      sql: 'SELECT * FROM cursos WHERE id = ? AND institucion_id = ?',
      args: [req.params.id, req.user.institucion_id],
    });
    if (!cRows[0]) return res.status(404).json({ error: 'Curso no encontrado' });

    const { rows: eRows } = await db.execute({
      sql: 'SELECT COUNT(*) AS estudiantes FROM estudiantes WHERE curso_id = ? AND activo = 1',
      args: [req.params.id],
    });
    res.json({ curso: cRows[0], estudiantes: Number(eRows[0].estudiantes) });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener info del curso' });
  }
});

// POST /api/cursos
router.post('/', verifyToken, requirePermiso('administrar_cursos'), async (req, res) => {
  const nombre = req.body.nombre?.trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const r = await db.execute({
      sql: 'INSERT INTO cursos (institucion_id, nombre) VALUES (?, ?)',
      args: [req.user.institucion_id, nombre],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), nombre });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un curso con ese nombre' });
    res.status(500).json({ error: 'Error al crear curso' });
  }
});

// PUT /api/cursos/:id
router.put('/:id', verifyToken, requirePermiso('administrar_cursos'), async (req, res) => {
  const nombre = req.body.nombre?.trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM cursos WHERE id = ? AND institucion_id = ?',
      args: [req.params.id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Curso no encontrado' });

    await db.execute({ sql: 'UPDATE cursos SET nombre = ? WHERE id = ?', args: [nombre, req.params.id] });
    res.json({ success: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un curso con ese nombre' });
    res.status(500).json({ error: 'Error al actualizar curso' });
  }
});

// DELETE /api/cursos/:id
router.delete('/:id', verifyToken, requirePermiso('administrar_cursos'), async (req, res) => {
  try {
    const { rows: cRows } = await db.execute({
      sql: 'SELECT * FROM cursos WHERE id = ? AND institucion_id = ?',
      args: [req.params.id, req.user.institucion_id],
    });
    if (!cRows[0]) return res.status(404).json({ error: 'Curso no encontrado' });

    const { rows: eRows } = await db.execute({
      sql: 'SELECT COUNT(*) AS estudiantes FROM estudiantes WHERE curso_id = ? AND activo = 1',
      args: [req.params.id],
    });
    const estudiantes = Number(eRows[0].estudiantes);

    if (estudiantes > 0) {
      await db.execute({ sql: 'UPDATE cursos SET activo = 0 WHERE id = ?', args: [req.params.id] });
      res.json({ success: true, accion: 'desactivado', estudiantes });
    } else {
      await db.execute({ sql: 'DELETE FROM cursos WHERE id = ?', args: [req.params.id] });
      res.json({ success: true, accion: 'eliminado', estudiantes: 0 });
    }
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar curso' });
  }
});

module.exports = router;
