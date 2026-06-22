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

// GET /api/estudiantes
router.get('/', verifyToken, requirePermiso('ver_estudiantes'), async (req, res) => {
  try {
    const { curso_id, buscar } = req.query;
    let sql = `
      SELECT e.id, e.nombre, e.apellido, e.dni, e.cuit, e.fecha_nacimiento,
             e.tutor_nombre, e.tutor_dni, e.direccion, e.foto_path, e.curso_id,
             e.auth_imagen, e.auth_general, e.auth_boleto, e.created_at,
             c.nombre AS curso_nombre
      FROM   estudiantes e LEFT JOIN cursos c ON e.curso_id = c.id
      WHERE  e.institucion_id = ? AND e.activo = 1
    `;
    const args = [req.user.institucion_id];
    if (curso_id) { sql += ' AND e.curso_id = ?'; args.push(Number(curso_id)); }
    if (buscar) {
      sql += ' AND (e.nombre LIKE ? OR e.apellido LIKE ? OR e.dni LIKE ?)';
      const t = `%${buscar}%`; args.push(t, t, t);
    }
    sql += ' ORDER BY e.apellido, e.nombre';
    const { rows } = await db.execute({ sql, args });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// GET /api/estudiantes/:id
router.get('/:id', verifyToken, requirePermiso('ver_estudiantes'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT e.*, c.nombre AS curso_nombre FROM estudiantes e LEFT JOIN cursos c ON e.curso_id = c.id WHERE e.id = ? AND e.institucion_id = ? AND e.activo = 1`,
      args: [Number(req.params.id), req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json(rows[0]);
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
