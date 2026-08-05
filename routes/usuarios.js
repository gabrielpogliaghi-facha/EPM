const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const db      = require('../db');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

const admin = [verifyToken, requirePermiso('administrar_usuarios_roles')];

const fotosDir = path.join(__dirname, '..', 'uploads', 'usuarios');
fs.mkdirSync(fotosDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: fotosDir,
    filename: (req, file, cb) => {
      cb(null, `u_${req.params.id}_${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo imágenes')),
});

async function hayOtroAdmin(excludeId = null) {
  const sql = `SELECT COUNT(*) AS c FROM usuarios u
    JOIN roles_permisos rp ON rp.rol_id = u.rol_id
    JOIN permisos p ON rp.permiso_id = p.id
    WHERE p.codigo='administrar_usuarios_roles' AND u.activo=1
    ${excludeId ? 'AND u.id != ?' : ''}`;
  const { rows } = await db.execute({ sql, args: excludeId ? [excludeId] : [] });
  return Number(rows[0].c) > 0;
}

function rowToUsuario(u) {
  return {
    ...u,
    id:                      Number(u.id),
    rol_id:                  Number(u.rol_id),
    instrumento_principal_id: u.instrumento_principal_id ? Number(u.instrumento_principal_id) : null,
  };
}

const SELECT_USUARIO = `
  SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.created_at,
         u.dni, u.fecha_nacimiento, u.telefono, u.foto_path,
         u.instrumento_principal_id, u.formacion,
         r.id AS rol_id, r.nombre AS rol_nombre,
         ip.nombre AS instrumento_principal_nombre
  FROM   usuarios u
  JOIN   roles r  ON u.rol_id = r.id
  LEFT JOIN instrumentos ip ON ip.id = u.instrumento_principal_id
`;

// ── GET /api/usuarios/mencionables ────────────────────────────────────────────
// Lista liviana de usuarios activos de la institución para el picker de @menciones.
// Cualquier usuario autenticado puede pedirla (no requiere administrar_usuarios_roles).
// Debe ir ANTES de GET /:id para que Express no la interprete como un id.
router.get('/mencionables', verifyToken, async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: `SELECT u.id, u.nombre, u.apellido, r.nombre AS rol_nombre
            FROM usuarios u JOIN roles r ON r.id = u.rol_id
            WHERE u.institucion_id=? AND u.activo=1
            ORDER BY u.apellido, u.nombre`,
      args: [req.user.institucion_id],
    });
    res.json(rows.map(u => ({ ...u, id: Number(u.id) })));
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ── GET /api/usuarios ─────────────────────────────────────────────────────────
// ?inactivos=1  →  solo inactivos
// ?rol=Docente  →  filtrar por nombre de rol
router.get('/', ...admin, async (req, res) => {
  const soloInactivos = req.query.inactivos === '1';
  const rol           = req.query.rol || null;
  try {
    let where = 'WHERE u.institucion_id=? AND u.activo=?';
    const args = [req.user.institucion_id, soloInactivos ? 0 : 1];
    if (rol) { where += ' AND r.nombre=?'; args.push(rol); }

    const { rows: usuarios } = await db.execute({
      sql: `${SELECT_USUARIO} ${where} ORDER BY u.apellido, u.nombre`,
      args,
    });
    const result = await Promise.all(usuarios.map(async u => {
      const { rows: cursos } = await db.execute({
        sql: `SELECT c.id, c.nombre FROM usuarios_cursos uc JOIN cursos c ON uc.curso_id=c.id WHERE uc.usuario_id=? AND uc.materia_id IS NULL`,
        args: [u.id],
      });
      const { rows: insts } = await db.execute({
        sql: `SELECT ui.instrumento_id AS id, i.nombre FROM usuario_instrumentos ui JOIN instrumentos i ON i.id=ui.instrumento_id WHERE ui.usuario_id=? ORDER BY i.nombre`,
        args: [u.id],
      });
      return { ...rowToUsuario(u), cursos, instrumentos: insts.map(i => ({id:Number(i.id),nombre:i.nombre})) };
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ── GET /api/usuarios/:id — perfil completo ──────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const esPropio = req.user.id === id;
  const esAdmin  = req.user.permisos.includes('administrar_usuarios_roles') ||
                   req.user.permisos.includes('ver_equipo_docente');
  if (!esPropio && !esAdmin) return res.status(403).json({ error: 'Sin permiso' });
  try {
    const { rows } = await db.execute({
      sql: `${SELECT_USUARIO} WHERE u.id=? AND u.institucion_id=?`,
      args: [id, req.user.institucion_id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    const u = rows[0];
    const { rows: cursos } = await db.execute({
      sql: `SELECT c.id, c.nombre FROM usuarios_cursos uc JOIN cursos c ON uc.curso_id=c.id WHERE uc.usuario_id=? AND uc.materia_id IS NULL`,
      args: [id],
    });
    const { rows: insts } = await db.execute({
      sql: `SELECT ui.instrumento_id AS id, i.nombre FROM usuario_instrumentos ui JOIN instrumentos i ON i.id=ui.instrumento_id WHERE ui.usuario_id=? ORDER BY i.nombre`,
      args: [id],
    });
    res.json({ ...rowToUsuario(u), cursos, instrumentos: insts.map(i=>({id:Number(i.id),nombre:i.nombre})) });
  } catch(e) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// ── POST /api/usuarios/:id/reactivar ─────────────────────────────────────────
router.post('/:id/reactivar', ...admin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({ sql:'SELECT id,nombre FROM usuarios WHERE id=? AND institucion_id=? AND activo=0', args:[id,req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error:'Usuario inactivo no encontrado' });
    await db.execute({ sql:"UPDATE usuarios SET activo=1,updated_at=datetime('now') WHERE id=?", args:[id] });
    res.json({ ok:true, nombre:rows[0].nombre });
  } catch(e) { res.status(500).json({ error:'Error al reactivar usuario' }); }
});

// ── PUT /api/usuarios/:id/perfil — datos extendidos ─────────────────────────
router.put('/:id/perfil', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const esPropio = req.user.id === id;
  const esAdmin  = req.user.permisos.includes('administrar_usuarios_roles') ||
                   req.user.permisos.includes('editar_equipo_docente');
  if (!esPropio && !esAdmin) return res.status(403).json({ error: 'Sin permiso' });

  const { apellido, dni, fecha_nacimiento, telefono, instrumento_principal_id, instrumento_ids, formacion } = req.body;
  try {
    const { rows } = await db.execute({ sql:'SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1', args:[id, req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error:'Usuario no encontrado' });

    await db.execute({
      sql: `UPDATE usuarios SET apellido=?,dni=?,fecha_nacimiento=?,telefono=?,instrumento_principal_id=?,formacion=?,updated_at=datetime('now') WHERE id=?`,
      args: [apellido||null, dni||null, fecha_nacimiento||null, telefono||null, instrumento_principal_id||null, formacion||null, id],
    });
    if (Array.isArray(instrumento_ids)) {
      await db.execute({ sql:'DELETE FROM usuario_instrumentos WHERE usuario_id=?', args:[id] });
      for (const iid of instrumento_ids) {
        await db.execute({ sql:'INSERT OR IGNORE INTO usuario_instrumentos (usuario_id,instrumento_id) VALUES (?,?)', args:[id,Number(iid)] });
      }
    }
    res.json({ ok:true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error:'Error al actualizar perfil' });
  }
});

// ── POST /api/usuarios/:id/foto ──────────────────────────────────────────────
router.post('/:id/foto', verifyToken, upload.single('foto'), async (req, res) => {
  const id = Number(req.params.id);
  const esPropio = req.user.id === id;
  const esAdmin  = req.user.permisos.includes('administrar_usuarios_roles') ||
                   req.user.permisos.includes('editar_equipo_docente');
  if (!esPropio && !esAdmin) return res.status(403).json({ error:'Sin permiso' });
  if (!req.file) return res.status(400).json({ error:'Sin archivo' });
  try {
    const { rows } = await db.execute({ sql:'SELECT foto_path FROM usuarios WHERE id=?', args:[id] });
    if (rows[0]?.foto_path) {
      const old = path.join(__dirname, '..', ...rows[0].foto_path.split('/').filter(Boolean));
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const fotoPath = `/uploads/usuarios/${req.file.filename}`;
    await db.execute({ sql:"UPDATE usuarios SET foto_path=?,updated_at=datetime('now') WHERE id=?", args:[fotoPath,id] });
    res.json({ foto_path:fotoPath });
  } catch(e) { res.status(500).json({ error:'Error al subir foto' }); }
});

// ── POST /api/usuarios ────────────────────────────────────────────────────────
router.post('/', ...admin, async (req, res) => {
  const { nombre, apellido, email, password, rol_id, cursos } = req.body;
  if (!nombre?.trim() || !email?.trim() || !password || !rol_id)
    return res.status(400).json({ error:'Todos los campos son requeridos' });
  if (password.length < 6)
    return res.status(400).json({ error:'La contraseña debe tener al menos 6 caracteres' });
  try {
    const r = await db.execute({
      sql:'INSERT INTO usuarios (institucion_id,nombre,apellido,email,password_hash,rol_id) VALUES (?,?,?,?,?,?)',
      args:[req.user.institucion_id,nombre.trim(),apellido?.trim()||null,email.toLowerCase().trim(),bcrypt.hashSync(password,10),Number(rol_id)],
    });
    const userId = Number(r.lastInsertRowid);
    if (Array.isArray(cursos) && cursos.length > 0) {
      await db.batch(cursos.map(cid=>({sql:'INSERT INTO usuarios_cursos (usuario_id,curso_id) VALUES (?,?)',args:[userId,Number(cid)]})),'write');
    }
    res.status(201).json({ id:userId });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error:'El email ya está registrado' });
    res.status(500).json({ error:'Error al crear usuario' });
  }
});

// ── PUT /api/usuarios/:id ─────────────────────────────────────────────────────
router.put('/:id', ...admin, async (req, res) => {
  const { nombre, apellido, email, rol_id } = req.body;
  if (!nombre?.trim() || !email?.trim() || !rol_id)
    return res.status(400).json({ error:'Nombre, email y rol son requeridos' });
  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({ sql:'SELECT id,rol_id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1', args:[id,req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error:'Usuario no encontrado' });
    const nuevoRolId = Number(rol_id);
    if (nuevoRolId !== Number(rows[0].rol_id)) {
      const { rows: rr } = await db.execute({ sql:`SELECT 1 FROM roles_permisos rp JOIN permisos p ON rp.permiso_id=p.id WHERE rp.rol_id=? AND p.codigo='administrar_usuarios_roles'`, args:[nuevoRolId] });
      if (!rr[0] && !(await hayOtroAdmin(id))) return res.status(409).json({ error:'Este cambio dejaría el sistema sin administrador.' });
    }
    await db.execute({
      sql:`UPDATE usuarios SET nombre=?,apellido=?,email=?,rol_id=?,updated_at=datetime('now') WHERE id=?`,
      args:[nombre.trim(),apellido?.trim()||null,email.toLowerCase().trim(),nuevoRolId,id],
    });
    res.json({ success:true });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error:'El email ya está registrado' });
    res.status(500).json({ error:'Error al actualizar usuario' });
  }
});

// ── PUT /api/usuarios/:id/password ───────────────────────────────────────────
router.put('/:id/password', ...admin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error:'Mínimo 6 caracteres' });
  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({ sql:'SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1', args:[id,req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error:'Usuario no encontrado' });
    await db.execute({ sql:"UPDATE usuarios SET password_hash=?,updated_at=datetime('now') WHERE id=?", args:[bcrypt.hashSync(password,10),id] });
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'Error al cambiar contraseña' }); }
});

// ── PUT /api/usuarios/:id/cursos ─────────────────────────────────────────────
router.put('/:id/cursos', ...admin, async (req, res) => {
  const { cursos } = req.body;
  const id = Number(req.params.id);
  try {
    const { rows } = await db.execute({ sql:'SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1', args:[id,req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error:'Usuario no encontrado' });
    const stmts = [{sql:'DELETE FROM usuarios_cursos WHERE usuario_id=? AND materia_id IS NULL',args:[id]}];
    if (Array.isArray(cursos)) cursos.forEach(cid=>stmts.push({sql:'INSERT INTO usuarios_cursos (usuario_id,curso_id) VALUES (?,?)',args:[id,Number(cid)]}));
    await db.batch(stmts,'write');
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'Error al actualizar cursos' }); }
});

// ── DELETE /api/usuarios/:id ─────────────────────────────────────────────────
router.delete('/:id', ...admin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(409).json({ error:'No podés dar de baja tu propia cuenta' });
  try {
    const { rows } = await db.execute({ sql:'SELECT id FROM usuarios WHERE id=? AND institucion_id=? AND activo=1', args:[id,req.user.institucion_id] });
    if (!rows[0]) return res.status(404).json({ error:'Usuario no encontrado' });
    if (!(await hayOtroAdmin(id))) return res.status(409).json({ error:'Único administrador, no se puede eliminar.' });
    await db.execute({ sql:"UPDATE usuarios SET activo=0,updated_at=datetime('now') WHERE id=?", args:[id] });
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'Error al dar de baja usuario' }); }
});

module.exports = router;
