const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// ── MULTER PARA FOTOS ──────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads', 'estudiantes');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `est_${req.params.id}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo se permiten imágenes'));
  },
});

// ── BULK AUTORIZAR (debe ir ANTES de PUT /:id) ────────────────────────────────
router.put('/bulk-autorizar', verifyToken, requirePermiso('editar_estudiantes'), async (req, res) => {
  const { ids, auth_imagen, auth_general, auth_boleto } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Se requiere al menos un estudiante' });
  if (!auth_imagen && !auth_general && !auth_boleto)
    return res.status(400).json({ error: 'Seleccioná al menos una autorización' });

  const setParts = [];
  if (auth_imagen)  setParts.push('auth_imagen  = 1');
  if (auth_general) setParts.push('auth_general = 1');
  if (auth_boleto)  setParts.push('auth_boleto  = 1');

  const ph  = ids.map(() => '?').join(',');
  const sql = `UPDATE estudiantes SET ${setParts.join(', ')}, updated_at=datetime('now') WHERE id IN (${ph}) AND institucion_id = ? AND activo = 1`;
  try {
    const r = await db.execute({ sql, args: [...ids.map(Number), req.user.institucion_id] });
    res.json({ success: true, actualizados: r.rowsAffected });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar autorizaciones' });
  }
});

// ── FOTO: subir ───────────────────────────────────────────────────────────────
router.post('/:id/foto', verifyToken, requirePermiso('editar_estudiantes'), upload.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  try {
    const { rows } = await db.execute({
      sql: 'SELECT foto_path FROM estudiantes WHERE id=? AND institucion_id=? AND activo=1',
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) { fs.unlink(req.file.path, () => {}); return res.status(404).json({ error: 'Estudiante no encontrado' }); }

    if (rows[0].foto_path) {
      const old = path.join(__dirname, '..', 'uploads', 'estudiantes', path.basename(rows[0].foto_path));
      fs.unlink(old, () => {});
    }
    const fotoPath = `/uploads/estudiantes/${req.file.filename}`;
    await db.execute({ sql: "UPDATE estudiantes SET foto_path=?, updated_at=datetime('now') WHERE id=?", args: [fotoPath, Number(req.params.id)] });
    res.json({ foto_path: fotoPath });
  } catch (e) {
    res.status(500).json({ error: 'Error al subir foto' });
  }
});

// ── FOTO: quitar ──────────────────────────────────────────────────────────────
router.delete('/:id/foto', verifyToken, requirePermiso('editar_estudiantes'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT foto_path FROM estudiantes WHERE id=? AND institucion_id=? AND activo=1',
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (rows[0].foto_path) {
      const p = path.join(__dirname, '..', 'uploads', 'estudiantes', path.basename(rows[0].foto_path));
      fs.unlink(p, () => {});
      await db.execute({ sql: "UPDATE estudiantes SET foto_path=NULL, updated_at=datetime('now') WHERE id=?", args: [Number(req.params.id)] });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al quitar foto' });
  }
});

