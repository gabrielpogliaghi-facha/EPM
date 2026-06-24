const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/cumpleanios?mes=MM&anio=YYYY
router.get('/', verifyToken, async (req, res) => {
  const mes  = parseInt(req.query.mes)  || (new Date().getMonth() + 1);
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  const mm   = String(mes).padStart(2, '0');
  try {
    // Estudiantes con cumpleaños en ese mes
    const { rows: ests } = await db.execute({
      sql: `SELECT nombre, apellido, fecha_nacimiento, 'estudiante' AS tipo
            FROM estudiantes
            WHERE institucion_id=? AND activo=1
              AND fecha_nacimiento IS NOT NULL
              AND strftime('%m', fecha_nacimiento) = ?
            ORDER BY strftime('%d', fecha_nacimiento)`,
      args: [req.user.institucion_id, mm],
    });
    // Docentes (usuarios con Docente role que tienen fecha de nacimiento en su ficha)
    const { rows: docs } = await db.execute({
      sql: `SELECT u.nombre, '' AS apellido, d.fecha_nacimiento, 'docente' AS tipo
            FROM docentes d
            JOIN usuarios u ON u.id = d.usuario_id
            JOIN roles r ON r.id = u.rol_id AND r.nombre = 'Docente'
            WHERE u.institucion_id=? AND u.activo=1
              AND d.fecha_nacimiento IS NOT NULL
              AND strftime('%m', d.fecha_nacimiento) = ?
            ORDER BY strftime('%d', d.fecha_nacimiento)`,
      args: [req.user.institucion_id, mm],
    });

    const todos = [...ests, ...docs]
      .map(r => ({
        nombre:   r.tipo === 'estudiante' ? `${r.nombre} ${r.apellido}`.trim() : r.nombre,
        tipo:     r.tipo,
        dia:      parseInt(r.fecha_nacimiento.slice(8, 10)),
        fecha_nacimiento: r.fecha_nacimiento,
      }))
      .sort((a, b) => a.dia - b.dia);

    res.json(todos);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener cumpleaños' });
  }
});

// POST /api/cumpleanios/notificar — crea notificaciones para cumpleaños de hoy y próximos 6 días
router.post('/notificar', verifyToken, async (req, res) => {
  try {
    const hoy   = new Date();
    const notificados = [];

    for (let i = 0; i <= 6; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      const dd = String(fecha.getDate()).padStart(2, '0');
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');

      const { rows: ests } = await db.execute({
        sql: `SELECT id, nombre, apellido, fecha_nacimiento FROM estudiantes
              WHERE institucion_id=? AND activo=1
                AND strftime('%m-%d', fecha_nacimiento) = ?`,
        args: [req.user.institucion_id, `${mm}-${dd}`],
      });
      const { rows: docs } = await db.execute({
        sql: `SELECT u.id AS usuario_id, u.nombre, d.fecha_nacimiento
              FROM docentes d JOIN usuarios u ON u.id=d.usuario_id
              WHERE u.institucion_id=? AND u.activo=1
                AND strftime('%m-%d', d.fecha_nacimiento) = ?`,
        args: [req.user.institucion_id, `${mm}-${dd}`],
      });

      for (const e of ests) {
        // Deduplicar: no crear si ya hay una notif de este cumpleaños hoy
        const { rows: dup } = await db.execute({
          sql: `SELECT id FROM notificaciones
                WHERE usuario_id=? AND entidad_tipo='cumpleanios_est' AND entidad_id=?
                  AND date(created_at)=date('now')`,
          args: [req.user.id, e.id],
        });
        if (dup.length) continue;
        const nombre = `${e.nombre} ${e.apellido}`.trim();
        const edad   = fecha.getFullYear() - parseInt(e.fecha_nacimiento.slice(0,4));
        const titulo = i === 0 ? `🎂 Cumpleaños hoy: ${nombre}` : `🎂 Cumpleaños el ${dd}/${mm}: ${nombre}`;
        const msg    = `${nombre} cumple ${edad} años${i === 0 ? ' hoy' : ` el ${dd}/${mm}`}.`;
        await db.execute({
          sql: 'INSERT INTO notificaciones (usuario_id,titulo,mensaje,tipo,entidad_tipo,entidad_id) VALUES (?,?,?,?,?,?)',
          args: [req.user.id, titulo, msg, 'info', 'cumpleanios_est', e.id],
        });
        notificados.push(nombre);
      }

      for (const d of docs) {
        const { rows: dup } = await db.execute({
          sql: `SELECT id FROM notificaciones
                WHERE usuario_id=? AND entidad_tipo='cumpleanios_doc' AND entidad_id=?
                  AND date(created_at)=date('now')`,
          args: [req.user.id, d.usuario_id],
        });
        if (dup.length) continue;
        const edad   = fecha.getFullYear() - parseInt(d.fecha_nacimiento.slice(0,4));
        const titulo = i === 0 ? `🎂 Cumpleaños hoy: ${d.nombre}` : `🎂 Cumpleaños el ${dd}/${mm}: ${d.nombre}`;
        const msg    = `${d.nombre} (docente) cumple ${edad} años${i === 0 ? ' hoy' : ` el ${dd}/${mm}`}.`;
        await db.execute({
          sql: 'INSERT INTO notificaciones (usuario_id,titulo,mensaje,tipo,entidad_tipo,entidad_id) VALUES (?,?,?,?,?,?)',
          args: [req.user.id, titulo, msg, 'info', 'cumpleanios_doc', d.usuario_id],
        });
        notificados.push(d.nombre);
      }
    }

    res.json({ notificados: notificados.length });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al notificar cumpleaños' });
  }
});

module.exports = router;
