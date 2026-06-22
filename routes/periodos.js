const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// GET /api/periodos/ciclos
router.get('/ciclos', verifyToken, async (req, res) => {
  try {
    const { rows: ciclos } = await db.execute({
      sql: 'SELECT * FROM ciclos_lectivos WHERE institucion_id=? AND activo=1 ORDER BY anio DESC',
      args: [req.user.institucion_id],
    });
    const result = await Promise.all(ciclos.map(async c => {
      const { rows: semestres } = await db.execute({
        sql: 'SELECT * FROM semestres WHERE ciclo_lectivo_id=? ORDER BY numero',
        args: [c.id],
      });
      return { ...c, semestres };
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener ciclos' });
  }
});

// PUT /api/periodos/semestres/:id
router.put('/semestres/:id', verifyToken, requirePermiso('editar_reportes'), async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.body;
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Fechas requeridas' });
  if (fecha_inicio >= fecha_fin) return res.status(400).json({ error: 'Inicio debe ser anterior al fin' });
  try {
    const { rows } = await db.execute({
      sql: `SELECT s.id FROM semestres s JOIN ciclos_lectivos cl ON s.ciclo_lectivo_id = cl.id WHERE s.id = ? AND cl.institucion_id = ?`,
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Semestre no encontrado' });

    await db.execute({
      sql: 'UPDATE semestres SET fecha_inicio=?, fecha_fin=? WHERE id=?',
      args: [fecha_inicio, fecha_fin, Number(req.params.id)],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar semestre' });
  }
});

// GET /api/periodos/planificacion
router.get('/planificacion', verifyToken, async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM periodos_planificacion WHERE institucion_id=? AND activo=1 ORDER BY fecha_inicio DESC',
      args: [req.user.institucion_id],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener períodos' });
  }
});

// POST /api/periodos/planificacion
router.post('/planificacion', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  const { nombre, fecha_inicio, fecha_fin } = req.body;
  if (!nombre?.trim() || !fecha_inicio || !fecha_fin)
    return res.status(400).json({ error: 'Nombre y fechas son requeridos' });
  if (fecha_inicio >= fecha_fin)
    return res.status(400).json({ error: 'La fecha de inicio debe ser anterior al fin' });
  try {
    const r = await db.execute({
      sql: 'INSERT INTO periodos_planificacion (institucion_id, nombre, fecha_inicio, fecha_fin) VALUES (?,?,?,?)',
      args: [req.user.institucion_id, nombre.trim(), fecha_inicio, fecha_fin],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Error al crear período' });
  }
});

// PUT /api/periodos/planificacion/:id
router.put('/planificacion/:id', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  const { nombre, fecha_inicio, fecha_fin } = req.body;
  if (!nombre?.trim() || !fecha_inicio || !fecha_fin)
    return res.status(400).json({ error: 'Nombre y fechas son requeridos' });
  if (fecha_inicio >= fecha_fin)
    return res.status(400).json({ error: 'La fecha de inicio debe ser anterior al fin' });
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM periodos_planificacion WHERE id=? AND institucion_id=?',
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Período no encontrado' });

    await db.execute({
      sql: 'UPDATE periodos_planificacion SET nombre=?,fecha_inicio=?,fecha_fin=? WHERE id=?',
      args: [nombre.trim(), fecha_inicio, fecha_fin, Number(req.params.id)],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar período' });
  }
});

// DELETE /api/periodos/planificacion/:id
router.delete('/planificacion/:id', verifyToken, requirePermiso('editar_planificaciones'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM periodos_planificacion WHERE id=? AND institucion_id=?',
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Período no encontrado' });

    const { rows: uRows } = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM planificaciones WHERE periodo_id=?',
      args: [Number(req.params.id)],
    });
    const c = Number(uRows[0].c);
    if (c > 0) return res.status(409).json({ error: `Hay ${c} planificacion(es) usando este período. Eliminá las planificaciones primero.` });

    await db.execute({ sql: 'UPDATE periodos_planificacion SET activo=0 WHERE id=?', args: [Number(req.params.id)] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar período' });
  }
});

module.exports = router;
