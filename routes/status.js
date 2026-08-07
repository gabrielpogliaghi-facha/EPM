const express = require('express');
const router  = express.Router();
const db      = require('../db');

// .trim() por si Render guardó la variable con un \n o espacio de más al pegarla
// en el dashboard (muy común) — sin esto, una key "igual a simple vista" nunca matchea.
const STATUS_API_KEY = (process.env.STATUS_API_KEY || '').trim();

// Endpoint de estado para un panel de control externo. Protegido por header
// "Authorization: Bearer <STATUS_API_KEY>" — no requiere sesión de usuario.
router.get('/', async (req, res) => {
  const auth = req.headers.authorization || '';
  // Case-insensitive en "Bearer" y tolerante a espacios extra entre el prefijo y la key.
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;

  // TEMPORAL — debug de longitudes para descartar caracteres invisibles de más/menos.
  // No loguea el valor de ninguna de las dos claves, solo su longitud.
  console.log(`[/api/status] longitud esperada=${STATUS_API_KEY.length} recibida=${token ? token.length : 'null'}`);

  if (!STATUS_API_KEY || !token || token !== STATUS_API_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // "Activos" = con login registrado en las últimas 48hs (rango elegido porque
    // el uso real es escolar/discontinuo, no una app de uso diario constante).
    const [activosRes, ultimoRes, alumnosRes] = await Promise.all([
      db.execute({
        sql: `SELECT COUNT(*) AS n FROM usuarios
              WHERE activo = 1 AND ultimo_login >= datetime('now', '-48 hours')`,
      }),
      db.execute({
        sql: `SELECT MAX(ultimo_login) AS ultimo FROM usuarios WHERE activo = 1`,
      }),
      db.execute({
        sql: `SELECT COUNT(*) AS n FROM estudiantes WHERE activo = 1`,
      }),
    ]);

    res.json({
      uptime: true,
      usuarios_activos: Number(activosRes.rows[0]?.n || 0),
      ultimo_ingreso: ultimoRes.rows[0]?.ultimo || null,
      total_alumnos: Number(alumnosRes.rows[0]?.n || 0),
    });
  } catch (e) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

module.exports = router;
