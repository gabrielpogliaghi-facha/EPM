const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// Gestión/Admin: ve todas las planificaciones. Docente: solo las suyas.
const esAdmin = req => req.user.permisos?.includes('administrar_cursos');

// GET /api/planificaciones?periodo_id=&curso_id=
router.get('/', verifyToken, requirePermiso('ver_planificaciones'), (req, res) => {
  const { periodo_id, curso_id } = req.query;
  const params = [req.user.institucion_id];
  let filtro = '';
  if (!esAdmin(req)) { filtro += ' AND p.docente_id = ?'; params.push(req.user.id); }
  if (periodo_id)    { filtro += ' AND p.periodo_id = ?'; params.push(Number(periodo_id)); }
  if (curso_id)      { filtro += ' AND p.curso_id   = ?'; params.push(Number(curso_id)); }

  res.json(db.prepare(`
    SELECT p.id, p.titulo, p.descripcion, p.curso_id, p.docente_id, p.periodo_id, p.materia_id,
           c.nombre  AS curso_nombre,
           u.nombre  AS docente_nombre,
           pp.nombre AS periodo_nombre,
           (SELECT COUNT(*) FROM planificacion_contenidos pc WHERE pc.planificacion_id=p.id) AS n_contenidos
    FROM planificaciones p
    JOIN cursos c ON p.curso_id = c.id
    JOIN usuarios u ON p.docente_id = u.id
    LEFT JOIN periodos_planificacion pp ON p.periodo_id = pp.id
    WHERE p.institucion_id = ? ${filtro}
    ORDER BY pp.fecha_inicio DESC, c.nombre, u.nombre
  `).all(...params));
});

// GET /api/planificaciones/:id — con contenidos
router.get('/:id', verifyToken, requirePermiso('ver_planificaciones'), (req, res) => {
  const id = Number(req.params.id);
  const xtra = esAdmin(req) ? [] : [req.user.id];
  const xtraSQL = esAdmin(req) ? '' : 'AND p.docente_id = ?';

  const p = db.prepare(`
    SELECT p.*, c.nombre AS curso_nombre, u.nombre AS docente_nombre, pp.nombre AS periodo_nombre
    FROM planificaciones p
    JOIN cursos c ON p.curso_id = c.id
    JOIN usuarios u ON p.docente_id = u.id
    LEFT JOIN periodos_planificacion pp ON p.periodo_id = pp.id
    WHERE p.id = ? AND p.institucion_id = ? ${xtraSQL}
  `).get(id, req.user.institucion_id, ...xtra);

  if (!p) return res.status(404).json({ error: 'Planificación no encontrada' });
  const contenidos = db.prepare('SELECT * FROM planificacion_contenidos WHERE planificacion_id=? ORDER BY orden, id').all(id);
  res.json({ ...p, contenidos });
});

// POST /api/planificaciones
router.post('/', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const { curso_id, periodo_id, titulo, descripcion } = req.body;
  // FUTURO UNSAM: agregar materia_id opcional aquí
  if (!curso_id) return res.status(400).json({ error: 'Curso requerido' });
  const r = db.prepare(`
    INSERT INTO planificaciones (institucion_id, curso_id, docente_id, periodo_id, titulo, descripcion)
    VALUES (?,?,?,?,?,?)
  `).run(req.user.institucion_id, Number(curso_id), req.user.id,
         periodo_id ? Number(periodo_id) : null,
         titulo?.trim() || null, descripcion?.trim() || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

// PUT /api/planificaciones/:id
router.put('/:id', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const { titulo, descripcion } = req.body;
  const id = Number(req.params.id);
  const xtra = esAdmin(req) ? [] : [req.user.id];
  const xtraSQL = esAdmin(req) ? '' : 'AND docente_id = ?';
  const p = db.prepare(`SELECT id FROM planificaciones WHERE id=? AND institucion_id=? ${xtraSQL}`)
              .get(id, req.user.institucion_id, ...xtra);
  if (!p) return res.status(404).json({ error: 'Planificación no encontrada' });
  db.prepare("UPDATE planificaciones SET titulo=?,descripcion=?,updated_at=datetime('now') WHERE id=?")
    .run(titulo?.trim()||null, descripcion?.trim()||null, id);
  res.json({ success: true });
});

// DELETE /api/planificaciones/:id
router.delete('/:id', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const id = Number(req.params.id);
  const xtra = esAdmin(req) ? [] : [req.user.id];
  const xtraSQL = esAdmin(req) ? '' : 'AND docente_id = ?';
  const p = db.prepare(`SELECT id FROM planificaciones WHERE id=? AND institucion_id=? ${xtraSQL}`)
              .get(id, req.user.institucion_id, ...xtra);
  if (!p) return res.status(404).json({ error: 'Planificación no encontrada' });
  // ON DELETE CASCADE borra los contenidos automáticamente
  db.prepare('DELETE FROM planificaciones WHERE id=?').run(id);
  res.json({ success: true });
});

// ── CONTENIDOS ────────────────────────────────────────────────────────────────
// IMPORTANTE: PUT /orden debe ir ANTES de PUT /:cid para evitar que Express
// tome "orden" como el valor del parámetro :cid.

// PUT /api/planificaciones/:id/contenidos/orden — reordenar todos
router.put('/:id/contenidos/orden', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] requerido' });
  const stmt = db.prepare('UPDATE planificacion_contenidos SET orden=? WHERE id=? AND planificacion_id=?');
  db.exec('BEGIN');
  try {
    items.forEach(({ id, orden }) => stmt.run(Number(orden), Number(id), Number(req.params.id)));
    db.exec('COMMIT');
    res.json({ success: true });
  } catch(e) { db.exec('ROLLBACK'); res.status(500).json({ error: 'Error al reordenar' }); }
});

// GET /api/planificaciones/:id/contenidos
router.get('/:id/contenidos', verifyToken, requirePermiso('ver_planificaciones'), (req, res) => {
  res.json(db.prepare('SELECT * FROM planificacion_contenidos WHERE planificacion_id=? ORDER BY orden, id').all(Number(req.params.id)));
});

// POST /api/planificaciones/:id/contenidos
router.post('/:id/contenidos', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const { titulo, descripcion } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: 'Título requerido' });
  const id = Number(req.params.id);
  const { maxOrden } = db.prepare('SELECT COALESCE(MAX(orden),0) AS maxOrden FROM planificacion_contenidos WHERE planificacion_id=?').get(id);
  const r = db.prepare('INSERT INTO planificacion_contenidos (planificacion_id, titulo, descripcion, orden) VALUES (?,?,?,?)').run(id, titulo.trim(), descripcion?.trim()||null, maxOrden+1);
  res.status(201).json({ id: r.lastInsertRowid, titulo: titulo.trim(), descripcion: descripcion?.trim()||null, orden: maxOrden+1 });
});

// PUT /api/planificaciones/:id/contenidos/:cid
router.put('/:id/contenidos/:cid', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const { titulo, descripcion } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: 'Título requerido' });
  db.prepare('UPDATE planificacion_contenidos SET titulo=?,descripcion=? WHERE id=? AND planificacion_id=?')
    .run(titulo.trim(), descripcion?.trim()||null, Number(req.params.cid), Number(req.params.id));
  res.json({ success: true });
});

// DELETE /api/planificaciones/:id/contenidos/:cid
router.delete('/:id/contenidos/:cid', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  db.prepare('DELETE FROM planificacion_contenidos WHERE id=? AND planificacion_id=?')
    .run(Number(req.params.cid), Number(req.params.id));
  res.json({ success: true });
});

module.exports = router;