// POST /api/estudiantes/importar
router.post('/importar', verifyToken, requirePermiso('crear_estudiantes'), async (req, res) => {
  const { estudiantes: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'Array de estudiantes requerido' });

  const sql = `INSERT INTO estudiantes
    (institucion_id, curso_id, nombre, apellido, dni, cuit, fecha_nacimiento,
     tutor_nombre, tutor_dni, direccion, auth_imagen, auth_general, auth_boleto)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  let importados = 0;
  const errores = [];
  for (const e of rows) {
    try {
      await db.execute({
        sql,
        args: [
          req.user.institucion_id, e.curso_id || null,
          e.nombre.trim(), e.apellido.trim(), e.dni.trim(),
          e.cuit?.trim() || null, e.fecha_nacimiento || null,
          e.tutor_nombre?.trim() || null, e.tutor_dni?.trim() || null,
          e.direccion?.trim() || null,
          e.auth_imagen ? 1 : 0, e.auth_general ? 1 : 0, e.auth_boleto ? 1 : 0,
        ],
      });
      importados++;
    } catch (err) {
      errores.push({ dni: e.dni, error: err.message?.includes('UNIQUE') ? 'DNI ya existe en el sistema' : err.message });
    }
  }
  res.json({ importados, errores });
});

// GET /api/estudiantes?curso_id=&instrumento_id=&buscar=
router.get('/', verifyToken, requirePermiso('ver_estudiantes'), async (req, res) => {
  try {
    const { curso_id, instrumento_id, buscar } = req.query;

    let sql = `SELECT DISTINCT e.id, e.nombre, e.apellido, e.dni, e.cuit, e.fecha_nacimiento,
               e.tutor_nombre, e.tutor_dni, e.direccion, e.foto_path,
               e.auth_imagen, e.auth_general, e.auth_boleto, e.created_at
               FROM estudiantes e`;
    const args = [];

    if (curso_id || instrumento_id) {
      sql += ' JOIN inscripciones ins ON ins.estudiante_id = e.id AND ins.activo = 1';
    }
    sql += ' WHERE e.institucion_id = ? AND e.activo = 1';
    args.push(req.user.institucion_id);

    if (curso_id)       { sql += ' AND ins.curso_id = ?';       args.push(Number(curso_id)); }
    if (instrumento_id) { sql += ' AND ins.instrumento_id = ?'; args.push(Number(instrumento_id)); }
    if (buscar) {
      sql += ' AND (e.nombre LIKE ? OR e.apellido LIKE ? OR e.dni LIKE ?)';
      const t = `%${buscar}%`; args.push(t, t, t);
    }
    sql += ' ORDER BY e.apellido, e.nombre';

    const { rows: estudiantes } = await db.execute({ sql, args });

    // Carga todas las inscripciones de los estudiantes obtenidos en una sola query (evita N+1)
    if (estudiantes.length === 0) return res.json([]);

    const estIds  = estudiantes.map(e => Number(e.id));
    const ph      = estIds.map(() => '?').join(',');
    const { rows: inscs } = await db.execute({
      sql: `SELECT ins.id, ins.estudiante_id, ins.curso_id, ins.instrumento_id,
                   c.nombre AS curso_nombre, i.nombre AS instrumento_nombre
            FROM inscripciones ins
            JOIN cursos      c ON ins.curso_id       = c.id
            JOIN instrumentos i ON ins.instrumento_id = i.id
            WHERE ins.estudiante_id IN (${ph}) AND ins.activo = 1
            ORDER BY i.nombre`,
      args: estIds,
    });

    const inscMap = {};
    inscs.forEach(ins => {
      const eid = Number(ins.estudiante_id);
      if (!inscMap[eid]) inscMap[eid] = [];
      inscMap[eid].push(ins);
    });

    res.json(estudiantes.map(e => ({ ...e, inscripciones: inscMap[Number(e.id)] || [] })));
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// GET /api/estudiantes/:id
router.get('/:id', verifyToken, requirePermiso('ver_estudiantes'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT e.* FROM estudiantes e WHERE e.id = ? AND e.institucion_id = ? AND e.activo = 1`,
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const { rows: inscs } = await db.execute({
      sql: `SELECT ins.id, ins.curso_id, ins.instrumento_id,
                   c.nombre AS curso_nombre, i.nombre AS instrumento_nombre
            FROM inscripciones ins
            JOIN cursos      c ON ins.curso_id       = c.id
            JOIN instrumentos i ON ins.instrumento_id = i.id
            WHERE ins.estudiante_id = ? AND ins.activo = 1
            ORDER BY i.nombre`,
      args: [Number(req.params.id)],
    });
    res.json({ ...rows[0], inscripciones: inscs });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener estudiante' });
  }
});

