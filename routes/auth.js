const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { verifyToken } = require('../middleware/auth');

const JWT_SECRET     = process.env.JWT_SECRET     || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const user = db.prepare(`
    SELECT u.*, r.nombre AS rol_nombre, i.nombre AS institucion_nombre
    FROM   usuarios u
    JOIN   roles r         ON u.rol_id         = r.id
    JOIN   instituciones i ON u.institucion_id  = i.id
    WHERE  u.email = ? AND u.activo = 1
  `).get(email.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const permisos = db.prepare(`
    SELECT p.codigo
    FROM   roles_permisos rp
    JOIN   permisos p ON rp.permiso_id = p.id
    WHERE  rp.rol_id = ?
  `).all(user.rol_id).map(r => r.codigo);

  const payload = {
    id:                user.id,
    nombre:            user.nombre,
    email:             user.email,
    rol_id:            user.rol_id,
    rol_nombre:        user.rol_nombre,
    institucion_id:    user.institucion_id,
    institucion_nombre: user.institucion_nombre,
    permisos,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, user: payload });
});

// /me siempre consulta la DB para garantizar datos y permisos frescos,
// incluso si el token guardado en el cliente es antiguo y le faltan campos.
// Devuelve también un token renovado para que el cliente lo reemplace.
router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.nombre, u.email, u.rol_id, u.institucion_id, u.activo,
           r.nombre AS rol_nombre, i.nombre AS institucion_nombre
    FROM   usuarios u
    JOIN   roles r         ON u.rol_id        = r.id
    JOIN   instituciones i ON u.institucion_id = i.id
    WHERE  u.id = ? AND u.activo = 1
  `).get(req.user.id);

  if (!user) return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });

  const permisos = db.prepare(`
    SELECT p.codigo
    FROM   roles_permisos rp
    JOIN   permisos p ON rp.permiso_id = p.id
    WHERE  rp.rol_id = ?
  `).all(user.rol_id).map(r => r.codigo);

  const payload = {
    id:                 user.id,
    nombre:             user.nombre,
    email:              user.email,
    rol_id:             user.rol_id,
    rol_nombre:         user.rol_nombre,
    institucion_id:     user.institucion_id,
    institucion_nombre: user.institucion_nombre,
    permisos,
  };

  // Token renovado: reemplaza cualquier token viejo que le falten campos
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  res.json({ user: payload, token });
});

module.exports = router;
