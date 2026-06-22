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

module.exports = router;
