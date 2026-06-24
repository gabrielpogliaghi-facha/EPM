const bcrypt = require('bcryptjs');

const PERMISOS = [
  { codigo: 'ver_estudiantes',            descripcion: 'Ver fichas de estudiantes',         grupo: 'estudiantes'    },
  { codigo: 'crear_estudiantes',          descripcion: 'Crear nuevos estudiantes',           grupo: 'estudiantes'    },
  { codigo: 'editar_estudiantes',         descripcion: 'Editar datos de estudiantes',        grupo: 'estudiantes'    },
  { codigo: 'ver_asistencias',            descripcion: 'Ver registros de asistencia',        grupo: 'asistencias'    },
  { codigo: 'cargar_asistencias',         descripcion: 'Cargar asistencias',                 grupo: 'asistencias'    },
  { codigo: 'justificar_ausencias',       descripcion: 'Justificar o editar ausencias',      grupo: 'asistencias'    },
  { codigo: 'ver_reportes',               descripcion: 'Ver reportes',                       grupo: 'reportes'       },
  { codigo: 'editar_reportes',            descripcion: 'Editar y generar reportes',          grupo: 'reportes'       },
  { codigo: 'ver_planificaciones',        descripcion: 'Ver planificaciones de contenidos',  grupo: 'planificaciones'},
  { codigo: 'editar_planificaciones',     descripcion: 'Crear y editar planificaciones',     grupo: 'planificaciones'},
  { codigo: 'administrar_usuarios_roles', descripcion: 'Administrar usuarios y roles',       grupo: 'administracion' },
  { codigo: 'administrar_cursos',         descripcion: 'Administrar cursos',                 grupo: 'administracion' },
  { codigo: 'acceder_backup',             descripcion: 'Acceder a backup del sistema',       grupo: 'administracion' },
  { codigo: 'ver_legajo_personal',        descripcion: 'Ver legajo personal de estudiantes',    grupo: 'estudiantes' },
  { codigo: 'editar_legajo_personal',     descripcion: 'Editar legajo personal de estudiantes', grupo: 'estudiantes' },
  { codigo: 'ver_calendario',             descripcion: 'Ver calendario de eventos',              grupo: 'calendario'  },
  { codigo: 'crear_eventos',              descripcion: 'Crear eventos en el calendario',          grupo: 'calendario'  },
  { codigo: 'editar_eventos',             descripcion: 'Editar, cancelar y reprogramar eventos',  grupo: 'calendario'  },
];

const ROL_OPERADOR = ['ver_estudiantes','crear_estudiantes','editar_estudiantes',
                      'ver_asistencias','cargar_asistencias','justificar_ausencias',
                      'ver_reportes','editar_reportes','administrar_cursos',
                      'ver_calendario','crear_eventos','editar_eventos'];
const ROL_DOCENTE  = ['ver_estudiantes','ver_asistencias','cargar_asistencias',
                      'ver_reportes','ver_planificaciones','editar_planificaciones',
                      'ver_legajo_personal','editar_legajo_personal',
                      'ver_calendario'];

async function runSeed(db) {
  const check = await db.execute('SELECT COUNT(*) AS c FROM instituciones');
  if (Number(check.rows[0].c) > 0) return;

  console.log('🌱 Cargando datos iniciales...');
  try {
    // Institución EPM
    const r1 = await db.execute({ sql: 'INSERT INTO instituciones (nombre, tipo) VALUES (?,?)', args: ['EPM', 'primaria'] });
    const epmId = r1.lastInsertRowid;

    // Ciclo lectivo 2025
    const r2 = await db.execute({
      sql: 'INSERT INTO ciclos_lectivos (institucion_id, nombre, anio, fecha_inicio, fecha_fin, activo) VALUES (?,?,?,?,?,1)',
      args: [epmId, 'Ciclo 2025', 2025, '2025-03-01', '2025-12-15'],
    });
    const cicloId = r2.lastInsertRowid;
    await db.execute({ sql: 'INSERT INTO semestres (ciclo_lectivo_id, nombre, numero, fecha_inicio, fecha_fin) VALUES (?,?,?,?,?)', args: [cicloId, '1er Semestre', 1, '2025-03-01', '2025-07-18'] });
    await db.execute({ sql: 'INSERT INTO semestres (ciclo_lectivo_id, nombre, numero, fecha_inicio, fecha_fin) VALUES (?,?,?,?,?)', args: [cicloId, '2do Semestre', 2, '2025-08-04', '2025-12-15'] });

    // Cursos EPM
    for (const nombre of ['Mojarritas', 'Delfines', 'Tiburones', 'Pulpos']) {
      await db.execute({ sql: 'INSERT INTO cursos (institucion_id, nombre) VALUES (?,?)', args: [epmId, nombre] });
    }

    // Catálogo de permisos
    const permisoIds = {};
    for (const p of PERMISOS) {
      const r = await db.execute({ sql: 'INSERT INTO permisos (codigo, descripcion, grupo) VALUES (?,?,?)', args: [p.codigo, p.descripcion, p.grupo] });
      permisoIds[p.codigo] = r.lastInsertRowid;
    }

    // Roles base del sistema
    const rG = await db.execute({ sql: 'INSERT INTO roles (institucion_id, nombre, descripcion, es_sistema) VALUES (?,?,?,?)', args: [null, 'Gestión',  'Acceso completo al sistema', 1] });
    const rO = await db.execute({ sql: 'INSERT INTO roles (institucion_id, nombre, descripcion, es_sistema) VALUES (?,?,?,?)', args: [null, 'Operador', 'Gestión de alumnos y asistencias', 1] });
    const rD = await db.execute({ sql: 'INSERT INTO roles (institucion_id, nombre, descripcion, es_sistema) VALUES (?,?,?,?)', args: [null, 'Docente',  'Carga de asistencias y planificaciones', 1] });
    const gId = rG.lastInsertRowid;
    const oId = rO.lastInsertRowid;
    const dId = rD.lastInsertRowid;

    // Permisos: Gestión (todos)
    for (const p of PERMISOS) {
      await db.execute({ sql: 'INSERT INTO roles_permisos (rol_id, permiso_id) VALUES (?,?)', args: [gId, permisoIds[p.codigo]] });
    }
    // Permisos: Operador
    for (const c of ROL_OPERADOR) {
      await db.execute({ sql: 'INSERT INTO roles_permisos (rol_id, permiso_id) VALUES (?,?)', args: [oId, permisoIds[c]] });
    }
    // Permisos: Docente
    for (const c of ROL_DOCENTE) {
      await db.execute({ sql: 'INSERT INTO roles_permisos (rol_id, permiso_id) VALUES (?,?)', args: [dId, permisoIds[c]] });
    }

    // Instrumentos iniciales
    for (const nombre of ['Guitarra', 'Canto', 'Batería', 'Bajo', 'Piano', 'Violín', 'Flauta', 'Teclado']) {
      await db.execute({ sql: 'INSERT INTO instrumentos (institucion_id, nombre) VALUES (?,?)', args: [epmId, nombre] });
    }

    // Usuario inicial de Gestión
    await db.execute({
      sql: 'INSERT INTO usuarios (institucion_id, nombre, email, password_hash, rol_id) VALUES (?,?,?,?,?)',
      args: [epmId, 'Administrador EPM', 'admin@epm.edu.ar', bcrypt.hashSync('admin123', 10), gId],
    });

    console.log('✅ Datos iniciales cargados.');
  } catch (e) {
    console.error('❌ Error en seed:', e.message);
    throw e;
  }
}

module.exports = { runSeed };
