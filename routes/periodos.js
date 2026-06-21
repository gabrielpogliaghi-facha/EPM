const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// GET /api/periodos/ciclos — ciclos lectivos con sus semestres
router.get('/ciclos', verifyToken, (req, res) => {
  const ciclos = db.prepare(
    'SELECT * FROM ciclos_lectivos WHERE institucion_id=? AND activo=1 ORDER BY anio DESC'
  ).all(req.user.institucion_id);

  res.json(ciclos.map(c => ({
    ...c,
    semestres: db.prepare('SELECT * FROM semestres WHERE ciclo_lectivo_id=? ORDER BY numero')
                 .all(c.id)
  })));
});

// PUT /api/periodos/semestres/:id — editar fechas de un semestre (Gestión)
router.put('/semestres/:id', verifyToken, requirePermiso('editar_reportes'), (req, res) => {
  const { fecha_inicio, fecha_fin } = req.body;
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Fechas requeridas' });
  if (fecha_inicio >= fecha_fin) return res.status(400).json({ error: 'Inicio debe ser anterior al fin' });

  const sem = db.prepare(`
    SELECT s.id FROM semestres s
    JOIN ciclos_lectivos cl ON s.ciclo_lectivo_id = cl.id
    WHERE s.id = ? AND cl.institucion_id = ?
  `).get(Number(req.params.id), req.user.institucion_id);
  if (!sem) return res.status(404).json({ error: 'Semestre no encontrado' });

  db.prepare('UPDATE semestres SET fecha_inicio=?, fecha_fin=? WHERE id=?')
    .run(fecha_inicio, fecha_fin, Number(req.params.id));
  res.json({ success: true });
});

// GET /api/periodos/planificacion — períodos de planificación
router.get('/planificacion', verifyToken, (req, res) => {
  res.json(db.prepare(
    'SELECT * FROM periodos_planificacion WHERE institucion_id=? AND activo=1 ORDER BY fecha_inicio DESC'
  ).all(req.user.institucion_id));
});

// POST /api/periodos/planificacion
router.post('/planificacion', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const { nombre, fecha_inicio, fecha_fin } = req.body;
  if (!nombre?.trim() || !fecha_inicio || !fecha_fin)
    return res.status(400).json({ error: 'Nombre y fechas son requeridos' });
  if (fecha_inicio >= fecha_fin)
    return res.status(400).json({ error: 'La fecha de inicio debe ser anterior al fin' });
  const r = db.prepare(
    'INSERT INTO periodos_planificacion (institucion_id, nombre, fecha_inicio, fecha_fin) VALUES (?,?,?,?)'
  ).run(req.user.institucion_id, nombre.trim(), fecha_inicio, fecha_fin);
  res.status(201).json({ id: r.lastInsertRowid });
});

// PUT /api/periodos/planificacion/:id
router.put('/planificacion/:id', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const { nombre, fecha_inicio, fecha_fin } = req.body;
  if (!nombre?.trim() || !fecha_inicio || !fecha_fin)
    return res.status(400).json({ error: 'Nombre y fechas son requeridos' });
  if (fecha_inicio >= fecha_fin)
    return res.status(400).json({ error: 'La fecha de inicio debe ser anterior al fin' });
  const p = db.prepare('SELECT id FROM periodos_planificacion WHERE id=? AND institucion_id=?')
              .get(Number(req.params.id), req.user.institucion_id);
  if (!p) return res.status(404).json({ error: 'Período no encontrado' });
  db.prepare('UPDATE periodos_planificacion SET nombre=?,fecha_inicio=?,fecha_fin=? WHERE id=?')
    .run(nombre.trim(), fecha_inicio, fecha_fin, Number(req.params.id));
  res.json({ success: true });
});

// DELETE /api/periodos/planificacion/:id
router.delete('/planificacion/:id', verifyToken, requirePermiso('editar_planificaciones'), (req, res) => {
  const p = db.prepare('SELECT id FROM periodos_planificacion WHERE id=? AND institucion_id=?')
              .get(Number(req.params.id), req.user.institucion_id);
  if (!p) return res.status(404).json({ error: 'Período no encontrado' });
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM planificaciones WHERE periodo_id=?').get(Number(req.params.id));
  if (c > 0) return res.status(409).json({ error: `Hay ${c} planificacion(es) usando este período. Eliminá las planificaciones primero.` });
  db.prepare('UPDATE periodos_planificacion SET activo=0 WHERE id=?').run(Number(req.params.id));
  res.json({ success: true });
});

module.exports = router;
