const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { verifyToken } = require('../middleware/auth');

const JWT_SECRET     = process.env.JWT_SECRET     || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const { rows } = await db.execute({
      sql: `SELECT u.*, r.nombre AS rol_nombre, i.nombre AS institucion_nombre
            FROM   usuarios u
            JOIN   roles r         ON u.rol_id        = r.id
            JOIN   instituciones i ON u.institucion_id = i.id
            WHERE  u.email = ? AND u.activo = 1`,
      args: [email.toLowerCase().trim()],
    });
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const { rows: permRows } = await db.execute({
      sql: `SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON rp.permiso_id = p.id WHERE rp.rol_id = ?`,
      args: [user.rol_id],
    });
    const permisos = permRows.map(r => r.codigo);

    const payload = {
      id: Number(user.id), nombre: user.nombre, email: user.email,
      rol_id: Number(user.rol_id), rol_nombre: user.rol_nombre,
      institucion_id: Number(user.institucion_id), institucion_nombre: user.institucion_nombre,
      permisos,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: payload });
  } catch (e) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// /me consulta la DB para garantizar datos y permisos frescos, devuelve token renovado.
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT u.id, u.nombre, u.email, u.rol_id, u.institucion_id, u.activo,
                   r.nombre AS rol_nombre, i.nombre AS institucion_nombre
            FROM   usuarios u
            JOIN   roles r         ON u.rol_id        = r.id
            JOIN   instituciones i ON u.institucion_id = i.id
            WHERE  u.id = ? AND u.activo = 1`,
      args: [req.user.id],
    });
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });

    const { rows: permRows } = await db.execute({
      sql: `SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON rp.permiso_id = p.id WHERE rp.rol_id = ?`,
      args: [user.rol_id],
    });
    const permisos = permRows.map(r => r.codigo);

    const payload = {
      id: Number(user.id), nombre: user.nombre, email: user.email,
      rol_id: Number(user.rol_id), rol_nombre: user.rol_nombre,
      institucion_id: Number(user.institucion_id), institucion_nombre: user.institucion_nombre,
      permisos,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ user: payload, token });
  } catch (e) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

module.exports = router;
