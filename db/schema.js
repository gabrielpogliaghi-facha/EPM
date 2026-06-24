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
  // Un estudiante puede estar en varios cursos pero solo uno por instrumento.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS inscripciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      curso_id       INTEGER NOT NULL REFERENCES cursos(id),
      instrumento_id INTEGER NOT NULL REFERENCES instrumentos(id),
      activo         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(estudiante_id, instrumento_id)
    )
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

  // ── EQUIPO DOCENTE ─────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS docentes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id       INTEGER UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      institucion_id   INTEGER NOT NULL REFERENCES instituciones(id),
      dni              TEXT,
      fecha_nacimiento TEXT,
      telefono         TEXT,
      formacion        TEXT,
      foto_path        TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS docente_instrumentos (
      docente_id     INTEGER NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
      instrumento_id INTEGER NOT NULL REFERENCES instrumentos(id),
      PRIMARY KEY (docente_id, instrumento_id)
    )
  `);

  // ── INVENTARIO DE INSTRUMENTOS ────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS inventario (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      nombre         TEXT NOT NULL,
      instrumento_id INTEGER REFERENCES instrumentos(id),
      estado         TEXT NOT NULL DEFAULT 'disponible' CHECK(estado IN ('disponible','en_uso','en_reparacion','baja')),
      asignado_tipo  TEXT,
      asignado_id    INTEGER,
      numero_serie   TEXT,
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invitaciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL REFERENCES instituciones(id),
      email          TEXT NOT NULL,
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
}

module.exports = { runSchema };
