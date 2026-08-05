const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

async function getParticipantes(reunionId) {
  const { rows } = await db.execute({
    sql: `SELECT u.id, u.nombre, u.apellido, r.nombre AS rol_nombre
          FROM reunion_participantes rp
          JOIN usuarios u ON u.id = rp.usuario_id
          JOIN roles r ON r.id = u.rol_id
          WHERE rp.reunion_id=? ORDER BY u.apellido, u.nombre`,
    args: [reunionId],
  });
  return rows.map(r => ({ ...r, id: Number(r.id) }));
}

function puedeEditar(req, participantes) {
  if (req.user.permisos?.includes('editar_reuniones')) return true;
  return participantes.some(p => p.id === req.user.id);
}

// GET /api/reuniones/participantes-disponibles
router.get('/participantes-disponibles', verifyToken, requirePermiso('ver_reuniones'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT u.id, u.nombre, u.apellido, r.nombre AS rol_nombre
            FROM usuarios u JOIN roles r ON r.id = u.rol_id
            WHERE u.institucion_id=? AND u.activo=1
            ORDER BY u.apellido, u.nombre`,
      args: [req.user.institucion_id],
    });
    res.json(rows.map(r => ({ ...r, id: Number(r.id) })));
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET /api/reuniones/ultima — para recordatorio en Dashboard
router.get('/ultima', verifyToken, requirePermiso('ver_reuniones'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT id, fecha, hora, motivo FROM reuniones
            WHERE institucion_id=? AND fecha >= date('now','-7 days')
            ORDER BY fecha DESC, hora DESC LIMIT 1`,
      args: [req.user.institucion_id],
    });
    res.json(rows[0] || null);
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener última reunión' });
  }
});

// GET /api/reuniones?fecha_inicio=&fecha_fin=&participante_id=&q=
router.get('/', verifyToken, requirePermiso('ver_reuniones'), async (req, res) => {
  const { fecha_inicio, fecha_fin, participante_id, q } = req.query;
  try {
    const args = [req.user.institucion_id];
    let where  = 'WHERE r.institucion_id=?';
    let join   = '';
    if (fecha_inicio) { where += ' AND r.fecha>=?'; args.push(fecha_inicio); }
    if (fecha_fin)    { where += ' AND r.fecha<=?'; args.push(fecha_fin); }
    if (q)            { where += ' AND (r.motivo LIKE ? OR r.resumen LIKE ?)'; args.push(`%${q}%`, `%${q}%`); }
    if (participante_id) {
      join = 'JOIN reunion_participantes rpf ON rpf.reunion_id=r.id AND rpf.usuario_id=?';
      args.splice(1, 0, Number(participante_id));
    }
    const { rows } = await db.execute({
      sql: `SELECT r.*,
              (SELECT COUNT(*) FROM reunion_participantes rp WHERE rp.reunion_id=r.id) AS participantes_count
            FROM reuniones r ${join} ${where}
            ORDER BY r.fecha DESC, r.hora DESC`,
      args,
    });
    res.json(rows.map(r => ({
      ...r,
      id: Number(r.id),
      participantes_count: Number(r.participantes_count),
      resumen_preview: (r.resumen || '').slice(0, 120),
    })));
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener reuniones' });
  }
});

// GET /api/reuniones/:id
router.get('/:id', verifyToken, requirePermiso('ver_reuniones'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT r.*, u.nombre AS creado_por_nombre
            FROM reuniones r LEFT JOIN usuarios u ON u.id=r.created_by
            WHERE r.id=? AND r.institucion_id=?`,
      args: [req.params.id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Reunión no encontrada' });
    const participantes = await getParticipantes(req.params.id);
    res.json({ ...rows[0], id: Number(rows[0].id), participantes, puede_editar: puedeEditar(req, participantes) });
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener reunión' });
  }
});

// POST /api/reuniones
router.post('/', verifyToken, requirePermiso('crear_reuniones'), async (req, res) => {
  const { fecha, hora, motivo, resumen, participantes } = req.body;
  if (!fecha || !motivo?.trim()) return res.status(400).json({ error: 'Fecha y motivo son requeridos' });

  const ids = new Set((Array.isArray(participantes) ? participantes : []).map(Number));
  ids.add(req.user.id);

  const tx = await db.transaction('write');
  try {
    const r = await tx.execute({
      sql: `INSERT INTO reuniones (institucion_id, fecha, hora, motivo, resumen, created_by) VALUES (?,?,?,?,?,?)`,
      args: [req.user.institucion_id, fecha, hora || null, motivo.trim(), resumen || null, req.user.id],
    });
    const id = Number(r.lastInsertRowid);
    for (const uid of ids) {
      await tx.execute({ sql: 'INSERT INTO reunion_participantes (reunion_id, usuario_id) VALUES (?,?)', args: [id, uid] });
    }
    await tx.commit();
    const participantesOut = await getParticipantes(id);
    res.status(201).json({ id, fecha, hora: hora || null, motivo: motivo.trim(), resumen: resumen || null, participantes: participantesOut });
  } catch(e) {
    await tx.rollback();
    res.status(500).json({ error: 'Error al crear reunión' });
  }
});

// PUT /api/reuniones/:id
router.put('/:id', verifyToken, requirePermiso('ver_reuniones'), async (req, res) => {
  const { id } = req.params;
  const { fecha, hora, motivo, resumen, participantes } = req.body;
  if (!fecha || !motivo?.trim()) return res.status(400).json({ error: 'Fecha y motivo son requeridos' });
  try {
    const { rows: ex } = await db.execute({ sql: 'SELECT id FROM reuniones WHERE id=? AND institucion_id=?', args: [id, req.user.institucion_id] });
    if (!ex[0]) return res.status(404).json({ error: 'Reunión no encontrada' });

    const participantesActuales = await getParticipantes(id);
    if (!puedeEditar(req, participantesActuales)) return res.status(403).json({ error: 'No tenés permiso para editar esta reunión' });

    const ids = new Set((Array.isArray(participantes) ? participantes : participantesActuales.map(p => p.id)).map(Number));
    ids.add(req.user.id);

    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: `UPDATE reuniones SET fecha=?, hora=?, motivo=?, resumen=?, updated_at=datetime('now') WHERE id=?`,
        args: [fecha, hora || null, motivo.trim(), resumen || null, id],
      });
      await tx.execute({ sql: 'DELETE FROM reunion_participantes WHERE reunion_id=?', args: [id] });
      for (const uid of ids) {
        await tx.execute({ sql: 'INSERT INTO reunion_participantes (reunion_id, usuario_id) VALUES (?,?)', args: [id, uid] });
      }
      await tx.commit();
    } catch(e) {
      await tx.rollback();
      throw e;
    }
    const { rows } = await db.execute({ sql: 'SELECT * FROM reuniones WHERE id=?', args: [id] });
    const participantesOut = await getParticipantes(id);
    res.json({ ...rows[0], id: Number(rows[0].id), participantes: participantesOut });
  } catch(e) {
    res.status(500).json({ error: 'Error al actualizar reunión' });
  }
});

// DELETE /api/reuniones/:id
router.delete('/:id', verifyToken, requirePermiso('editar_reuniones'), async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: 'SELECT id FROM reuniones WHERE id=? AND institucion_id=?', args: [req.params.id, req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error: 'Reunión no encontrada' });
    await db.execute({ sql: 'DELETE FROM reuniones WHERE id=?', args: [req.params.id] });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al eliminar reunión' });
  }
});

module.exports = router;
