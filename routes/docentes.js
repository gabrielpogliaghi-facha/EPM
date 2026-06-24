const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'docentes');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `doc_${req.params.usuarioId}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo imágenes')),
});

// ── Lista todos los docentes (usuarios con rol Docente + sus fichas) ──────────
router.get('/', verifyToken, requirePermiso('ver_equipo_docente'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT u.id AS usuario_id, u.nombre, u.email, u.activo,
                   d.id AS docente_id, d.dni, d.fecha_nacimiento, d.telefono,
                   d.formacion, d.foto_path,
                   GROUP_CONCAT(DISTINCT i.nombre ORDER BY i.nombre) AS instrumentos_nombres,
                   GROUP_CONCAT(DISTINCT c.nombre ORDER BY c.nombre) AS cursos_nombres
            FROM usuarios u
            JOIN roles r ON r.id = u.rol_id AND r.nombre = 'Docente'
            LEFT JOIN docentes d ON d.usuario_id = u.id
            LEFT JOIN docente_instrumentos di ON di.docente_id = d.id
            LEFT JOIN instrumentos i ON i.id = di.instrumento_id
            LEFT JOIN usuarios_cursos uc ON uc.usuario_id = u.id AND uc.materia_id IS NULL
            LEFT JOIN cursos c ON c.id = uc.curso_id
            WHERE u.institucion_id = ? AND u.activo = 1
            GROUP BY u.id
            ORDER BY u.nombre`,
      args: [req.user.institucion_id],
    });
    res.json(rows);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener equipo docente' });
  }
});

// ── Obtiene ficha de un docente ───────────────────────────────────────────────
router.get('/:usuarioId', verifyToken, requirePermiso('ver_equipo_docente'), async (req, res) => {
  const uid = Number(req.params.usuarioId);
  try {
    const { rows: uRows } = await db.execute({
      sql: `SELECT u.id AS usuario_id, u.nombre, u.email,
                   d.id AS docente_id, d.dni, d.fecha_nacimiento, d.telefono, d.formacion, d.foto_path
            FROM usuarios u
            LEFT JOIN docentes d ON d.usuario_id = u.id
            WHERE u.id=? AND u.institucion_id=? AND u.activo=1`,
      args: [uid, req.user.institucion_id],
    });
    if (!uRows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    const doc = uRows[0];

    const { rows: instRows } = await db.execute({
      sql: `SELECT di.instrumento_id AS id, i.nombre
            FROM docente_instrumentos di JOIN instrumentos i ON i.id=di.instrumento_id
            WHERE di.docente_id=(SELECT id FROM docentes WHERE usuario_id=?)`,
      args: [uid],
    });
    const { rows: cursosRows } = await db.execute({
      sql: `SELECT uc.curso_id AS id, c.nombre
            FROM usuarios_cursos uc JOIN cursos c ON c.id=uc.curso_id
            WHERE uc.usuario_id=? AND uc.materia_id IS NULL`,
      args: [uid],
    });

    res.json({ ...doc, instrumentos: instRows, cursos: cursosRows });
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener ficha docente' });
  }
});

// ── Crea o actualiza ficha de un docente ─────────────────────────────────────
router.put('/:usuarioId', verifyToken, async (req, res) => {
  const uid = Number(req.params.usuarioId);
  const puedeEditar = req.user.permisos.includes('editar_equipo_docente');
  const esPropio    = req.user.id === uid;
  if (!puedeEditar && !esPropio)
    return res.status(403).json({ error: 'Sin permiso para editar esta ficha' });

  const { dni, fecha_nacimiento, telefono, formacion, instrumento_ids } = req.body;
  try {
    // Verificar que el usuario existe en la institución
    const { rows: uRows } = await db.execute({
      sql: 'SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1',
      args: [uid, req.user.institucion_id],
    });
    if (!uRows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Upsert docente ficha
    const { rows: dRows } = await db.execute({
      sql: 'SELECT id FROM docentes WHERE usuario_id=?',
      args: [uid],
    });
    let docenteId;
    if (dRows[0]) {
      docenteId = Number(dRows[0].id);
      await db.execute({
        sql: `UPDATE docentes SET dni=?,fecha_nacimiento=?,telefono=?,formacion=?,updated_at=datetime('now') WHERE id=?`,
        args: [dni||null, fecha_nacimiento||null, telefono||null, formacion||null, docenteId],
      });
    } else {
      const r = await db.execute({
        sql: `INSERT INTO docentes (usuario_id, institucion_id, dni, fecha_nacimiento, telefono, formacion)
              VALUES (?,?,?,?,?,?)`,
        args: [uid, req.user.institucion_id, dni||null, fecha_nacimiento||null, telefono||null, formacion||null],
      });
      docenteId = Number(r.lastInsertRowid);
    }

    // Actualizar instrumentos
    if (Array.isArray(instrumento_ids)) {
      await db.execute({ sql: 'DELETE FROM docente_instrumentos WHERE docente_id=?', args: [docenteId] });
      for (const iid of instrumento_ids) {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO docente_instrumentos (docente_id, instrumento_id) VALUES (?,?)',
          args: [docenteId, iid],
        });
      }
    }

    res.json({ ok: true, docente_id: docenteId });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar ficha docente' });
  }
});

// ── Foto ──────────────────────────────────────────────────────────────────────
router.post('/:usuarioId/foto', verifyToken, upload.single('foto'), async (req, res) => {
  const uid = Number(req.params.usuarioId);
  const puedeEditar = req.user.permisos.includes('editar_equipo_docente');
  const esPropio    = req.user.id === uid;
  if (!puedeEditar && !esPropio) return res.status(403).json({ error: 'Sin permiso' });
  if (!req.file) return res.status(400).json({ error: 'Sin archivo' });
  try {
    const { rows } = await db.execute({ sql:'SELECT id,foto_path FROM docentes WHERE usuario_id=?', args:[uid] });
    if (rows[0]?.foto_path) {
      const old = path.join(uploadsDir, path.basename(rows[0].foto_path));
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const fotoPath = `/uploads/docentes/${req.file.filename}`;
    if (rows[0]) {
      await db.execute({ sql:"UPDATE docentes SET foto_path=?,updated_at=datetime('now') WHERE usuario_id=?", args:[fotoPath,uid] });
    } else {
      const { rows: uRows } = await db.execute({ sql:'SELECT institucion_id FROM usuarios WHERE id=?', args:[uid] });
      await db.execute({ sql:'INSERT INTO docentes (usuario_id,institucion_id,foto_path) VALUES (?,?,?)', args:[uid,uRows[0].institucion_id,fotoPath] });
    }
    res.json({ foto_path: fotoPath });
  } catch(e) { res.status(500).json({ error: 'Error al subir foto' }); }
});

module.exports = router;
