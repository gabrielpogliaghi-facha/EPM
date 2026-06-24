const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }           = require('../middleware/auth');
const { requirePermiso }        = require('../middleware/permission');
const { notificarCambioEvento } = require('../utils/notificaciones');

const TIPOS   = ['muestra','feriado','reunion','ensayo','salida','festival','otro'];
const ALCANCE = ['institucion','cursos'];

function esAdmin(user) {
  return user.permisos.includes('administrar_cursos') || user.permisos.includes('administrar_usuarios_roles');
}

// GET /api/eventos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/', verifyToken, requirePermiso('ver_calendario'), async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let sql, args;
    const filtroFecha = `${desde ? ' AND e.fecha >= ?' : ''}${hasta ? ' AND e.fecha <= ?' : ''}`;
    const fechaArgs   = [...(desde ? [desde] : []), ...(hasta ? [hasta] : [])];

    if (esAdmin(req.user)) {
      sql  = `SELECT e.*, GROUP_CONCAT(ec.curso_id) AS cursos_ids, u.nombre AS creado_por_nombre
              FROM eventos e
              LEFT JOIN evento_cursos ec ON ec.evento_id = e.id
              LEFT JOIN usuarios u ON u.id = e.created_by
              WHERE e.institucion_id = ?${filtroFecha}
              GROUP BY e.id ORDER BY e.fecha, e.hora_inicio`;
      args = [req.user.institucion_id, ...fechaArgs];
    } else {
      sql  = `SELECT e.*, GROUP_CONCAT(ec.curso_id) AS cursos_ids, u.nombre AS creado_por_nombre
              FROM eventos e
              LEFT JOIN evento_cursos ec ON ec.evento_id = e.id
              LEFT JOIN usuarios u ON u.id = e.created_by
              WHERE e.institucion_id = ?
                AND (
                  e.alcance = 'institucion'
                  OR EXISTS (
                    SELECT 1 FROM evento_cursos ec2
                    JOIN usuarios_cursos uc ON uc.curso_id = ec2.curso_id
                    WHERE ec2.evento_id = e.id AND uc.usuario_id = ?
                  )
                )${filtroFecha}
              GROUP BY e.id ORDER BY e.fecha, e.hora_inicio`;
      args = [req.user.institucion_id, req.user.id, ...fechaArgs];
    }

    const { rows } = await db.execute({ sql, args });
    res.json(rows.map(e => ({
      ...e,
      cursos_ids: e.cursos_ids ? String(e.cursos_ids).split(',').map(Number) : [],
    })));
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// GET /api/eventos/proximos?limite=5
router.get('/proximos', verifyToken, requirePermiso('ver_calendario'), async (req, res) => {
  const limite = Math.min(parseInt(req.query.limite) || 5, 20);
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    let sql, args;
    if (esAdmin(req.user)) {
      sql  = `SELECT e.*, GROUP_CONCAT(ec.curso_id) AS cursos_ids
              FROM eventos e
              LEFT JOIN evento_cursos ec ON ec.evento_id = e.id
              WHERE e.institucion_id=? AND e.fecha >= ? AND e.estado='activo'
              GROUP BY e.id ORDER BY e.fecha, e.hora_inicio LIMIT ?`;
      args = [req.user.institucion_id, hoy, limite];
    } else {
      sql  = `SELECT e.*, GROUP_CONCAT(ec.curso_id) AS cursos_ids
              FROM eventos e
              LEFT JOIN evento_cursos ec ON ec.evento_id = e.id
              WHERE e.institucion_id=? AND e.fecha >= ? AND e.estado='activo'
                AND (e.alcance='institucion' OR EXISTS (
                  SELECT 1 FROM evento_cursos ec2
                  JOIN usuarios_cursos uc ON uc.curso_id=ec2.curso_id
                  WHERE ec2.evento_id=e.id AND uc.usuario_id=?
                ))
              GROUP BY e.id ORDER BY e.fecha, e.hora_inicio LIMIT ?`;
      args = [req.user.institucion_id, hoy, req.user.id, limite];
    }
    const { rows } = await db.execute({ sql, args });
    res.json(rows.map(e => ({
      ...e,
      cursos_ids: e.cursos_ids ? String(e.cursos_ids).split(',').map(Number) : [],
    })));
  } catch(e) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/eventos
router.post('/', verifyToken, requirePermiso('crear_eventos'), async (req, res) => {
  const { titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, tipo, alcance, cursos_ids } = req.body;
  if (!titulo?.trim())          return res.status(400).json({ error: 'El título es requerido' });
  if (!fecha)                    return res.status(400).json({ error: 'La fecha es requerida' });
  if (!TIPOS.includes(tipo))    return res.status(400).json({ error: 'Tipo inválido' });
  if (!ALCANCE.includes(alcance)) return res.status(400).json({ error: 'Alcance inválido' });
  if (alcance === 'cursos' && !cursos_ids?.length)
    return res.status(400).json({ error: 'Seleccioná al menos un curso' });

  try {
    const r = await db.execute({
      sql: `INSERT INTO eventos (institucion_id, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, tipo, alcance, created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [req.user.institucion_id, titulo.trim(), descripcion||null, fecha,
             hora_inicio||null, hora_fin||null, lugar||null, tipo, alcance, req.user.id],
    });
    const eventoId = Number(r.lastInsertRowid);

    if (alcance === 'cursos' && cursos_ids?.length) {
      for (const cid of cursos_ids) {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO evento_cursos (evento_id, curso_id) VALUES (?,?)',
          args: [eventoId, cid],
        });
      }
    }

    const { rows } = await db.execute({ sql: 'SELECT * FROM eventos WHERE id=?', args: [eventoId] });
    res.status(201).json({ ...rows[0], cursos_ids: cursos_ids || [] });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// PUT /api/eventos/:id
router.put('/:id', verifyToken, requirePermiso('editar_eventos'), async (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, tipo, alcance, cursos_ids } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
  if (!fecha)           return res.status(400).json({ error: 'La fecha es requerida' });

  try {
    const { rows: ex } = await db.execute({
      sql: 'SELECT * FROM eventos WHERE id=? AND institucion_id=?',
      args: [id, req.user.institucion_id],
    });
    if (!ex[0]) return res.status(404).json({ error: 'Evento no encontrado' });

    await db.execute({
      sql: `UPDATE eventos SET titulo=?,descripcion=?,fecha=?,hora_inicio=?,hora_fin=?,
                               lugar=?,tipo=?,alcance=?,updated_at=datetime('now') WHERE id=?`,
      args: [titulo.trim(), descripcion||null, fecha, hora_inicio||null, hora_fin||null,
             lugar||null, tipo, alcance, id],
    });

    await db.execute({ sql: 'DELETE FROM evento_cursos WHERE evento_id=?', args: [id] });
    if (alcance === 'cursos' && cursos_ids?.length) {
      for (const cid of cursos_ids) {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO evento_cursos (evento_id, curso_id) VALUES (?,?)',
          args: [id, cid],
        });
      }
    }

    const { rows } = await db.execute({ sql: 'SELECT * FROM eventos WHERE id=?', args: [id] });
    res.json({ ...rows[0], cursos_ids: cursos_ids || [] });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});

// DELETE /api/eventos/:id
router.delete('/:id', verifyToken, requirePermiso('editar_eventos'), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM eventos WHERE id=? AND institucion_id=?',
      args: [id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado' });
    await db.execute({ sql: 'DELETE FROM eventos WHERE id=?', args: [id] });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
});

// POST /api/eventos/:id/cancelar
router.post('/:id/cancelar', verifyToken, requirePermiso('editar_eventos'), async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  if (!motivo?.trim()) return res.status(400).json({ error: 'El motivo de cancelación es requerido' });

  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM eventos WHERE id=? AND institucion_id=?',
      args: [id, req.user.institucion_id],
    });
    const evento = rows[0];
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
    if (evento.estado !== 'activo') return res.status(400).json({ error: 'El evento ya fue cancelado o reprogramado' });

    await db.execute({
      sql: `UPDATE eventos SET estado='cancelado', motivo_cambio=?, updated_at=datetime('now') WHERE id=?`,
      args: [motivo.trim(), id],
    });

    notificarCambioEvento(db, evento, 'cancelado', motivo.trim(), null, null)
      .catch(e => console.error('Error en notificaciones:', e.message));

    res.json({ ok: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al cancelar evento' });
  }
});

// POST /api/eventos/:id/reprogramar
router.post('/:id/reprogramar', verifyToken, requirePermiso('editar_eventos'), async (req, res) => {
  const { id } = req.params;
  const { motivo, nueva_fecha, nueva_hora_inicio, nueva_hora_fin } = req.body;
  if (!motivo?.trim())  return res.status(400).json({ error: 'El motivo de reprogramación es requerido' });
  if (!nueva_fecha)     return res.status(400).json({ error: 'La nueva fecha es requerida' });

  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM eventos WHERE id=? AND institucion_id=?',
      args: [id, req.user.institucion_id],
    });
    const evento = rows[0];
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
    if (evento.estado !== 'activo') return res.status(400).json({ error: 'El evento ya fue cancelado o reprogramado' });

    await db.execute({
      sql: `UPDATE eventos SET
              estado='reprogramado', motivo_cambio=?,
              fecha_original=fecha, hora_inicio_original=hora_inicio,
              fecha=?, hora_inicio=?, hora_fin=?,
              updated_at=datetime('now')
            WHERE id=?`,
      args: [motivo.trim(), nueva_fecha, nueva_hora_inicio||null, nueva_hora_fin||null, id],
    });

    notificarCambioEvento(db, evento, 'reprogramado', motivo.trim(), nueva_fecha, nueva_hora_inicio||null)
      .catch(e => console.error('Error en notificaciones:', e.message));

    res.json({ ok: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al reprogramar evento' });
  }
});

module.exports = router;
