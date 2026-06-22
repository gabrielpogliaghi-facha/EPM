const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const esAdmin = req => req.user.permisos?.includes('administrar_cursos');

// GET /api/planificaciones
router.get('/', verifyToken, requirePermiso('ver_planificaciones'), async (req, res) => {
  try {
    const { periodo_id, curso_id } = req.query;
    const args = [req.user.institucion_id];
    let filtro = '';
    if (!esAdmin(req)) { filtro += ' AND p.docente_id = ?'; args.push(req.user.id); }
    if (periodo_id)    { filtro += ' AND p.periodo_id = ?'; args.push(Number(periodo_id)); }
    if (curso_id)      { filtro += ' AND p.curso_id   = ?'; args.push(Number(curso_id)); }

    const { rows } = await db.execute({
      sql: `SELECT p.id, p.titulo, p.descripcion, p.curso_id, p.docente_id, p.periodo_id, p.materia_id,
                   c.nombre AS curso_nombre, u.nombre AS docente_nombre, pp.nombre AS periodo_nombre,
                   (SELECT COUNT(*) FROM planificacion_contenidos pc WHERE pc.planificacion_id=p.id) AS n_contenidos
            FROM planificaciones p
            JOIN cursos c ON p.curso_id = c.id
            JOIN usuarios u ON p.docente_id = u.id
            LEFT JOIN periodos_planificacion pp ON p.periodo_id = pp.id
            WHERE p.institucion_id = ? ${filtro}
            ORDER BY pp.fecha_inicio DESC, c.nombre, u.nombre`,
      args,
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener planificaciones' });
  }
});

// GET /api/planificaciones/:id
router.get('/:id', verifyToken, requirePermiso('ver_planificaciones'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const args = [id, req.user.institucion_id];
    const xtraSQL = esAdmin(req) ? '' : 'AND p.docente_id = ?';
    if (!esAdmin(req)) args.push(req.user.id);

    const { rows } = await db.execute({
      sql: `SELECT p.*, c.nombre AS curso_nombre, u.nombre AS docente_nombre, pp.nombre AS periodo_nombre
            FROM planificaciones p
            JOIN cursos c ON p.curso_id = c.id
            JOIN usuarios u ON p.docente_id = u.id
            LEFT JOIN periodos_planificacion pp ON p.periodo_id = pp.id
            WHERE p.id = ? AND p.institucion_id = ? ${xtraSQL}`,
      args,
    });
    if (!rows[0]) return res.status(404).json({ error: 'Planificación no encontrada' });

    const { rows: contenidos } = await db.execute({
      sql: 'SELECT * FROM planificacion_contenidos WHERE planificacion_id=? ORDER BY orden, id',
      args: [id],
    });
    res.json({ ...rows[0], contenidos });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener planificación' });
  }
});

// POST /api/planificaciones
router.post('/', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  const { curso_id, periodo_id, titulo, descripcion } = req.body;
  if (!curso_id) return res.status(400).json({ error: 'Curso requerido' });
  try {
    const r = await db.execute({
      sql: 'INSERT INTO planificaciones (institucion_id, curso_id, docente_id, periodo_id, titulo, descripcion) VALUES (?,?,?,?,?,?)',
      args: [req.user.institucion_id, Number(curso_id), req.user.id,
             periodo_id ? Number(periodo_id) : null,
             titulo?.trim() || null, descripcion?.trim() || null],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Error al crear planificación' });
  }
});

// PUT /api/planificaciones/:id
router.put('/:id', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  const { titulo, descripcion } = req.body;
  const id = Number(req.params.id);
  try {
    const args = [id, req.user.institucion_id];
    const xtraSQL = esAdmin(req) ? '' : 'AND docente_id = ?';
    if (!esAdmin(req)) args.push(req.user.id);
    const { rows } = await db.execute({ sql: `SELECT id FROM planificaciones WHERE id=? AND institucion_id=? ${xtraSQL}`, args });
    if (!rows[0]) return res.status(404).json({ error: 'Planificación no encontrada' });

    await db.execute({
      sql: "UPDATE planificaciones SET titulo=?,descripcion=?,updated_at=datetime('now') WHERE id=?",
      args: [titulo?.trim() || null, descripcion?.trim() || null, id],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar planificación' });
  }
});

// DELETE /api/planificaciones/:id
router.delete('/:id', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const args = [id, req.user.institucion_id];
    const xtraSQL = esAdmin(req) ? '' : 'AND docente_id = ?';
    if (!esAdmin(req)) args.push(req.user.id);
    const { rows } = await db.execute({ sql: `SELECT id FROM planificaciones WHERE id=? AND institucion_id=? ${xtraSQL}`, args });
    if (!rows[0]) return res.status(404).json({ error: 'Planificación no encontrada' });

    await db.execute({ sql: 'DELETE FROM planificaciones WHERE id=?', args: [id] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar planificación' });
  }
});

// ── CONTENIDOS ────────────────────────────────────────────────────────────────
// IMPORTANTE: PUT /orden debe ir ANTES de PUT /:cid

// PUT /api/planificaciones/:id/contenidos/orden
router.put('/:id/contenidos/orden', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] requerido' });
  try {
    await db.batch(
      items.map(({ id, orden }) => ({
        sql: 'UPDATE planificacion_contenidos SET orden=? WHERE id=? AND planificacion_id=?',
        args: [Number(orden), Number(id), Number(req.params.id)],
      })),
      'write'
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al reordenar' });
  }
});

// GET /api/planificaciones/:id/contenidos
router.get('/:id/contenidos', verifyToken, requirePermiso('ver_planificaciones'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM planificacion_contenidos WHERE planificacion_id=? ORDER BY orden, id',
      args: [Number(req.params.id)],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener contenidos' });
  }
});

// POST /api/planificaciones/:id/contenidos
router.post('/:id/contenidos', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  const { titulo, descripcion } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: 'Título requerido' });
  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({
      sql: 'SELECT COALESCE(MAX(orden),0) AS maxOrden FROM planificacion_contenidos WHERE planificacion_id=?',
      args: [id],
    });
    const maxOrden = Number(rows[0].maxOrden);
    const r = await db.execute({
      sql: 'INSERT INTO planificacion_contenidos (planificacion_id, titulo, descripcion, orden) VALUES (?,?,?,?)',
      args: [id, titulo.trim(), descripcion?.trim() || null, maxOrden + 1],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), titulo: titulo.trim(), descripcion: descripcion?.trim() || null, orden: maxOrden + 1 });
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar contenido' });
  }
});

// PUT /api/planificaciones/:id/contenidos/:cid
router.put('/:id/contenidos/:cid', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  const { titulo, descripcion } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: 'Título requerido' });
  try {
    await db.execute({
      sql: 'UPDATE planificacion_contenidos SET titulo=?,descripcion=? WHERE id=? AND planificacion_id=?',
      args: [titulo.trim(), descripcion?.trim() || null, Number(req.params.cid), Number(req.params.id)],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar contenido' });
  }
});

// DELETE /api/planificaciones/:id/contenidos/:cid
router.delete('/:id/contenidos/:cid', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM planificacion_contenidos WHERE id=? AND planificacion_id=?',
      args: [Number(req.params.cid), Number(req.params.id)],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar contenido' });
  }
});

module.exports = router;