// POST /api/estudiantes
router.post('/', verifyToken, requirePermiso('crear_estudiantes'), async (req, res) => {
  const { nombre, apellido, dni, cuit, fecha_nacimiento,
          tutor_nombre, tutor_dni, direccion, curso_id,
          auth_imagen, auth_general, auth_boleto } = req.body;
  if (!nombre?.trim() || !apellido?.trim() || !dni?.trim())
    return res.status(400).json({ error: 'Nombre, apellido y DNI son obligatorios' });
  try {
    const r = await db.execute({
      sql: `INSERT INTO estudiantes
              (institucion_id, curso_id, nombre, apellido, dni, cuit, fecha_nacimiento,
               tutor_nombre, tutor_dni, direccion, auth_imagen, auth_general, auth_boleto)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        req.user.institucion_id, curso_id || null,
        nombre.trim(), apellido.trim(), dni.trim(),
        cuit?.trim() || null, fecha_nacimiento || null,
        tutor_nombre?.trim() || null, tutor_dni?.trim() || null,
        direccion?.trim() || null,
        auth_imagen ? 1 : 0, auth_general ? 1 : 0, auth_boleto ? 1 : 0,
      ],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un estudiante con ese DNI' });
    res.status(500).json({ error: 'Error al crear estudiante' });
  }
});

// PUT /api/estudiantes/:id
router.put('/:id', verifyToken, requirePermiso('editar_estudiantes'), async (req, res) => {
  const { nombre, apellido, dni, cuit, fecha_nacimiento,
          tutor_nombre, tutor_dni, direccion, curso_id,
          auth_imagen, auth_general, auth_boleto } = req.body;
  if (!nombre?.trim() || !apellido?.trim() || !dni?.trim())
    return res.status(400).json({ error: 'Nombre, apellido y DNI son obligatorios' });
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM estudiantes WHERE id = ? AND institucion_id = ? AND activo = 1',
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Estudiante no encontrado' });

    await db.execute({
      sql: `UPDATE estudiantes SET
              curso_id=?, nombre=?, apellido=?, dni=?, cuit=?, fecha_nacimiento=?,
              tutor_nombre=?, tutor_dni=?, direccion=?,
              auth_imagen=?, auth_general=?, auth_boleto=?, updated_at=datetime('now')
            WHERE id=?`,
      args: [
        curso_id || null,
        nombre.trim(), apellido.trim(), dni.trim(),
        cuit?.trim() || null, fecha_nacimiento || null,
        tutor_nombre?.trim() || null, tutor_dni?.trim() || null,
        direccion?.trim() || null,
        auth_imagen ? 1 : 0, auth_general ? 1 : 0, auth_boleto ? 1 : 0,
        Number(req.params.id),
      ],
    });
    res.json({ success: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un estudiante con ese DNI' });
    res.status(500).json({ error: 'Error al actualizar estudiante' });
  }
});

// ── INSCRIPCIONES ─────────────────────────────────────────────────────────────

// GET /api/estudiantes/:id/inscripciones
router.get('/:id/inscripciones', verifyToken, requirePermiso('ver_estudiantes'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT ins.id, ins.curso_id, ins.instrumento_id,
                   c.nombre AS curso_nombre, i.nombre AS instrumento_nombre
            FROM inscripciones ins
            JOIN cursos      c ON ins.curso_id       = c.id
            JOIN instrumentos i ON ins.instrumento_id = i.id
            WHERE ins.estudiante_id = ? AND ins.activo = 1
            ORDER BY i.nombre`,
      args: [Number(req.params.id)],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
});

// POST /api/estudiantes/:id/inscripciones — agregar inscripción {curso_id, instrumento_id}
router.post('/:id/inscripciones', verifyToken, requirePermiso('editar_estudiantes'), async (req, res) => {
  const { curso_id, instrumento_id } = req.body;
  if (!curso_id || !instrumento_id) return res.status(400).json({ error: 'curso_id e instrumento_id requeridos' });

  const estId = Number(req.params.id);
  try {
    const { rows: est } = await db.execute({
      sql: 'SELECT id FROM estudiantes WHERE id=? AND institucion_id=? AND activo=1',
      args: [estId, req.user.institucion_id],
    });
    if (!est[0]) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const r = await db.execute({
      sql: 'INSERT INTO inscripciones (estudiante_id, curso_id, instrumento_id) VALUES (?,?,?)',
      args: [estId, Number(curso_id), Number(instrumento_id)],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Este estudiante ya tiene una inscripción en ese instrumento' });
    res.status(500).json({ error: 'Error al crear inscripción' });
  }
});

// PUT /api/estudiantes/:id/inscripciones/:inscId — cambiar nivel (curso)
router.put('/:id/inscripciones/:inscId', verifyToken, requirePermiso('editar_estudiantes'), async (req, res) => {
  const { curso_id } = req.body;
  if (!curso_id) return res.status(400).json({ error: 'curso_id requerido' });

  const estId  = Number(req.params.id);
  const inscId = Number(req.params.inscId);
  try {
    const { rows } = await db.execute({
      sql: `SELECT ins.id, ins.instrumento_id, ins.curso_id FROM inscripciones ins
            JOIN estudiantes e ON ins.estudiante_id = e.id
            WHERE ins.id=? AND ins.estudiante_id=? AND e.institucion_id=? AND ins.activo=1`,
      args: [inscId, estId, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Inscripción no encontrada' });

    const cursoAnterior = Number(rows[0].curso_id);
    await db.execute({
      sql: "UPDATE inscripciones SET curso_id=?, updated_at=datetime('now') WHERE id=?",
      args: [Number(curso_id), inscId],
    });

    // Registrar en historial si hubo cambio de nivel
    if (cursoAnterior !== Number(curso_id)) {
      await db.execute({
        sql: 'INSERT INTO historial_inscripciones (estudiante_id, instrumento_id, curso_id_prev, curso_id_nuevo, registrado_por) VALUES (?,?,?,?,?)',
        args: [estId, Number(rows[0].instrumento_id), cursoAnterior, Number(curso_id), req.user.id],
      });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar inscripción' });
  }
});

// DELETE /api/estudiantes/:id/inscripciones/:inscId
router.delete('/:id/inscripciones/:inscId', verifyToken, requirePermiso('editar_estudiantes'), async (req, res) => {
  const estId  = Number(req.params.id);
  const inscId = Number(req.params.inscId);
  try {
    const { rows } = await db.execute({
      sql: `SELECT ins.id FROM inscripciones ins JOIN estudiantes e ON ins.estudiante_id = e.id
            WHERE ins.id=? AND ins.estudiante_id=? AND e.institucion_id=? AND ins.activo=1`,
      args: [inscId, estId, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Inscripción no encontrada' });
    await db.execute({ sql: 'UPDATE inscripciones SET activo=0 WHERE id=?', args: [inscId] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar inscripción' });
  }
});

// DELETE /api/estudiantes/:id — soft delete
router.delete('/:id', verifyToken, requirePermiso('editar_estudiantes'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT id, nombre, apellido FROM estudiantes WHERE id = ? AND institucion_id = ? AND activo = 1',
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Estudiante no encontrado' });
    await db.execute({ sql: "UPDATE estudiantes SET activo=0, updated_at=datetime('now') WHERE id=?", args: [Number(req.params.id)] });
    res.json({ success: true, nombre: `${rows[0].apellido}, ${rows[0].nombre}` });
  } catch (e) {
    res.status(500).json({ error: 'Error al dar de baja estudiante' });
  }
});

module.exports = router;
