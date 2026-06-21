const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// GET /api/asistencias/estudiante/:id?fecha_inicio=&fecha_fin=
// Devuelve el historial completo de asistencia general de un estudiante.
router.get('/estudiante/:id', verifyToken, requirePermiso('ver_asistencias'), (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const params = [Number(req.params.id), req.user.institucion_id];
  let filtro = '';
  if (fecha_inicio) { filtro += ' AND a.fecha >= ?'; params.push(fecha_inicio); }
  if (fecha_fin)    { filtro += ' AND a.fecha <= ?'; params.push(fecha_fin); }

  const rows = db.prepare(`
    SELECT a.fecha, a.estado, a.observacion
    FROM   asistencias a
    WHERE  a.estudiante_id = ? AND a.institucion_id = ?
           AND a.tipo_asistencia = 'general' ${filtro}
    ORDER  BY a.fecha
  `).all(...params);

  res.json(rows);
});

// GET /api/asistencias?curso_id=&fecha=
// Devuelve la asistencia general de un curso en una fecha dada.
router.get('/', verifyToken, requirePermiso('ver_asistencias'), (req, res) => {
  const { curso_id, fecha } = req.query;
  if (!curso_id || !fecha) return res.status(400).json({ error: 'curso_id y fecha son requeridos' });

  const rows = db.prepare(`
    SELECT a.id, a.estudiante_id, a.fecha, a.estado, a.observacion,
           e.nombre, e.apellido
    FROM   asistencias a
    JOIN   estudiantes e ON a.estudiante_id = e.id
    WHERE  a.curso_id = ? AND a.fecha = ? AND a.tipo_asistencia = 'general'
           AND a.institucion_id = ?
    ORDER BY e.apellido, e.nombre
  `).all(Number(curso_id), fecha, req.user.institucion_id);

  res.json(rows);
});

// POST /api/asistencias/bulk — upsert masivo de asistencia general
// Inserta si no existe, actualiza si ya existe (basado en estudiante_id + fecha + tipo='general').
router.post('/bulk', verifyToken, requirePermiso('cargar_asistencias'), (req, res) => {
  const { curso_id, fecha, asistencias } = req.body;
  if (!curso_id || !fecha || !Array.isArray(asistencias) || asistencias.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const checkExist = db.prepare(
    `SELECT id FROM asistencias WHERE estudiante_id=? AND fecha=? AND tipo_asistencia='general'`
  );
  const doInsert = db.prepare(`
    INSERT INTO asistencias
      (institucion_id, estudiante_id, curso_id, fecha, estado, observacion, tipo_asistencia, registrado_por)
    VALUES (?,?,?,?,?,?,'general',?)
  `);
  const doUpdate = db.prepare(`
    UPDATE asistencias
    SET estado=?, observacion=?, registrado_por=?, updated_at=datetime('now')
    WHERE id=?
  `);

  db.exec('BEGIN');
  try {
    for (const a of asistencias) {
      const ex = checkExist.get(Number(a.estudiante_id), fecha);
      if (ex) {
        doUpdate.run(a.estado, a.observacion || null, req.user.id, ex.id);
      } else {
        doInsert.run(
          req.user.institucion_id, Number(a.estudiante_id), Number(curso_id),
          fecha, a.estado, a.observacion || null, req.user.id
        );
      }
    }
    db.exec('COMMIT');
    res.json({ success: true, count: asistencias.length });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Error al guardar asistencias' });
  }
});

// PUT /api/asistencias/:id — editar una asistencia individual (justificar ausencia)
router.put('/:id', verifyToken, requirePermiso('justificar_ausencias'), (req, res) => {
  const { estado, observacion } = req.body;
  if (!estado) return res.status(400).json({ error: 'Estado requerido' });

  const row = db.prepare(
    'SELECT id FROM asistencias WHERE id=? AND institucion_id=?'
  ).get(Number(req.params.id), req.user.institucion_id);
  if (!row) return res.status(404).json({ error: 'Asistencia no encontrada' });

  db.prepare(`
    UPDATE asistencias SET estado=?, observacion=?, registrado_por=?, updated_at=datetime('now') WHERE id=?
  `).run(estado, observacion || null, req.user.id, Number(req.params.id));

  res.json({ success: true });
});

module.exports = router;
