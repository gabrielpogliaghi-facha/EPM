const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const bcrypt  = require('bcryptjs');
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

// ── Lista todos los docentes ──────────────────────────────────────────────────
router.get('/', verifyToken, requirePermiso('ver_equipo_docente'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT u.id AS usuario_id, u.nombre, u.email, u.activo,
                   d.id AS docente_id, d.dni, d.fecha_nacimiento, d.telefono,
                   d.formacion, d.foto_path,
                   d.instrumento_principal_id,
                   ip.nombre AS instrumento_principal_nombre,
                   GROUP_CONCAT(DISTINCT i.nombre ORDER BY i.nombre) AS instrumentos_nombres,
                   GROUP_CONCAT(DISTINCT c.nombre ORDER BY c.nombre) AS cursos_nombres
            FROM usuarios u
            JOIN roles r ON r.id = u.rol_id AND r.nombre = 'Docente'
            LEFT JOIN docentes d ON d.usuario_id = u.id
            LEFT JOIN instrumentos ip ON ip.id = d.instrumento_principal_id
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

// ── Usuarios sin ficha docente (para vincular) — ANTES de /:usuarioId ────────
router.get('/usuarios-sin-ficha', verifyToken, requirePermiso('editar_equipo_docente'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre
            FROM usuarios u
            JOIN roles r ON r.id = u.rol_id
            WHERE u.institucion_id=? AND u.activo=1
              AND NOT EXISTS (SELECT 1 FROM docentes d WHERE d.usuario_id = u.id)
            ORDER BY u.nombre`,
      args: [req.user.institucion_id],
    });
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ── Crear nuevo profe: opción A (nuevo usuario) o B (vincular existente) ──────
router.post('/', verifyToken, requirePermiso('editar_equipo_docente'), async (req, res) => {
  const { modo, nombre, email, password, vincular_usuario_id } = req.body;

  try {
    if (modo === 'vincular') {
      // ── Opción B: vincular usuario ya existente ─────────────────────────────
      if (!vincular_usuario_id) return res.status(400).json({ error: 'Seleccioná un usuario' });

      const { rows: uRows } = await db.execute({
        sql: 'SELECT id, nombre, email FROM usuarios WHERE id=? AND institucion_id=? AND activo=1',
        args: [vincular_usuario_id, req.user.institucion_id],
      });
      if (!uRows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Upsert ficha docente
      await db.execute({
        sql: 'INSERT OR IGNORE INTO docentes (usuario_id, institucion_id) VALUES (?,?)',
        args: [vincular_usuario_id, req.user.institucion_id],
      });

      return res.status(201).json({
        usuario_id:  Number(vincular_usuario_id),
        nombre:      uRows[0].nombre,
        email:       uRows[0].email,
        modo:        'vinculado',
      });
    }

    // ── Opción A: crear nuevo usuario con rol Docente ───────────────────────
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!email?.trim())  return res.status(400).json({ error: 'El email es requerido' });

    const emailNorm = email.toLowerCase().trim();
    const { rows: dup } = await db.execute({
      sql: 'SELECT id FROM usuarios WHERE email=?',
      args: [emailNorm],
    });
    if (dup[0]) return res.status(400).json({ error: 'Ya existe un usuario con ese email' });

    const { rows: rolRows } = await db.execute({
      sql: "SELECT id FROM roles WHERE nombre='Docente' LIMIT 1",
      args: [],
    });
    if (!rolRows[0]) return res.status(500).json({ error: 'Rol Docente no encontrado en el sistema' });

    // Contraseña temporal: la que venga o auto-generada
    const tempPwd  = password?.trim() || Math.random().toString(36).slice(-8) + '!';
    const hashPwd  = bcrypt.hashSync(tempPwd, 10);

    const r = await db.execute({
      sql: 'INSERT INTO usuarios (institucion_id, nombre, email, password_hash, rol_id) VALUES (?,?,?,?,?)',
      args: [req.user.institucion_id, nombre.trim(), emailNorm, hashPwd, rolRows[0].id],
    });
    const usuarioId = Number(r.lastInsertRowid);

    await db.execute({
      sql: 'INSERT INTO docentes (usuario_id, institucion_id) VALUES (?,?)',
      args: [usuarioId, req.user.institucion_id],
    });

    res.status(201).json({
      usuario_id:        usuarioId,
      nombre:            nombre.trim(),
      email:             emailNorm,
      password_temporal: tempPwd,
      modo:              'creado',
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear el docente' });
  }
});

// ── Obtiene ficha de un docente ───────────────────────────────────────────────
router.get('/:usuarioId', verifyToken, requirePermiso('ver_equipo_docente'), async (req, res) => {
  const uid = Number(req.params.usuarioId);
  try {
    const { rows: uRows } = await db.execute({
      sql: `SELECT u.id AS usuario_id, u.nombre, u.email,
                   d.id AS docente_id, d.dni, d.fecha_nacimiento, d.telefono, d.formacion, d.foto_path,
                   d.instrumento_principal_id
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
            WHERE di.docente_id=(SELECT id FROM docentes WHERE usuario_id=?)
            ORDER BY i.nombre`,
      args: [uid],
    });
    const { rows: cursosRows } = await db.execute({
      sql: `SELECT uc.curso_id AS id, c.nombre
            FROM usuarios_cursos uc JOIN cursos c ON c.id=uc.curso_id
            WHERE uc.usuario_id=? AND uc.materia_id IS NULL`,
      args: [uid],
    });

    res.json({
      ...doc,
      instrumento_principal_id: doc.instrumento_principal_id ? Number(doc.instrumento_principal_id) : null,
      instrumentos: instRows.map(i => ({ id: Number(i.id), nombre: i.nombre })),
      cursos: cursosRows.map(c => ({ id: Number(c.id), nombre: c.nombre })),
    });
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

  const { dni, fecha_nacimiento, telefono, formacion, instrumento_ids, instrumento_principal_id } = req.body;
  const principalId = instrumento_principal_id ? Number(instrumento_principal_id) : null;

  try {
    const { rows: uRows } = await db.execute({
      sql: 'SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1',
      args: [uid, req.user.institucion_id],
    });
    if (!uRows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { rows: dRows } = await db.execute({
      sql: 'SELECT id FROM docentes WHERE usuario_id=?',
      args: [uid],
    });
    let docenteId;
    if (dRows[0]) {
      docenteId = Number(dRows[0].id);
      await db.execute({
        sql: `UPDATE docentes SET dni=?,fecha_nacimiento=?,telefono=?,formacion=?,instrumento_principal_id=?,updated_at=datetime('now') WHERE id=?`,
        args: [dni||null, fecha_nacimiento||null, telefono||null, formacion||null, principalId, docenteId],
      });
    } else {
      const r = await db.execute({
        sql: `INSERT INTO docentes (usuario_id, institucion_id, dni, fecha_nacimiento, telefono, formacion, instrumento_principal_id)
              VALUES (?,?,?,?,?,?,?)`,
        args: [uid, req.user.institucion_id, dni||null, fecha_nacimiento||null, telefono||null, formacion||null, principalId],
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
