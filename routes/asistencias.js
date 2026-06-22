const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// GET /api/asistencias/estudiante/:id
router.get('/estudiante/:id', verifyToken, requirePermiso('ver_asistencias'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const args = [Number(req.params.id), req.user.institucion_id];
    let filtro = '';
    if (fecha_inicio) { filtro += ' AND a.fecha >= ?'; args.push(fecha_inicio); }
    if (fecha_fin)    { filtro += ' AND a.fecha <= ?'; args.push(fecha_fin); }

    const { rows } = await db.execute({
      sql: `SELECT a.fecha, a.estado, a.observacion FROM asistencias a
            WHERE  a.estudiante_id = ? AND a.institucion_id = ?
                   AND a.tipo_asistencia = 'general' ${filtro}
            ORDER  BY a.fecha`,
      args,
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// GET /api/asistencias?curso_id=&fecha=
router.get('/', verifyToken, requirePermiso('ver_asistencias'), async (req, res) => {
  const { curso_id, fecha } = req.query;
  if (!curso_id || !fecha) return res.status(400).json({ error: 'curso_id y fecha son requeridos' });
  try {
    const { rows } = await db.execute({
      sql: `SELECT a.id, a.estudiante_id, a.fecha, a.estado, a.observacion,
                   e.nombre, e.apellido
            FROM   asistencias a JOIN estudiantes e ON a.estudiante_id = e.id
            WHERE  a.curso_id = ? AND a.fecha = ? AND a.tipo_asistencia = 'general'
                   AND a.institucion_id = ?
            ORDER BY e.apellido, e.nombre`,
      args: [Number(curso_id), fecha, req.user.institucion_id],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener asistencias' });
  }
});

// POST /api/asistencias/bulk — upsert masivo de asistencia general
router.post('/bulk', verifyToken, requirePermiso('cargar_asistencias'), async (req, res) => {
  const { curso_id, fecha, asistencias } = req.body;
  if (!curso_id || !fecha || !Array.isArray(asistencias) || asistencias.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const tx = await db.transaction('write');
  try {
    for (const a of asistencias) {
      const { rows } = await tx.execute({
        sql: `SELECT id FROM asistencias WHERE estudiante_id=? AND fecha=? AND tipo_asistencia='general'`,
        args: [Number(a.estudiante_id), fecha],
      });
      if (rows[0]) {
        await tx.execute({
          sql: `UPDATE asistencias SET estado=?, observacion=?, registrado_por=?, updated_at=datetime('now') WHERE id=?`,
          args: [a.estado, a.observacion || null, req.user.id, rows[0].id],
        });
      } else {
        await tx.execute({
          sql: `INSERT INTO asistencias (institucion_id, estudiante_id, curso_id, fecha, estado, observacion, tipo_asistencia, registrado_por) VALUES (?,?,?,?,?,?,'general',?)`,
          args: [req.user.institucion_id, Number(a.estudiante_id), Number(curso_id), fecha, a.estado, a.observacion || null, req.user.id],
        });
      }
    }
    await tx.commit();
    res.json({ success: true, count: asistencias.length });
  } catch (e) {
    await tx.rollback();
    res.status(500).json({ error: 'Error al guardar asistencias' });
  }
});

// PUT /api/asistencias/:id
router.put('/:id', verifyToken, requirePermiso('justificar_ausencias'), async (req, res) => {
  const { estado, observacion } = req.body;
  if (!estado) return res.status(400).json({ error: 'Estado requerido' });
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM asistencias WHERE id=? AND institucion_id=?',
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Asistencia no encontrada' });

    await db.execute({
      sql: `UPDATE asistencias SET estado=?, observacion=?, registrado_por=?, updated_at=datetime('now') WHERE id=?`,
      args: [estado, observacion || null, req.user.id, Number(req.params.id)],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar asistencia' });
  }
});

module.exports = router;
