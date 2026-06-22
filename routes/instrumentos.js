const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// GET /api/instrumentos
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT id, nombre,
                   (SELECT COUNT(*) FROM inscripciones WHERE instrumento_id = i.id AND activo = 1) AS inscripciones
            FROM instrumentos i
            WHERE institucion_id = ? AND activo = 1
            ORDER BY nombre`,
      args: [req.user.institucion_id],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener instrumentos' });
  }
});

// POST /api/instrumentos
router.post('/', verifyToken, requirePermiso('administrar_cursos'), async (req, res) => {
  const nombre = req.body.nombre?.trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const r = await db.execute({
      sql: 'INSERT INTO instrumentos (institucion_id, nombre) VALUES (?,?)',
      args: [req.user.institucion_id, nombre],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), nombre });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un instrumento con ese nombre' });
    res.status(500).json({ error: 'Error al crear instrumento' });
  }
});

// PUT /api/instrumentos/:id
router.put('/:id', verifyToken, requirePermiso('administrar_cursos'), async (req, res) => {
  const nombre = req.body.nombre?.trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM instrumentos WHERE id=? AND institucion_id=? AND activo=1',
      args: [req.params.id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Instrumento no encontrado' });
    await db.execute({ sql: 'UPDATE instrumentos SET nombre=? WHERE id=?', args: [nombre, req.params.id] });
    res.json({ success: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un instrumento con ese nombre' });
    res.status(500).json({ error: 'Error al actualizar instrumento' });
  }
});

// DELETE /api/instrumentos/:id
router.delete('/:id', verifyToken, requirePermiso('administrar_cursos'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id, nombre FROM instrumentos WHERE id=? AND institucion_id=? AND activo=1',
      args: [req.params.id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Instrumento no encontrado' });

    const { rows: uRows } = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM inscripciones WHERE instrumento_id=? AND activo=1',
      args: [req.params.id],
    });
    const c = Number(uRows[0].c);
    if (c > 0) return res.status(409).json({ error: `Hay ${c} inscripción(es) activas con este instrumento. Quitálas primero.` });

    await db.execute({ sql: 'UPDATE instrumentos SET activo=0 WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar instrumento' });
  }
});

module.exports = router;
