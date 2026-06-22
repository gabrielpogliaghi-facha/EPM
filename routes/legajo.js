const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

async function verificarEstudiante(estId, institucionId, res) {
  const { rows } = await db.execute({
    sql: 'SELECT id FROM estudiantes WHERE id=? AND institucion_id=? AND activo=1',
    args: [estId, institucionId],
  });
  if (!rows[0]) { res.status(404).json({ error: 'Estudiante no encontrado' }); return false; }
  return true;
}

// GET /api/legajo/:id — datos fijos + los tres historiales
router.get('/:id', verifyToken, requirePermiso('ver_legajo_personal'), async (req, res) => {
  const estId = Number(req.params.id);
  try {
    if (!(await verificarEstudiante(estId, req.user.institucion_id, res))) return;

    const [datos, salud, tray, obs] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM legajo_personal WHERE estudiante_id=?', args: [estId] }),
      db.execute({
        sql: `SELECT lsh.id, lsh.fecha, lsh.descripcion, lsh.created_at, u.nombre AS autor
              FROM legajo_salud_historial lsh
              LEFT JOIN usuarios u ON lsh.registrado_por = u.id
              WHERE lsh.estudiante_id=? ORDER BY lsh.fecha DESC, lsh.created_at DESC`,
        args: [estId],
      }),
      db.execute({
        sql: `SELECT lth.id, lth.fecha, lth.descripcion, lth.created_at, u.nombre AS autor
              FROM legajo_trayectoria_historial lth
              LEFT JOIN usuarios u ON lth.registrado_por = u.id
              WHERE lth.estudiante_id=? ORDER BY lth.fecha DESC, lth.created_at DESC`,
        args: [estId],
      }),
      db.execute({
        sql: `SELECT lo.id, lo.fecha, lo.descripcion, lo.created_at, u.nombre AS autor
              FROM legajo_observaciones lo
              LEFT JOIN usuarios u ON lo.registrado_por = u.id
              WHERE lo.estudiante_id=? ORDER BY lo.fecha DESC, lo.created_at DESC`,
        args: [estId],
      }),
    ]);

    res.json({
      datos:                datos.rows[0] || {},
      salud_historial:      salud.rows,
      trayectoria_historial: tray.rows,
      observaciones:         obs.rows,
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener legajo' });
  }
});

// PUT /api/legajo/:id/datos — guardar campos fijos (upsert)
router.put('/:id/datos', verifyToken, requirePermiso('editar_legajo_personal'), async (req, res) => {
  const estId = Number(req.params.id);
  const { composicion_familiar, emergencia_nombre, emergencia_telefono, obra_social,
          alergias, medicacion, condiciones_salud, instituciones_anteriores } = req.body;
  try {
    if (!(await verificarEstudiante(estId, req.user.institucion_id, res))) return;

    await db.execute({
      sql: `INSERT INTO legajo_personal
              (estudiante_id, composicion_familiar, emergencia_nombre, emergencia_telefono,
               obra_social, alergias, medicacion, condiciones_salud, instituciones_anteriores, updated_by)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(estudiante_id) DO UPDATE SET
              composicion_familiar=excluded.composicion_familiar,
              emergencia_nombre=excluded.emergencia_nombre,
              emergencia_telefono=excluded.emergencia_telefono,
              obra_social=excluded.obra_social,
              alergias=excluded.alergias,
              medicacion=excluded.medicacion,
              condiciones_salud=excluded.condiciones_salud,
              instituciones_anteriores=excluded.instituciones_anteriores,
              updated_by=excluded.updated_by,
              updated_at=datetime('now')`,
      args: [estId,
        composicion_familiar || null, emergencia_nombre || null, emergencia_telefono || null,
        obra_social || null, alergias || null, medicacion || null, condiciones_salud || null,
        instituciones_anteriores || null, req.user.id],
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar legajo' });
  }
});

// POST /api/legajo/:id/salud — agregar entrada al historial de salud
router.post('/:id/salud', verifyToken, requirePermiso('editar_legajo_personal'), async (req, res) => {
  const estId = Number(req.params.id);
  const { fecha, descripcion } = req.body;
  if (!fecha || !descripcion?.trim()) return res.status(400).json({ error: 'Fecha y descripción requeridas' });
  try {
    if (!(await verificarEstudiante(estId, req.user.institucion_id, res))) return;
    const r = await db.execute({
      sql: 'INSERT INTO legajo_salud_historial (estudiante_id, fecha, descripcion, registrado_por) VALUES (?,?,?,?)',
      args: [estId, fecha, descripcion.trim(), req.user.id],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar entrada' });
  }
});

// POST /api/legajo/:id/trayectoria — agregar entrada al historial de trayectoria
router.post('/:id/trayectoria', verifyToken, requirePermiso('editar_legajo_personal'), async (req, res) => {
  const estId = Number(req.params.id);
  const { fecha, descripcion } = req.body;
  if (!fecha || !descripcion?.trim()) return res.status(400).json({ error: 'Fecha y descripción requeridas' });
  try {
    if (!(await verificarEstudiante(estId, req.user.institucion_id, res))) return;
    const r = await db.execute({
      sql: 'INSERT INTO legajo_trayectoria_historial (estudiante_id, fecha, descripcion, registrado_por) VALUES (?,?,?,?)',
      args: [estId, fecha, descripcion.trim(), req.user.id],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar entrada' });
  }
});

// POST /api/legajo/:id/observacion — agregar observación general
router.post('/:id/observacion', verifyToken, requirePermiso('editar_legajo_personal'), async (req, res) => {
  const estId = Number(req.params.id);
  const { fecha, descripcion } = req.body;
  if (!fecha || !descripcion?.trim()) return res.status(400).json({ error: 'Fecha y descripción requeridas' });
  try {
    if (!(await verificarEstudiante(estId, req.user.institucion_id, res))) return;
    const r = await db.execute({
      sql: 'INSERT INTO legajo_observaciones (estudiante_id, fecha, descripcion, registrado_por) VALUES (?,?,?,?)',
      args: [estId, fecha, descripcion.trim(), req.user.id],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar entrada' });
  }
});

module.exports = router;
