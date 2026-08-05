const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// GET /api/reportes/asistencia?fecha_inicio=&fecha_fin=&curso_id=
router.get('/asistencia', verifyToken, requirePermiso('ver_reportes'), async (req, res) => {
  const { fecha_inicio, fecha_fin, curso_id } = req.query;
  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'fecha_inicio y fecha_fin son requeridas' });
  }
  try {
    const args  = [fecha_inicio, fecha_fin, req.user.institucion_id];
    const filtroE = curso_id ? 'AND e.curso_id = ?' : '';
    if (curso_id) args.push(Number(curso_id));

    const { rows: estudiantes } = await db.execute({
      sql: `SELECT e.id, e.nombre, e.apellido, e.dni, e.curso_id,
                   c.nombre AS curso_nombre,
                   COALESCE(SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END),0) AS presencias,
                   COALESCE(SUM(CASE WHEN a.estado='ausente'  THEN 1 ELSE 0 END),0) AS ausencias,
                   COALESCE(SUM(CASE WHEN a.estado='tarde'    THEN 1 ELSE 0 END),0) AS tardes,
                   COALESCE(COUNT(a.id),0)                                           AS total_registros
            FROM   estudiantes e
            LEFT JOIN cursos c    ON e.curso_id       = c.id
            LEFT JOIN asistencias a ON a.estudiante_id = e.id
                   AND a.tipo_asistencia = 'general'
                   AND a.fecha BETWEEN ? AND ?
            WHERE  e.institucion_id = ? AND e.activo = 1 ${filtroE}
            GROUP  BY e.id ORDER BY e.apellido, e.nombre`,
      args,
    });

    const diasArgs = [req.user.institucion_id, fecha_inicio, fecha_fin];
    const diasF    = curso_id ? 'AND curso_id=?' : '';
    if (curso_id) diasArgs.push(Number(curso_id));
    const { rows: diasRows } = await db.execute({
      sql: `SELECT COUNT(DISTINCT fecha) AS dias_registrados FROM asistencias WHERE institucion_id=? AND tipo_asistencia='general' AND fecha BETWEEN ? AND ? ${diasF}`,
      args: diasArgs,
    });

    res.json({
      estudiantes: estudiantes.map(e => ({
        ...e,
        presencias:       Number(e.presencias),
        ausencias:        Number(e.ausencias),
        tardes:           Number(e.tardes),
        total_registros:  Number(e.total_registros),
        porcentaje: Number(e.total_registros) > 0
          ? Math.round((Number(e.presencias) / Number(e.total_registros)) * 100)
          : null,
      })),
      dias_registrados: Number(diasRows[0].dias_registrados),
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

// GET /api/reportes/nivel?curso_id= — resumen completo de estudiantes de un nivel/curso
// (o de todos si no se pasa curso_id), con asistencia resumida y completitud de datos.
router.get('/nivel', verifyToken, requirePermiso('ver_reportes'), async (req, res) => {
  const { curso_id } = req.query;
  try {
    let sql = `SELECT DISTINCT e.id, e.nombre, e.apellido, e.dni, e.telefono, e.direccion,
               e.tutor_nombre, e.tutor_dni, e.tutor_telefono, e.foto_path, e.fecha_nacimiento
               FROM estudiantes e`;
    const args = [];
    if (curso_id) sql += ' JOIN inscripciones ins ON ins.estudiante_id = e.id AND ins.activo = 1';
    sql += ' WHERE e.institucion_id = ? AND e.activo = 1';
    args.push(req.user.institucion_id);
    if (curso_id) { sql += ' AND ins.curso_id = ?'; args.push(Number(curso_id)); }
    sql += ' ORDER BY e.apellido, e.nombre';

    const { rows: estudiantes } = await db.execute({ sql, args });
    if (estudiantes.length === 0) return res.json([]);

    const estIds = estudiantes.map(e => Number(e.id));
    const ph     = estIds.map(() => '?').join(',');

    const { rows: inscs } = await db.execute({
      sql: `SELECT ins.estudiante_id, ins.curso_id, ins.instrumento_id,
                   c.nombre AS curso_nombre, i.nombre AS instrumento_nombre
            FROM inscripciones ins
            JOIN cursos c       ON ins.curso_id       = c.id
            JOIN instrumentos i ON ins.instrumento_id = i.id
            WHERE ins.estudiante_id IN (${ph}) AND ins.activo = 1
            ORDER BY c.nombre, i.nombre`,
      args: estIds,
    });

    const { rows: asis } = await db.execute({
      sql: `SELECT estudiante_id,
                   COALESCE(SUM(CASE WHEN estado='presente' THEN 1 ELSE 0 END),0) AS presencias,
                   COALESCE(SUM(CASE WHEN estado='ausente'  THEN 1 ELSE 0 END),0) AS ausencias,
                   COALESCE(SUM(CASE WHEN estado='tarde'    THEN 1 ELSE 0 END),0) AS tardes,
                   COALESCE(COUNT(id),0)                                          AS total_registros
            FROM asistencias
            WHERE estudiante_id IN (${ph}) AND tipo_asistencia = 'general'
            GROUP BY estudiante_id`,
      args: estIds,
    });

    const inscMap = {};
    inscs.forEach(i => {
      const eid = Number(i.estudiante_id);
      if (!inscMap[eid]) inscMap[eid] = [];
      inscMap[eid].push({ curso_id: i.curso_id, curso_nombre: i.curso_nombre, instrumento_nombre: i.instrumento_nombre });
    });
    const asisMap = {};
    asis.forEach(a => { asisMap[Number(a.estudiante_id)] = a; });

    res.json(estudiantes.map(e => {
      const a = asisMap[Number(e.id)] || { presencias:0, ausencias:0, tardes:0, total_registros:0 };
      const total = Number(a.total_registros);
      return {
        ...e,
        inscripciones:    inscMap[Number(e.id)] || [],
        presencias:       Number(a.presencias),
        ausencias:        Number(a.ausencias),
        tardes:           Number(a.tardes),
        total_registros:  total,
        porcentaje:       total > 0 ? Math.round((Number(a.presencias) / total) * 100) : null,
      };
    }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al generar el reporte por nivel' });
  }
});

module.exports = router;
