async function runSchema(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS instituciones (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT NOT NULL,
      tipo        TEXT NOT NULL DEFAULT 'primaria' CHECK(tipo IN ('primaria','secundaria','otro')),
      config_json TEXT DEFAULT '{}',
      activo      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS cursos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      descripcion    TEXT,
      color          TEXT DEFAULT '#6366f1',
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(institucion_id, nombre)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS materias (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      descripcion    TEXT,
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      descripcion    TEXT,
      es_sistema     INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS permisos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo      TEXT UNIQUE NOT NULL,
      descripcion TEXT NOT NULL,
      grupo       TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS roles_permisos (
      rol_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permiso_id INTEGER NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
      PRIMARY KEY (rol_id, permiso_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      email          TEXT UNIQUE NOT NULL,
      password_hash  TEXT NOT NULL,
      rol_id         INTEGER NOT NULL REFERENCES roles(id),
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios_cursos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      curso_id   INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
      materia_id INTEGER REFERENCES materias(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ucursos_general
      ON usuarios_cursos(usuario_id, curso_id) WHERE materia_id IS NULL
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ucursos_materia
      ON usuarios_cursos(usuario_id, curso_id, materia_id) WHERE materia_id IS NOT NULL
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS estudiantes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id   INTEGER NOT NULL REFERENCES instituciones(id),
      curso_id         INTEGER REFERENCES cursos(id),
      nombre           TEXT NOT NULL,
      apellido         TEXT NOT NULL,
      dni              TEXT NOT NULL,
      cuit             TEXT,
      fecha_nacimiento TEXT,
      tutor_nombre     TEXT,
      tutor_dni        TEXT,
      direccion        TEXT,
      foto_path        TEXT,
      auth_imagen      INTEGER DEFAULT 0,
      auth_general     INTEGER DEFAULT 0,
      auth_boleto      INTEGER DEFAULT 0,
      activo           INTEGER DEFAULT 1,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now')),
      UNIQUE(dni, institucion_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios_estudiantes (
      usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      relacion      TEXT DEFAULT 'tutor',
      PRIMARY KEY (usuario_id, estudiante_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ciclos_lectivos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      anio           INTEGER NOT NULL,
      fecha_inicio   TEXT NOT NULL,
      fecha_fin      TEXT NOT NULL,
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS semestres (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      ciclo_lectivo_id INTEGER NOT NULL REFERENCES ciclos_lectivos(id) ON DELETE CASCADE,
      nombre           TEXT NOT NULL,
      numero           INTEGER NOT NULL CHECK(numero IN (1,2)),
      fecha_inicio     TEXT NOT NULL,
      fecha_fin        TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS periodos_planificacion (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      fecha_inicio   TEXT NOT NULL,
      fecha_fin      TEXT NOT NULL,
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS planificaciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      curso_id       INTEGER NOT NULL REFERENCES cursos(id),
      docente_id     INTEGER NOT NULL REFERENCES usuarios(id),
      periodo_id     INTEGER REFERENCES periodos_planificacion(id),
      materia_id     INTEGER REFERENCES materias(id),
      titulo         TEXT,
      descripcion    TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS planificacion_contenidos (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      planificacion_id INTEGER NOT NULL REFERENCES planificaciones(id) ON DELETE CASCADE,
      titulo           TEXT NOT NULL,
      descripcion      TEXT,
      orden            INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS asistencias (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id   INTEGER NOT NULL REFERENCES instituciones(id),
      estudiante_id    INTEGER NOT NULL REFERENCES estudiantes(id),
      curso_id         INTEGER NOT NULL REFERENCES cursos(id),
      fecha            TEXT NOT NULL,
      estado           TEXT NOT NULL CHECK(estado IN ('presente','ausente','tarde')),
      observacion      TEXT,
      tipo_asistencia  TEXT NOT NULL DEFAULT 'general' CHECK(tipo_asistencia IN ('general','materia')),
      materia_id       INTEGER REFERENCES materias(id),
      registrado_por   INTEGER REFERENCES usuarios(id),
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_asis_general
      ON asistencias(estudiante_id, fecha) WHERE tipo_asistencia = 'general'
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_asis_materia
      ON asistencias(estudiante_id, fecha, materia_id) WHERE tipo_asistencia = 'materia'
  `);

  // ── INSTRUMENTOS ───────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS instrumentos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(institucion_id, nombre)
    )
  `);

  // ── INSCRIPCIONES (estudiante ↔ curso ↔ instrumento) ─────────────────────
  // Un estudiante puede estar en varios cursos, y puede repetir el mismo instrumento
  // en niveles distintos (ej: Mojarrita de Guitarra Y Delfín de Guitarra a la vez).
  // Lo único que no puede repetirse es la MISMA inscripción activa (estudiante+instrumento+curso).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS inscripciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      curso_id       INTEGER NOT NULL REFERENCES cursos(id),
      instrumento_id INTEGER NOT NULL REFERENCES instrumentos(id),
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── MIGRACIÓN: reemplazar UNIQUE(estudiante_id, instrumento_id) por un índice
  // único parcial (solo entre inscripciones ACTIVAS) que además incluye curso_id.
  // Esto permite: (a) re-agregar un instrumento después de borrar (soft delete) la
  // inscripción anterior, y (b) tener el mismo instrumento en dos niveles a la vez.
  // SQLite no soporta ALTER TABLE para quitar un UNIQUE inline, hay que recrear la tabla.
  try {
    const { rows: schRows } = await db.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='inscripciones'",
      args: [],
    });
    if (schRows.length > 0 && schRows[0].sql && /UNIQUE\s*\(\s*estudiante_id\s*,\s*instrumento_id\s*\)/i.test(schRows[0].sql)) {
      console.log('🔄 Migrando inscripciones: UNIQUE(estudiante,instrumento) → índice único parcial por (estudiante,instrumento,curso) activo...');
      await db.execute(`ALTER TABLE inscripciones RENAME TO inscripciones_pre_multinivel`);
      await db.execute(`
        CREATE TABLE inscripciones (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
          curso_id       INTEGER NOT NULL REFERENCES cursos(id),
          instrumento_id INTEGER NOT NULL REFERENCES instrumentos(id),
          activo         INTEGER DEFAULT 1,
          created_at     TEXT DEFAULT (datetime('now')),
          updated_at     TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.execute(`INSERT INTO inscripciones SELECT * FROM inscripciones_pre_multinivel`);
      await db.execute(`DROP TABLE inscripciones_pre_multinivel`);
      console.log('✅ Migración inscripciones completada.');
    }
  } catch(e) { console.error('❌ Error en migración inscripciones:', e.message); }

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inscripciones_activa
      ON inscripciones(estudiante_id, instrumento_id, curso_id) WHERE activo = 1
  `);

  // ── HISTORIAL DE PROGRESIÓN (preparado para futuro, sin UI aún) ──────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS historial_inscripciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id),
      instrumento_id INTEGER NOT NULL REFERENCES instrumentos(id),
      curso_id_prev  INTEGER REFERENCES cursos(id),
      curso_id_nuevo INTEGER NOT NULL REFERENCES cursos(id),
      fecha_cambio   TEXT DEFAULT (datetime('now')),
      registrado_por INTEGER REFERENCES usuarios(id),
      notas          TEXT
    )
  `);

  // ── LEGAJO PERSONAL ────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS legajo_personal (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id            INTEGER UNIQUE NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      composicion_familiar     TEXT,
      emergencia_nombre        TEXT,
      emergencia_telefono      TEXT,
      obra_social              TEXT,
      alergias                 TEXT,
      medicacion               TEXT,
      condiciones_salud        TEXT,
      instituciones_anteriores TEXT,
      updated_at               TEXT DEFAULT (datetime('now')),
      updated_by               INTEGER REFERENCES usuarios(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS legajo_salud_historial (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      fecha          TEXT NOT NULL,
      descripcion    TEXT NOT NULL,
      registrado_por INTEGER REFERENCES usuarios(id),
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS legajo_trayectoria_historial (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      fecha          TEXT NOT NULL,
      descripcion    TEXT NOT NULL,
      registrado_por INTEGER REFERENCES usuarios(id),
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS legajo_observaciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      fecha          TEXT NOT NULL,
      descripcion    TEXT NOT NULL,
      registrado_por INTEGER REFERENCES usuarios(id),
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── RECUPERACIÓN DE CONTRASEÑA ────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used       INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── EVENTOS ───────────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS eventos (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id       INTEGER NOT NULL REFERENCES instituciones(id),
      titulo               TEXT NOT NULL,
      descripcion          TEXT,
      fecha                TEXT NOT NULL,
      hora_inicio          TEXT,
      hora_fin             TEXT,
      lugar                TEXT,
      tipo                 TEXT NOT NULL DEFAULT 'otro' CHECK(tipo IN ('muestra','feriado','reunion','ensayo','salida','festival','otro')),
      alcance              TEXT NOT NULL DEFAULT 'institucion' CHECK(alcance IN ('institucion','cursos')),
      estado               TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo','cancelado','reprogramado')),
      motivo_cambio        TEXT,
      fecha_original       TEXT,
      hora_inicio_original TEXT,
      created_by           INTEGER NOT NULL REFERENCES usuarios(id),
      created_at           TEXT DEFAULT (datetime('now')),
      updated_at           TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(institucion_id, fecha)`);

  // ── MIGRACIÓN: agregar 'festival' al CHECK de eventos.tipo ────────────────
  // SQLite no soporta ALTER TABLE para cambiar CHECK constraints, hay que
  // recrear la tabla usando RENAME (safe, no borra datos de evento_cursos).
  try {
    const { rows: schRows } = await db.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='eventos'",
      args: [],
    });
    if (schRows.length > 0 && schRows[0].sql && !schRows[0].sql.includes("'festival'")) {
      console.log('🔄 Migrando eventos.tipo para incluir festival...');
      await db.execute(`ALTER TABLE eventos RENAME TO eventos_pre_festival`);
      await db.execute(`
        CREATE TABLE eventos (
          id                   INTEGER PRIMARY KEY AUTOINCREMENT,
          institucion_id       INTEGER NOT NULL REFERENCES instituciones(id),
          titulo               TEXT NOT NULL,
          descripcion          TEXT,
          fecha                TEXT NOT NULL,
          hora_inicio          TEXT,
          hora_fin             TEXT,
          lugar                TEXT,
          tipo                 TEXT NOT NULL DEFAULT 'otro' CHECK(tipo IN ('muestra','feriado','reunion','ensayo','salida','festival','otro')),
          alcance              TEXT NOT NULL DEFAULT 'institucion' CHECK(alcance IN ('institucion','cursos')),
          estado               TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo','cancelado','reprogramado')),
          motivo_cambio        TEXT,
          fecha_original       TEXT,
          hora_inicio_original TEXT,
          created_by           INTEGER NOT NULL REFERENCES usuarios(id),
          created_at           TEXT DEFAULT (datetime('now')),
          updated_at           TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.execute(`INSERT INTO eventos SELECT * FROM eventos_pre_festival`);
      await db.execute(`DROP TABLE eventos_pre_festival`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(institucion_id, fecha)`);
      console.log('✅ Migración eventos.tipo completada.');
    }
  } catch(e) {
    console.error('❌ Error en migración eventos.tipo:', e.message);
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS evento_cursos (
      evento_id  INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      curso_id   INTEGER NOT NULL REFERENCES cursos(id),
      PRIMARY KEY (evento_id, curso_id)
    )
  `);

  // ── NOTIFICACIONES ────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      titulo       TEXT NOT NULL,
      mensaje      TEXT NOT NULL,
      tipo         TEXT NOT NULL DEFAULT 'info' CHECK(tipo IN ('info','warning','success','danger')),
      entidad_tipo TEXT,
      entidad_id   INTEGER,
      leida        INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones(usuario_id, leida)`);

  // ── MIGRACIÓN PERMISOS legajo personal (idempotente para DBs existentes) ──
  for (const p of [
    { codigo:'ver_legajo_personal',    descripcion:'Ver legajo personal de estudiantes',    grupo:'estudiantes' },
    { codigo:'editar_legajo_personal', descripcion:'Editar legajo personal de estudiantes', grupo:'estudiantes' },
  ]) {
    try {
      await db.execute({ sql:'INSERT OR IGNORE INTO permisos (codigo, descripcion, grupo) VALUES (?,?,?)', args:[p.codigo, p.descripcion, p.grupo] });
    } catch(e) {}
  }
  try {
    await db.execute(`INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id FROM roles r, permisos p
      WHERE r.nombre IN ('Gestión','Docente')
        AND p.codigo IN ('ver_legajo_personal','editar_legajo_personal')`);
  } catch(e) {}

  // ── MIGRACIÓN PERMISOS calendario (idempotente para DBs existentes) ───────
  for (const p of [
    { codigo:'ver_calendario',  descripcion:'Ver calendario de eventos',             grupo:'calendario' },
    { codigo:'crear_eventos',   descripcion:'Crear eventos en el calendario',         grupo:'calendario' },
    { codigo:'editar_eventos',  descripcion:'Editar, cancelar y reprogramar eventos', grupo:'calendario' },
  ]) {
    try {
      await db.execute({ sql:'INSERT OR IGNORE INTO permisos (codigo, descripcion, grupo) VALUES (?,?,?)', args:[p.codigo, p.descripcion, p.grupo] });
    } catch(e) {}
  }
  try {
    await db.execute(`INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id FROM roles r, permisos p
      WHERE r.nombre IN ('Gestión','Operador')
        AND p.codigo IN ('ver_calendario','crear_eventos','editar_eventos')`);
  } catch(e) {}
  try {
    await db.execute(`INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id FROM roles r, permisos p
      WHERE r.nombre = 'Docente'
        AND p.codigo = 'ver_calendario'`);
  } catch(e) {}

  // ── PERFIL EXTENDIDO EN USUARIOS (unificado con el antiguo Equipo Docente) ──
  // Agrega columnas de perfil directamente a usuarios (idempotente, ignora "column exists")
  for (const [col, type] of [
    ['apellido',                 'TEXT'],
    ['dni',                      'TEXT'],
    ['fecha_nacimiento',         'TEXT'],
    ['telefono',                 'TEXT'],
    ['foto_path',                'TEXT'],
    ['instrumento_principal_id', 'INTEGER'],
    ['formacion',                'TEXT'],
    ['tour_completado',          'INTEGER DEFAULT 0'],
  ]) {
    try { await db.execute(`ALTER TABLE usuarios ADD COLUMN ${col} ${type}`); } catch(e) {}
  }

  // Tabla de instrumentos de usuario (reemplaza docente_instrumentos)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuario_instrumentos (
      usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      instrumento_id INTEGER NOT NULL REFERENCES instrumentos(id),
      PRIMARY KEY (usuario_id, instrumento_id)
    )
  `);

  // Migración: mover datos de docentes/docente_instrumentos a usuarios/usuario_instrumentos
  try {
    const { rows: docCheck } = await db.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='docentes'", args: []
    });
    if (docCheck.length > 0) {
      // La tabla docentes puede venir de una versión anterior sin esta columna (idempotente)
      try { await db.execute(`ALTER TABLE docentes ADD COLUMN instrumento_principal_id INTEGER`); } catch(e) {}

      // Copiar campos de perfil de docentes → usuarios
      await db.execute(`
        UPDATE usuarios SET
          dni                      = COALESCE(dni,      (SELECT d.dni      FROM docentes d WHERE d.usuario_id=usuarios.id)),
          fecha_nacimiento         = COALESCE(fecha_nacimiento, (SELECT d.fecha_nacimiento FROM docentes d WHERE d.usuario_id=usuarios.id)),
          telefono                 = COALESCE(telefono, (SELECT d.telefono FROM docentes d WHERE d.usuario_id=usuarios.id)),
          foto_path                = COALESCE(foto_path,(SELECT d.foto_path FROM docentes d WHERE d.usuario_id=usuarios.id)),
          instrumento_principal_id = COALESCE(instrumento_principal_id,(SELECT d.instrumento_principal_id FROM docentes d WHERE d.usuario_id=usuarios.id)),
          formacion                = COALESCE(formacion,(SELECT d.formacion FROM docentes d WHERE d.usuario_id=usuarios.id))
        WHERE EXISTS (SELECT 1 FROM docentes d WHERE d.usuario_id=usuarios.id)
      `);
      // Copiar instrumentos docente_instrumentos → usuario_instrumentos
      try {
        await db.execute(`
          INSERT OR IGNORE INTO usuario_instrumentos (usuario_id, instrumento_id)
          SELECT d.usuario_id, di.instrumento_id
          FROM docente_instrumentos di JOIN docentes d ON d.id=di.docente_id
        `);
        await db.execute(`DROP TABLE IF EXISTS docente_instrumentos`);
      } catch(e) {}
      await db.execute(`DROP TABLE IF EXISTS docentes`);
      console.log('✅ Migración: docentes → usuarios (perfil unificado).');
    }
  } catch(e) { console.error('❌ Migración docentes→usuarios:', e.message); }

  // ── LEGACY (tablas antiguas en caso de que no se hayan podido eliminar) ──────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS docentes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id       INTEGER UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      institucion_id   INTEGER NOT NULL REFERENCES instituciones(id),
      dni              TEXT, fecha_nacimiento TEXT, telefono TEXT,
      formacion TEXT, foto_path TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS docente_instrumentos (
      docente_id INTEGER NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
      instrumento_id INTEGER NOT NULL REFERENCES instrumentos(id),
      PRIMARY KEY (docente_id, instrumento_id)
    )
  `);

  // ── INVENTARIO DE INSTRUMENTOS ────────────────────────────────────────────
  // asignado_tipo: 'estudiante' | 'usuario' (a quién se prestó, solo si estado='a_prestamo')
  await db.execute(`
    CREATE TABLE IF NOT EXISTS inventario (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      instrumento_id INTEGER REFERENCES instrumentos(id),
      estado         TEXT NOT NULL DEFAULT 'disponible' CHECK(estado IN ('disponible','en_uso','a_reparar','a_prestamo','en_reparacion','baja')),
      asignado_tipo  TEXT,
      asignado_id    INTEGER,
      numero_serie   TEXT,
      tiene_funda    INTEGER DEFAULT 0,
      tiene_correa   INTEGER DEFAULT 0,
      reparacion_fecha_envio   TEXT,
      reparacion_lugar         TEXT,
      reparacion_telefono      TEXT,
      reparacion_observaciones TEXT,
      observaciones  TEXT,
      fecha_alta     TEXT DEFAULT (date('now')),
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── PROYECTOS ─────────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS proyectos (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id     INTEGER NOT NULL REFERENCES instituciones(id),
      titulo             TEXT NOT NULL,
      descripcion        TEXT,
      estado             TEXT NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador','en_curso','presentado','aprobado','rechazado','finalizado')),
      fecha_presentacion TEXT,
      destino            TEXT,
      created_by         INTEGER NOT NULL REFERENCES usuarios(id),
      created_at         TEXT DEFAULT (datetime('now')),
      updated_at         TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS proyecto_historial (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id    INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      estado         TEXT NOT NULL,
      nota           TEXT,
      registrado_por INTEGER REFERENCES usuarios(id),
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS proyecto_adjuntos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      nombre      TEXT NOT NULL,
      path        TEXT NOT NULL,
      mime_type   TEXT,
      created_by  INTEGER REFERENCES usuarios(id),
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── FINANZAS (estructura preparada, módulo pendiente) ─────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categorias_financieras (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      tipo           TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS movimientos_financieros (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id   INTEGER NOT NULL REFERENCES instituciones(id),
      fecha            TEXT NOT NULL,
      concepto         TEXT NOT NULL,
      tipo             TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
      monto            REAL NOT NULL,
      categoria_id     INTEGER REFERENCES categorias_financieras(id),
      comprobante_path TEXT,
      notas            TEXT,
      registrado_por   INTEGER NOT NULL REFERENCES usuarios(id),
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_mov_fin ON movimientos_financieros(institucion_id, fecha)`);

  // ── INVITACIONES ──────────────────────────────────────────────────────────
  // email nullable: las invitaciones por link no requieren email previo
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invitaciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      email          TEXT,
      nota           TEXT,
      rol_id         INTEGER NOT NULL REFERENCES roles(id),
      token_hash     TEXT NOT NULL UNIQUE,
      estado         TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aceptada','expirada','cancelada')),
      expires_at     TEXT NOT NULL,
      cursos_ids     TEXT DEFAULT '[]',
      created_by     INTEGER NOT NULL REFERENCES usuarios(id),
      accepted_by    INTEGER REFERENCES usuarios(id),
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_invit ON invitaciones(institucion_id, estado)`);

  // Migración: hacer email nullable y agregar nota (para DBs existentes)
  try {
    const { rows: schRows } = await db.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='invitaciones'",
      args: [],
    });
    const sql = schRows[0]?.sql || '';
    if (sql.includes('email          TEXT NOT NULL')) {
      await db.execute(`ALTER TABLE invitaciones RENAME TO invitaciones_pre_link`);
      await db.execute(`
        CREATE TABLE invitaciones (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
          email          TEXT,
          nota           TEXT,
          rol_id         INTEGER NOT NULL REFERENCES roles(id),
          token_hash     TEXT NOT NULL UNIQUE,
          estado         TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aceptada','expirada','cancelada')),
          expires_at     TEXT NOT NULL,
          cursos_ids     TEXT DEFAULT '[]',
          created_by     INTEGER NOT NULL REFERENCES usuarios(id),
          accepted_by    INTEGER REFERENCES usuarios(id),
          created_at     TEXT DEFAULT (datetime('now')),
          updated_at     TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.execute(`INSERT INTO invitaciones SELECT id,institucion_id,email,NULL,rol_id,token_hash,estado,expires_at,cursos_ids,created_by,accepted_by,created_at,updated_at FROM invitaciones_pre_link`);
      await db.execute(`DROP TABLE invitaciones_pre_link`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_invit ON invitaciones(institucion_id, estado)`);
      console.log('✅ Migración invitaciones: email nullable + campo nota.');
    }
  } catch(e) { console.error('❌ Migración invitaciones:', e.message); }

  // (instrumento_principal_id ya se agrega en el bloque de perfil extendido arriba)

  // ── MIGRACIÓN PERMISOS módulos nuevos (idempotente) ───────────────────────
  const permsNuevos = [
    { codigo:'ver_equipo_docente',   descripcion:'Ver equipo docente',               grupo:'equipo_docente' },
    { codigo:'editar_equipo_docente',descripcion:'Editar fichas del equipo docente',  grupo:'equipo_docente' },
    { codigo:'ver_inventario',       descripcion:'Ver inventario de instrumentos',    grupo:'inventario'     },
    { codigo:'editar_inventario',    descripcion:'Gestionar inventario',              grupo:'inventario'     },
    { codigo:'ver_proyectos',        descripcion:'Ver proyectos institucionales',     grupo:'proyectos'      },
    { codigo:'editar_proyectos',     descripcion:'Crear y editar proyectos',          grupo:'proyectos'      },
    { codigo:'ver_finanzas',         descripcion:'Ver movimientos financieros',       grupo:'finanzas'       },
    { codigo:'editar_finanzas',      descripcion:'Cargar movimientos financieros',    grupo:'finanzas'       },
    { codigo:'administrar_finanzas', descripcion:'Administrar finanzas y categorías', grupo:'finanzas'       },
  ];
  for (const p of permsNuevos) {
    try { await db.execute({ sql:'INSERT OR IGNORE INTO permisos (codigo, descripcion, grupo) VALUES (?,?,?)', args:[p.codigo, p.descripcion, p.grupo] }); } catch(e) {}
  }
  try {
    await db.execute(`INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id FROM roles r, permisos p
      WHERE r.nombre='Gestión'
        AND p.codigo IN ('ver_equipo_docente','editar_equipo_docente','ver_inventario','editar_inventario','ver_proyectos','editar_proyectos','ver_finanzas','editar_finanzas','administrar_finanzas')`);
  } catch(e) {}
  try {
    await db.execute(`INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id FROM roles r, permisos p
      WHERE r.nombre='Operador'
        AND p.codigo IN ('ver_equipo_docente','ver_inventario','editar_inventario','ver_proyectos','editar_proyectos','ver_finanzas','editar_finanzas')`);
  } catch(e) {}
  try {
    await db.execute(`INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id FROM roles r, permisos p
      WHERE r.nombre='Docente'
        AND p.codigo IN ('ver_equipo_docente','ver_proyectos','ver_finanzas')`);
  } catch(e) {}

  // ── REUNIONES ─────────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reuniones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      fecha          TEXT NOT NULL,
      hora           TEXT,
      motivo         TEXT NOT NULL,
      resumen        TEXT,
      created_by     INTEGER NOT NULL REFERENCES usuarios(id),
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_reuniones_fecha ON reuniones(institucion_id, fecha)`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reunion_participantes (
      reunion_id INTEGER NOT NULL REFERENCES reuniones(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      PRIMARY KEY (reunion_id, usuario_id)
    )
  `);

  // ── MIGRACIÓN ESTUDIANTES: teléfono propio y teléfono del tutor ───────────
  for (const col of ['telefono', 'tutor_telefono']) {
    try { await db.execute(`ALTER TABLE estudiantes ADD COLUMN ${col} TEXT`); } catch(e) {}
  }

  // ── MIGRACIÓN EVENTOS: fecha_fin para eventos multi-día ───────────────────
  try { await db.execute(`ALTER TABLE eventos ADD COLUMN fecha_fin TEXT`); } catch(e) {}
  // Backfill: eventos existentes sin fecha_fin duran 1 solo día
  try { await db.execute(`UPDATE eventos SET fecha_fin = fecha WHERE fecha_fin IS NULL`); } catch(e) {}

  // ── MIGRACIÓN INSTRUMENTOS: agregar Teclado y Chancha si faltan ───────────
  try {
    const { rows: instituciones } = await db.execute('SELECT id FROM instituciones');
    for (const inst of instituciones) {
      for (const nombre of ['Teclado', 'Chancha']) {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO instrumentos (institucion_id, nombre) VALUES (?,?)',
          args: [inst.id, nombre],
        });
      }
    }
  } catch(e) { console.error('❌ Migración instrumentos Teclado/Chancha:', e.message); }

  // ── MIGRACIÓN INSTRUMENTOS: "Guitarra" genérico → Criolla/Eléctrica ──────
  // Renombra el registro existente (preserva su id → no rompe inscripciones/inventario
  // que ya lo referenciaban) y agrega "Guitarra Eléctrica" como tipo nuevo.
  try {
    const { rows: instituciones } = await db.execute('SELECT id FROM instituciones');
    for (const inst of instituciones) {
      await db.execute({
        sql: `UPDATE instrumentos SET nombre='Guitarra Criolla' WHERE institucion_id=? AND nombre='Guitarra'`,
        args: [inst.id],
      });
      await db.execute({
        sql: 'INSERT OR IGNORE INTO instrumentos (institucion_id, nombre) VALUES (?, ?)',
        args: [inst.id, 'Guitarra Eléctrica'],
      });
    }
  } catch(e) { console.error('❌ Migración Guitarra Criolla/Eléctrica:', e.message); }

  // ── MIGRACIÓN INVENTARIO: nuevos estados (a_reparar/a_prestamo) + campos
  // (funda/correa/datos de reparación). CHECK inline requiere recrear la tabla.
  try {
    const { rows: schRows } = await db.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='inventario'",
      args: [],
    });
    if (schRows.length > 0 && schRows[0].sql && !/tiene_funda/i.test(schRows[0].sql)) {
      console.log('🔄 Migrando inventario: nuevos estados + campos de funda/correa/reparación...');
      await db.execute(`ALTER TABLE inventario RENAME TO inventario_pre_v2`);
      await db.execute(`
        CREATE TABLE inventario (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
          nombre         TEXT NOT NULL,
          instrumento_id INTEGER REFERENCES instrumentos(id),
          estado         TEXT NOT NULL DEFAULT 'disponible' CHECK(estado IN ('disponible','en_uso','a_reparar','a_prestamo','en_reparacion','baja')),
          asignado_tipo  TEXT,
          asignado_id    INTEGER,
          numero_serie   TEXT,
          tiene_funda    INTEGER DEFAULT 0,
          tiene_correa   INTEGER DEFAULT 0,
          reparacion_fecha_envio   TEXT,
          reparacion_lugar         TEXT,
          reparacion_telefono      TEXT,
          reparacion_observaciones TEXT,
          observaciones  TEXT,
          fecha_alta     TEXT DEFAULT (date('now')),
          created_at     TEXT DEFAULT (datetime('now')),
          updated_at     TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.execute(`
        INSERT INTO inventario (id,institucion_id,nombre,instrumento_id,estado,asignado_tipo,asignado_id,numero_serie,observaciones,fecha_alta,created_at,updated_at)
        SELECT id,institucion_id,nombre,instrumento_id,estado,
               CASE WHEN asignado_tipo='docente' THEN 'usuario' ELSE asignado_tipo END,
               asignado_id,numero_serie,observaciones,fecha_alta,created_at,updated_at
        FROM inventario_pre_v2
      `);
      await db.execute(`DROP TABLE inventario_pre_v2`);
      console.log('✅ Migración inventario completada.');
    }
  } catch(e) { console.error('❌ Error en migración inventario:', e.message); }

  // ── MIGRACIÓN PERMISOS reuniones (idempotente) ────────────────────────────
  for (const p of [
    { codigo:'ver_reuniones',    descripcion:'Ver registro de reuniones',        grupo:'reuniones' },
    { codigo:'crear_reuniones',  descripcion:'Crear reuniones',                  grupo:'reuniones' },
    { codigo:'editar_reuniones', descripcion:'Editar cualquier reunión',         grupo:'reuniones' },
  ]) {
    try { await db.execute({ sql:'INSERT OR IGNORE INTO permisos (codigo, descripcion, grupo) VALUES (?,?,?)', args:[p.codigo, p.descripcion, p.grupo] }); } catch(e) {}
  }
  try {
    await db.execute(`INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id FROM roles r, permisos p
      WHERE r.nombre IN ('Gestión','Operador')
        AND p.codigo IN ('ver_reuniones','crear_reuniones','editar_reuniones')`);
  } catch(e) {}
  try {
    await db.execute(`INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id FROM roles r, permisos p
      WHERE r.nombre='Docente'
        AND p.codigo IN ('ver_reuniones','crear_reuniones')`);
  } catch(e) {}
}

module.exports = { runSchema };
