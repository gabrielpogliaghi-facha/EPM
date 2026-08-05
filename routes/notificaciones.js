const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken } = require('../middleware/auth');

// Los cumpleaños tienen su propio ícono en el header (🎂) desde que se separó de la
// campanita — nunca deben aparecer acá, ni los que ya existan de antes en la DB.
const SIN_CUMPLEANIOS = `(entidad_tipo IS NULL OR entidad_tipo NOT IN ('cumpleanios_est','cumpleanios_usuario'))`;

// GET /api/notificaciones
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT * FROM notificaciones WHERE usuario_id=? AND ${SIN_CUMPLEANIOS} ORDER BY created_at DESC LIMIT 50`,
      args: [req.user.id],
    });
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// GET /api/notificaciones/no-leidas
router.get('/no-leidas', verifyToken, async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id=? AND leida=0 AND ${SIN_CUMPLEANIOS}`,
      args: [req.user.id],
    });
    res.json({ total: Number(rows[0].total) });
  } catch(e) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/notificaciones/leer-todas  (debe ir ANTES de /:id/leer)
router.put('/leer-todas', verifyToken, async (req, res) => {
  try {
    await db.execute({
      sql: "UPDATE notificaciones SET leida=1 WHERE usuario_id=?",
      args: [req.user.id],
    });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/notificaciones/:id/leer
router.put('/:id/leer', verifyToken, async (req, res) => {
  try {
    await db.execute({
      sql: 'UPDATE notificaciones SET leida=1 WHERE id=? AND usuario_id=?',
      args: [req.params.id, req.user.id],
    });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
