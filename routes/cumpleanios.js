const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/cumpleanios?mes=MM&anio=YYYY
// Fuente de datos: estudiantes.fecha_nacimiento + usuarios.fecha_nacimiento (cualquier rol:
// Docente, Operador, Gestión — no solo docentes). Desde la unificación del perfil (módulo 20)
// la fecha de nacimiento del equipo vive directamente en `usuarios`, no en la vieja tabla
// `docentes` (que quedó vacía, solo por compatibilidad hacia atrás) — por eso NO se consulta.
router.get('/', verifyToken, async (req, res) => {
  const mes  = parseInt(req.query.mes)  || (new Date().getMonth() + 1);
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  const mm   = String(mes).padStart(2, '0');
  try {
    // Estudiantes con cumpleaños en ese mes
    const { rows: ests } = await db.execute({
      sql: `SELECT nombre, apellido, fecha_nacimiento, 'estudiante' AS tipo, NULL AS rol_nombre
            FROM estudiantes
            WHERE institucion_id=? AND activo=1
              AND fecha_nacimiento IS NOT NULL
              AND strftime('%m', fecha_nacimiento) = ?
            ORDER BY strftime('%d', fecha_nacimiento)`,
      args: [req.user.institucion_id, mm],
    });
    // Equipo: cualquier usuario activo con fecha de nacimiento cargada en su perfil
    // (Docente, Operador o Gestión — antes solo se consultaban Docentes).
    const { rows: usrs } = await db.execute({
      sql: `SELECT u.nombre, COALESCE(u.apellido,'') AS apellido, u.fecha_nacimiento, 'usuario' AS tipo, r.nombre AS rol_nombre
            FROM usuarios u
            JOIN roles r ON r.id = u.rol_id
            WHERE u.institucion_id=? AND u.activo=1
              AND u.fecha_nacimiento IS NOT NULL
              AND strftime('%m', u.fecha_nacimiento) = ?
            ORDER BY strftime('%d', u.fecha_nacimiento)`,
      args: [req.user.institucion_id, mm],
    });

    const todos = [...ests, ...usrs]
      .map(r => ({
        nombre:     `${r.nombre} ${r.apellido}`.trim(),
        tipo:       r.tipo,          // 'estudiante' | 'usuario'
        rol_nombre: r.rol_nombre,    // solo para tipo 'usuario': Docente/Operador/Gestión
        dia:        parseInt(r.fecha_nacimiento.slice(8, 10)),
        fecha_nacimiento: r.fecha_nacimiento,
      }))
      .sort((a, b) => a.dia - b.dia);

    res.json(todos);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener cumpleaños' });
  }
});

module.exports = router;
