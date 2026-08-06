const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const CAMPOS = ['nombre','instrumento_id','estado','asignado_tipo','asignado_id','numero_serie',
  'tiene_funda','tiene_correa','reparacion_fecha_envio','reparacion_lugar','reparacion_telefono',
  'reparacion_observaciones','observaciones','fecha_alta'];

function normalizar(body) {
  return {
    nombre:         body.nombre?.trim() || '',
    instrumento_id: body.instrumento_id || null,
    estado:         body.estado || 'disponible',
    // asignado_* solo tiene sentido con estado='a_prestamo'; se limpia en cualquier otro caso
    asignado_tipo:  body.estado === 'a_prestamo' ? (body.asignado_tipo || null) : null,
    asignado_id:    body.estado === 'a_prestamo' ? (body.asignado_id   || null) : null,
    numero_serie:   body.numero_serie || null,
    tiene_funda:    body.tiene_funda  ? 1 : 0,
    tiene_correa:   body.tiene_correa ? 1 : 0,
    // reparacion_fecha_envio/lugar/telefono solo tienen sentido con estado='en_reparacion'
    // (ya se mandó al taller). reparacion_observaciones se usa en ambos estados: en 'a_reparar'
    // describe el daño detectado, en 'en_reparacion' describe detalles de la reparación en curso.
    reparacion_fecha_envio:   body.estado === 'en_reparacion' ? (body.reparacion_fecha_envio || null) : null,
    reparacion_lugar:         body.estado === 'en_reparacion' ? (body.reparacion_lugar || null) : null,
    reparacion_telefono:      body.estado === 'en_reparacion' ? (body.reparacion_telefono || null) : null,
    reparacion_observaciones: (body.estado === 'a_reparar' || body.estado === 'en_reparacion') ? (body.reparacion_observaciones || null) : null,
    observaciones:  body.observaciones || null,
    fecha_alta:     body.fecha_alta || new Date().toISOString().slice(0,10),
  };
}

// GET /api/inventario?instrumento_id=&estado=
router.get('/', verifyToken, requirePermiso('ver_inventario'), async (req, res) => {
  const { instrumento_id, estado } = req.query;
  try {
    const args = [req.user.institucion_id];
    let where  = 'WHERE inv.institucion_id=?';
    if (instrumento_id) { where += ' AND inv.instrumento_id=?'; args.push(instrumento_id); }
    if (estado)         { where += ' AND inv.estado=?';         args.push(estado); }

    const { rows } = await db.execute({
      sql: `SELECT inv.*,
                   ti.nombre AS tipo_instrumento_nombre,
                   CASE WHEN inv.asignado_tipo='estudiante' THEN (SELECT nombre||' '||apellido FROM estudiantes WHERE id=inv.asignado_id)
                        WHEN inv.asignado_tipo='usuario'    THEN (SELECT nombre||' '||COALESCE(apellido,'') FROM usuarios WHERE id=inv.asignado_id)
                        ELSE NULL END AS asignado_nombre
            FROM inventario inv
            LEFT JOIN instrumentos ti ON ti.id = inv.instrumento_id
            ${where}
            ORDER BY ti.nombre, inv.nombre`,
      args,
    });
    res.json(rows);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// POST /api/inventario
router.post('/', verifyToken, requirePermiso('editar_inventario'), async (req, res) => {
  const d = normalizar(req.body);
  if (!d.nombre) return res.status(400).json({ error: 'La marca es requerida' });
  try {
    const r = await db.execute({
      sql: `INSERT INTO inventario (institucion_id,${CAMPOS.join(',')})
            VALUES (?,${CAMPOS.map(()=>'?').join(',')})`,
      args: [req.user.institucion_id, ...CAMPOS.map(c => d[c])],
    });
    const { rows } = await db.execute({ sql:'SELECT * FROM inventario WHERE id=?', args:[Number(r.lastInsertRowid)] });
    res.status(201).json(rows[0]);
  } catch(e) {
    res.status(500).json({ error: 'Error al crear ítem' });
  }
});

// PUT /api/inventario/:id
router.put('/:id', verifyToken, requirePermiso('editar_inventario'), async (req, res) => {
  const { id } = req.params;
  const d = normalizar(req.body);
  if (!d.nombre) return res.status(400).json({ error: 'La marca es requerida' });
  try {
    const { rows: ex } = await db.execute({ sql:'SELECT id FROM inventario WHERE id=? AND institucion_id=?', args:[id, req.user.institucion_id] });
    if (!ex[0]) return res.status(404).json({ error: 'No encontrado' });
    await db.execute({
      sql: `UPDATE inventario SET ${CAMPOS.map(c=>`${c}=?`).join(',')},updated_at=datetime('now') WHERE id=?`,
      args: [...CAMPOS.map(c => d[c]), id],
    });
    const { rows } = await db.execute({ sql:'SELECT * FROM inventario WHERE id=?', args:[id] });
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({ error: 'Error al actualizar ítem' });
  }
});

// DELETE /api/inventario/:id
router.delete('/:id', verifyToken, requirePermiso('editar_inventario'), async (req, res) => {
  try {
    const { rows } = await db.execute({ sql:'SELECT id FROM inventario WHERE id=? AND institucion_id=?', args:[req.params.id, req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    await db.execute({ sql:'DELETE FROM inventario WHERE id=?', args:[req.params.id] });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al eliminar ítem' });
  }
});

module.exports = router;
