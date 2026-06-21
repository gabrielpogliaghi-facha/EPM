const bcrypt = require('bcryptjs');

const PERMISOS = [
  { codigo: 'ver_estudiantes',          descripcion: 'Ver fichas de estudiantes',         grupo: 'estudiantes'    },
  { codigo: 'crear_estudiantes',        descripcion: 'Crear nuevos estudiantes',           grupo: 'estudiantes'    },
  { codigo: 'editar_estudiantes',       descripcion: 'Editar datos de estudiantes',        grupo: 'estudiantes'    },
  { codigo: 'ver_asistencias',          descripcion: 'Ver registros de asistencia',        grupo: 'asistencias'    },
  { codigo: 'cargar_asistencias',       descripcion: 'Cargar asistencias',                 grupo: 'asistencias'    },
  { codigo: 'justificar_ausencias',     descripcion: 'Justificar o editar ausencias',      grupo: 'asistencias'    },
  { codigo: 'ver_reportes',             descripcion: 'Ver reportes',                       grupo: 'reportes'       },
  { codigo: 'editar_reportes',          descripcion: 'Editar y generar reportes',          grupo: 'reportes'       },
  { codigo: 'ver_planificaciones',      descripcion: 'Ver planificaciones de contenidos',  grupo: 'planificaciones'},
  { codigo: 'editar_planificaciones',   descripcion: 'Crear y editar planificaciones',     grupo: 'planificaciones'},
  { codigo: 'administrar_usuarios_roles', descripcion: 'Administrar usuarios y roles',     grupo: 'administracion' },
  { codigo: 'administrar_cursos',       descripcion: 'Administrar cursos',                 grupo: 'administracion' },
  { codigo: 'acceder_backup',           descripcion: 'Acceder a backup del sistema',       grupo: 'administracion' },
];

const ROL_OPERADOR  = ['ver_estudiantes','crear_estudiantes','editar_estudiantes',
                        'ver_asistencias','cargar_asistencias','justificar_ausencias',
                        'ver_reportes','editar_reportes','administrar_cursos'];
const ROL_DOCENTE   = ['ver_estudiantes','ver_asistencias','cargar_asistencias',
                        'ver_reportes','ver_planificaciones','editar_planificaciones'];

function runSeed(db) {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM instituciones').get();
  if (c > 0) return;

  console.log('🌱 Cargando datos iniciales...');
  db.exec('BEGIN');
  try {
    // Institución EPM
    const { lastInsertRowid: epmId } = db.prepare(
      'INSERT INTO instituciones (nombre, tipo) VALUES (?,?)'
    ).run('EPM', 'primaria');

    // Ciclo lectivo 2025 con sus dos semestres
    const { lastInsertRowid: cicloId } = db.prepare(`
      INSERT INTO ciclos_lectivos (institucion_id, nombre, anio, fecha_inicio, fecha_fin, activo)
      VALUES (?,?,?,?,?,1)
    `).run(epmId, 'Ciclo 2025', 2025, '2025-03-01', '2025-12-15');
    db.prepare(`INSERT INTO semestres (ciclo_lectivo_id, nombre, numero, fecha_inicio, fecha_fin)
      VALUES (?,?,?,?,?)`).run(cicloId, '1er Semestre', 1, '2025-03-01', '2025-07-18');
    db.prepare(`INSERT INTO semestres (ciclo_lectivo_id, nombre, numero, fecha_inicio, fecha_fin)
      VALUES (?,?,?,?,?)`).run(cicloId, '2do Semestre', 2, '2025-08-04', '2025-12-15');

    // Cursos EPM
    ['Mojarritas', 'Delfines', 'Tiburones', 'Pulpos'].forEach(nombre => {
      db.prepare('INSERT INTO cursos (institucion_id, nombre) VALUES (?,?)').run(epmId, nombre);
    });

    // Catálogo de permisos
    const insertPermiso = db.prepare(
      'INSERT INTO permisos (codigo, descripcion, grupo) VALUES (?,?,?)'
    );
    const permisoIds = {};
    PERMISOS.forEach(p => {
      const { lastInsertRowid } = insertPermiso.run(p.codigo, p.descripcion, p.grupo);
      permisoIds[p.codigo] = lastInsertRowid;
    });

    // Roles base del sistema (institucion_id NULL = globales)
    const insertRol = db.prepare(
      'INSERT INTO roles (institucion_id, nombre, descripcion, es_sistema) VALUES (?,?,?,?)'
    );
    const rGestion  = insertRol.run(null, 'Gestión',  'Acceso completo al sistema', 1);
    const rOperador = insertRol.run(null, 'Operador', 'Gestión de alumnos y asistencias', 1);
    const rDocente  = insertRol.run(null, 'Docente',  'Carga de asistencias y planificaciones', 1);

    const insertRP = db.prepare('INSERT INTO roles_permisos (rol_id, permiso_id) VALUES (?,?)');

    // Gestión: todos los permisos
    PERMISOS.forEach(p => insertRP.run(rGestion.lastInsertRowid, permisoIds[p.codigo]));
    // Operador
    ROL_OPERADOR.forEach(c => insertRP.run(rOperador.lastInsertRowid, permisoIds[c]));
    // Docente
    ROL_DOCENTE.forEach(c => insertRP.run(rDocente.lastInsertRowid, permisoIds[c]));

    // Usuario inicial de Gestión
    db.prepare(`
      INSERT INTO usuarios (institucion_id, nombre, email, password_hash, rol_id)
      VALUES (?,?,?,?,?)
    `).run(epmId, 'Administrador EPM', 'admin@epm.edu.ar',
           bcrypt.hashSync('admin123', 10), rGestion.lastInsertRowid);

    db.exec('COMMIT');
    console.log('✅ Datos iniciales cargados.');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('❌ Error en seed:', e.message);
    throw e;
  }
}

module.exports = { runSeed };
