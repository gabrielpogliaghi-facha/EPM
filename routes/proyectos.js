const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const adjDir = path.join(__dirname, '..', 'uploads', 'proyectos');
fs.mkdirSync(adjDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: adjDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `proy_${req.params.id}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      'image/jpeg','image/png'].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Tipo de archivo no permitido'));
  },
});

const ESTADOS = ['borrador','en_curso','presentado','aprobado','rechazado','finalizado'];

// GET /api/proyectos?estado=
router.get('/', verifyToken, requirePermiso('ver_proyectos'), async (req, res) => {
  const { estado } = req.query;
  try {
    const args = [req.user.institucion_id];
    let where  = 'WHERE p.institucion_id=?';
    if (estado) { where += ' AND p.estado=?'; args.push(estado); }
    const { rows } = await db.execute({
      sql: `SELECT p.*, u.nombre AS creado_por_nombre
            FROM proyectos p LEFT JOIN usuarios u ON u.id=p.created_by
            ${where} ORDER BY p.updated_at DESC`,
      args,
    });
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
});

// GET /api/proyectos/:id
router.get('/:id', verifyToken, requirePermiso('ver_proyectos'), async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT p.*, u.nombre AS creado_por_nombre
            FROM proyectos p LEFT JOIN usuarios u ON u.id=p.created_by
            WHERE p.id=? AND p.institucion_id=?`,
      args: [req.params.id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const proyecto = rows[0];

    const { rows: hist } = await db.execute({
      sql: `SELECT ph.*, u.nombre AS registrado_por_nombre
            FROM proyecto_historial ph LEFT JOIN usuarios u ON u.id=ph.registrado_por
            WHERE ph.proyecto_id=? ORDER BY ph.created_at DESC`,
      args: [req.params.id],
    });
    const { rows: adjs } = await db.execute({
      sql: 'SELECT * FROM proyecto_adjuntos WHERE proyecto_id=? ORDER BY created_at',
      args: [req.params.id],
    });

    res.json({ ...proyecto, historial: hist, adjuntos: adjs });
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener proyecto' });
  }
});

// POST /api/proyectos
router.post('/', verifyToken, requirePermiso('editar_proyectos'), async (req, res) => {
  const { titulo, descripcion, estado, fecha_presentacion, destino } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const r = await db.execute({
      sql: `INSERT INTO proyectos (institucion_id,titulo,descripcion,estado,fecha_presentacion,destino,created_by)
            VALUES (?,?,?,?,?,?,?)`,
      args: [req.user.institucion_id, titulo.trim(), descripcion||null,
             ESTADOS.includes(estado) ? estado : 'borrador',
             fecha_presentacion||null, destino||null, req.user.id],
    });
    const id = Number(r.lastInsertRowid);
    await db.execute({
      sql: 'INSERT INTO proyecto_historial (proyecto_id,estado,nota,registrado_por) VALUES (?,?,?,?)',
      args: [id, estado||'borrador', 'Proyecto creado', req.user.id],
    });
    const { rows } = await db.execute({ sql:'SELECT * FROM proyectos WHERE id=?', args:[id] });
    res.status(201).json(rows[0]);
  } catch(e) {
    res.status(500).json({ error: 'Error al crear proyecto' });
  }
});

// PUT /api/proyectos/:id
router.put('/:id', verifyToken, requirePermiso('editar_proyectos'), async (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, estado, fecha_presentacion, destino } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const { rows: ex } = await db.execute({ sql:'SELECT estado FROM proyectos WHERE id=? AND institucion_id=?', args:[id, req.user.institucion_id] });
    if (!ex[0]) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const estadoAnterior = ex[0].estado;
    const estadoNuevo    = ESTADOS.includes(estado) ? estado : estadoAnterior;
    await db.execute({
      sql: `UPDATE proyectos SET titulo=?,descripcion=?,estado=?,fecha_presentacion=?,destino=?,updated_at=datetime('now') WHERE id=?`,
      args: [titulo.trim(), descripcion||null, estadoNuevo, fecha_presentacion||null, destino||null, id],
    });
    if (estadoNuevo !== estadoAnterior) {
      await db.execute({
        sql: 'INSERT INTO proyecto_historial (proyecto_id,estado,nota,registrado_por) VALUES (?,?,?,?)',
        args: [id, estadoNuevo, `Cambio de estado: ${estadoAnterior} → ${estadoNuevo}`, req.user.id],
      });
    }
    const { rows } = await db.execute({ sql:'SELECT * FROM proyectos WHERE id=?', args:[id] });
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  }
});

// DELETE /api/proyectos/:id
router.delete('/:id', verifyToken, requirePermiso('editar_proyectos'), async (req, res) => {
  try {
    const { rows } = await db.execute({ sql:'SELECT id FROM proyectos WHERE id=? AND institucion_id=?', args:[req.params.id, req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error: 'Proyecto no encontrado' });
    await db.execute({ sql:'DELETE FROM proyectos WHERE id=?', args:[req.params.id] });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al eliminar proyecto' });
  }
});

// POST /api/proyectos/:id/adjuntos
router.post('/:id/adjuntos', verifyToken, requirePermiso('editar_proyectos'), upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Sin archivo' });
  try {
    const { rows: ex } = await db.execute({ sql:'SELECT id FROM proyectos WHERE id=? AND institucion_id=?', args:[req.params.id, req.user.institucion_id] });
    if (!ex[0]) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const filePath = `/uploads/proyectos/${req.file.filename}`;
    const r = await db.execute({
      sql: 'INSERT INTO proyecto_adjuntos (proyecto_id,nombre,path,mime_type,created_by) VALUES (?,?,?,?,?)',
      args: [req.params.id, req.file.originalname, filePath, req.file.mimetype, req.user.id],
    });
    const { rows } = await db.execute({ sql:'SELECT * FROM proyecto_adjuntos WHERE id=?', args:[Number(r.lastInsertRowid)] });
    res.status(201).json(rows[0]);
  } catch(e) {
    res.status(500).json({ error: 'Error al subir adjunto' });
  }
});

// DELETE /api/proyectos/:id/adjuntos/:adjId
router.delete('/:id/adjuntos/:adjId', verifyToken, requirePermiso('editar_proyectos'), async (req, res) => {
  try {
    const { rows } = await db.execute({ sql:'SELECT * FROM proyecto_adjuntos WHERE id=? AND proyecto_id=?', args:[req.params.adjId, req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Adjunto no encontrado' });
    const filePath = path.join(__dirname, '..', rows[0].path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.execute({ sql:'DELETE FROM proyecto_adjuntos WHERE id=?', args:[req.params.adjId] });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al eliminar adjunto' });
  }
});

module.exports = router;
