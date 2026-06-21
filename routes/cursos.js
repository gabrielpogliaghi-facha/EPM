const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// GET /api/cursos/mis-cursos — cursos accesibles para el usuario actual
// Gestión/Operador (administrar_cursos): ven todos. Docente: solo sus asignados.
router.get('/mis-cursos', verifyToken, (req, res) => {
  const sql = req.user.permisos?.includes('administrar_cursos')
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

  const param = req.user.permisos?.includes('administrar_cursos')
    ? req.user.institucion_id : req.user.id;

  res.json(db.prepare(sql).all(param));
});

// GET /api/cursos — lista cursos activos con conteo de estudiantes activos
router.get('/', verifyToken, (req, res) => {
  const cursos = db.prepare(`
    SELECT c.id, c.nombre, c.color,
           COUNT(CASE WHEN e.activo = 1 THEN 1 END) AS estudiantes
    FROM   cursos c
    LEFT JOIN estudiantes e ON e.curso_id = c.id
    WHERE  c.institucion_id = ? AND c.activo = 1
    GROUP  BY c.id
    ORDER  BY c.nombre
  `).all(req.user.institucion_id);
  res.json(cursos);
});

// GET /api/cursos/:id/info — info de un curso (para el pop-up de confirmación antes de eliminar)
router.get('/:id/info', verifyToken, requirePermiso('administrar_cursos'), (req, res) => {
  const curso = db.prepare(
    'SELECT * FROM cursos WHERE id = ? AND institucion_id = ?'
  ).get(req.params.id, req.user.institucion_id);
  if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

  const { estudiantes } = db.prepare(
    'SELECT COUNT(*) AS estudiantes FROM estudiantes WHERE curso_id = ? AND activo = 1'
  ).get(req.params.id);

  res.json({ curso, estudiantes });
});

// POST /api/cursos — crear curso
router.post('/', verifyToken, requirePermiso('administrar_cursos'), (req, res) => {
  const nombre = req.body.nombre?.trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

  try {
    const r = db.prepare(
      'INSERT INTO cursos (institucion_id, nombre) VALUES (?, ?)'
    ).run(req.user.institucion_id, nombre);
    res.status(201).json({ id: r.lastInsertRowid, nombre });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un curso con ese nombre' });
    res.status(500).json({ error: 'Error al crear curso' });
  }
});

// PUT /api/cursos/:id — renombrar curso
router.put('/:id', verifyToken, requirePermiso('administrar_cursos'), (req, res) => {
  const nombre = req.body.nombre?.trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

  const curso = db.prepare(
    'SELECT id FROM cursos WHERE id = ? AND institucion_id = ?'
  ).get(req.params.id, req.user.institucion_id);
  if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

  try {
    db.prepare('UPDATE cursos SET nombre = ? WHERE id = ?').run(nombre, req.params.id);
    res.json({ success: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un curso con ese nombre' });
    res.status(500).json({ error: 'Error al actualizar curso' });
  }
});

// DELETE /api/cursos/:id — política:
//   • Con estudiantes activos → desactiva (activo=0); los alumnos quedan intactos, sin curso asignado.
//   • Sin estudiantes → elimina permanentemente.
router.delete('/:id', verifyToken, requirePermiso('administrar_cursos'), (req, res) => {
  const curso = db.prepare(
    'SELECT * FROM cursos WHERE id = ? AND institucion_id = ?'
  ).get(req.params.id, req.user.institucion_id);
  if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

  const { estudiantes } = db.prepare(
    'SELECT COUNT(*) AS estudiantes FROM estudiantes WHERE curso_id = ? AND activo = 1'
  ).get(req.params.id);

  if (estudiantes > 0) {
    db.prepare('UPDATE cursos SET activo = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, accion: 'desactivado', estudiantes });
  } else {
    db.prepare('DELETE FROM cursos WHERE id = ?').run(req.params.id);
    res.json({ success: true, accion: 'eliminado', estudiantes: 0 });
  }
});

module.exports = router;
