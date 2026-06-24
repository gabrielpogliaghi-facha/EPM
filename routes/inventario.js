const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

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
                        WHEN inv.asignado_tipo='docente'    THEN (SELECT nombre FROM usuarios WHERE id=inv.asignado_id)
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
  const { nombre, instrumento_id, estado, asignado_tipo, asignado_id, numero_serie, observaciones, fecha_alta } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const r = await db.execute({
      sql: `INSERT INTO inventario (institucion_id,nombre,instrumento_id,estado,asignado_tipo,asignado_id,numero_serie,observaciones,fecha_alta)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [req.user.institucion_id, nombre.trim(), instrumento_id||null, estado||'disponible',
             asignado_tipo||null, asignado_id||null, numero_serie||null, observaciones||null,
             fecha_alta||new Date().toISOString().slice(0,10)],
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
  const { nombre, instrumento_id, estado, asignado_tipo, asignado_id, numero_serie, observaciones, fecha_alta } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const { rows: ex } = await db.execute({ sql:'SELECT id FROM inventario WHERE id=? AND institucion_id=?', args:[id, req.user.institucion_id] });
    if (!ex[0]) return res.status(404).json({ error: 'No encontrado' });
    await db.execute({
      sql: `UPDATE inventario SET nombre=?,instrumento_id=?,estado=?,asignado_tipo=?,asignado_id=?,
                                  numero_serie=?,observaciones=?,fecha_alta=?,updated_at=datetime('now') WHERE id=?`,
      args: [nombre.trim(), instrumento_id||null, estado||'disponible', asignado_tipo||null,
             asignado_id||null, numero_serie||null, observaciones||null, fecha_alta||null, id],
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
