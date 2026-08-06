const { useState, useEffect, useCallback } = React;

// ── NAVEGACIÓN CON GRUPOS ──────────────────────────────────────────────────────
const NAV_GROUPS = [
  { label: null, items: [
    { id:'dashboard',       label:'Dashboard',        icon:'🏠', permiso:null },
    { id:'mi-perfil',       label:'Mi perfil',        icon:'👤', permiso:null },
  ]},
  { label: 'Alumnos', items: [
    { id:'estudiantes',     label:'Estudiantes',       icon:'👥', permiso:'ver_estudiantes' },
    { id:'asistencia',      label:'Tomar asistencia',  icon:'📋', permiso:'cargar_asistencias' },
    { id:'reportes',        label:'Reportes',          icon:'📊', permiso:'ver_reportes' },
  ]},
  { label: 'Educación', items: [
    { id:'planificaciones', label:'Planificaciones',   icon:'📝', permiso:'ver_planificaciones' },
    { id:'calendario',      label:'Calendario',        icon:'📅', permiso:'ver_calendario' },
    { id:'docentes',        label:'Equipo Docente',    icon:'👩‍🏫', permiso:'ver_equipo_docente' },
  ]},
  { label: 'Institución', items: [
    { id:'proyectos',       label:'Proyectos',         icon:'📁', permiso:'ver_proyectos' },
    { id:'reuniones',       label:'Reuniones',         icon:'🗒️', permiso:'ver_reuniones' },
    { id:'inventario',      label:'Inventario',        icon:'🎻', permiso:'ver_inventario' },
    { id:'finanzas',        label:'Finanzas',          icon:'💰', permiso:'ver_finanzas' },
  ]},
  { label: 'Administración', items: [
    { id:'cursos',          label:'Cursos (Niveles)',  icon:'🏫', permiso:'administrar_cursos' },
    { id:'instrumentos',    label:'Instrumentos',      icon:'🎸', permiso:'administrar_cursos' },
    { id:'usuarios',        label:'Usuarios y roles',  icon:'👤', permiso:'administrar_usuarios_roles' },
    { id:'backup',          label:'Backup',            icon:'💾', permiso:'acceder_backup' },
  ]},
];
// NAV flat (para búsquedas de label/icon por id)
const NAV = NAV_GROUPS.flatMap(g => g.items);

// ── TOUR GUIADO + TIPS DE USO ──────────────────────────────────────────────────
// Única fuente de verdad para el texto de cada sección: el tour usa `descripcion`
// (título + descripción), el panel de ayuda (❓) usa `descripcion` + `tips`.
const SECCION_INFO = {
  dashboard: {
    descripcion: 'Tu página de inicio. Acá ves los próximos eventos, cumpleaños y un resumen general.',
    tips: [
      '💡 Los cumpleaños de estudiantes y del equipo aparecen automáticamente acá arriba.',
      '💡 Tocá "Ver todos" en cualquier card para ir directo a esa sección.',
    ],
  },
  'mi-perfil': {
    descripcion: 'Tus datos personales, foto y cambio de contraseña.',
    tips: [
      '💡 Para cambiar tu contraseña siempre te vamos a pedir la actual, por seguridad.',
      '💡 Si sos Docente, acá cargás tus instrumentos y tu formación.',
    ],
  },
  estudiantes: {
    descripcion: 'Acá cargás y gestionás la ficha de cada estudiante. Podés buscar por nombre, DNI o curso.',
    tips: [
      '💡 Usá "Guardar y cargar otro" para cargar varios estudiantes seguidos.',
      '💡 Podés importar un plantel completo desde un archivo CSV.',
      '💡 La pestaña "Legajo personal" guarda salud, trayectoria y observaciones.',
    ],
  },
  asistencia: {
    descripcion: 'Tomá la asistencia del día seleccionando el curso. Un toque por estudiante, rápido y fácil.',
    tips: [
      '💡 Podés usar "Todos presentes" y después corregir solo los ausentes.',
      '💡 Si ya cargaste la asistencia de hoy, se precarga para editar.',
    ],
  },
  reportes: {
    descripcion: 'Mirá cómo viene la asistencia por curso y por estudiante, con gráficos y porcentajes.',
    tips: [
      '💡 Hacé click en cualquier columna para ordenar.',
      '💡 Los porcentajes bajos aparecen en rojo.',
      '💡 El tab "Por nivel / curso" te muestra qué datos le faltan a cada estudiante.',
    ],
  },
  calendario: {
    descripcion: 'Eventos de la EPM: muestras, festivales, reuniones, feriados. También aparecen los cumpleaños.',
    tips: [
      '💡 Los cumpleaños aparecen automáticamente con 🎂.',
      '💡 Si cancelás o reprogramás un evento, los afectados reciben una notificación.',
      '💡 Los eventos de varios días se ven conectados en el calendario.',
    ],
  },
  planificaciones: {
    descripcion: 'Organizá los contenidos por período, curso y docente.',
    tips: [
      '💡 Podés reordenar los contenidos con las flechas ↑↓.',
      '💡 Cada docente ve solo sus propias planificaciones (Gestión las ve todas).',
    ],
  },
  reuniones: {
    descripcion: 'Registrá las reuniones del equipo con resumen, participantes y menciones.',
    tips: [
      '💡 Escribí @ para mencionar a alguien y que le llegue una notificación.',
      '💡 Podés copiar el resumen como texto plano o exportarlo a PDF.',
    ],
  },
  docentes: {
    descripcion: 'El equipo de profes de la EPM con su instrumento y formación.',
    tips: [
      '💡 Filtrá por instrumento para encontrar rápido a quien buscás.',
      '💡 Cada docente puede editar su propia ficha desde "Mi perfil".',
    ],
  },
  inventario: {
    descripcion: 'Los instrumentos físicos de la escuela: qué hay, en qué estado, a quién se prestó.',
    tips: [
      '💡 Usá los filtros de tipo y estado para encontrar un instrumento rápido.',
      '💡 Podés exportar el inventario completo a CSV.',
    ],
  },
  proyectos: {
    descripcion: 'Documentá proyectos institucionales y a dónde se presentaron.',
    tips: [
      '💡 Cada cambio de estado queda registrado en la línea de tiempo del proyecto.',
      '💡 Podés adjuntar PDFs, Word o imágenes de hasta 20MB.',
    ],
  },
  usuarios: {
    descripcion: 'Administrá quién accede al sistema y con qué permisos.',
    tips: [
      '💡 Podés invitar gente por link, sin necesidad de que tengan email cargado antes.',
      '💡 La matriz de permisos es editable por rol.',
    ],
  },
  backup: {
    descripcion: 'Copias de seguridad de toda la información del sistema.',
    tips: [
      '💡 Se genera un backup automático cada semana, además del manual.',
      '💡 Restaurar un backup reinicia el servidor — avisá antes de hacerlo.',
    ],
  },
};

// Orden del tour de bienvenida: el mismo orden de arriba hacia abajo del sidebar
// (derivado de NAV, no una lista aparte a mano — así nunca puede desincronizarse si
// el menú cambia). Solo incluye ids que tengan contenido en SECCION_INFO (deja afuera
// Cursos/Instrumentos/Finanzas, que hoy no forman parte del tour).
const TOUR_ORDEN = NAV.map(n => n.id).filter(id => SECCION_INFO[id]);

// ── HELPERS EVENTOS ────────────────────────────────────────────────────────────
const TIPO_EVENTO = {
  muestra:  { label:'Muestra',   color:'#f59e0b', cls:'evt-muestra'  },
  feriado:  { label:'Feriado',   color:'#ef4444', cls:'evt-feriado'  },
  reunion:  { label:'Reunión',   color:'#3b82f6', cls:'evt-reunion'  },
  ensayo:   { label:'Ensayo',    color:'#8b5cf6', cls:'evt-ensayo'   },
  salida:   { label:'Salida',    color:'#22c55e', cls:'evt-salida'   },
  festival: { label:'Festival',  color:'#eab308', cls:'evt-festival' },
  otro:     { label:'Otro',      color:'#6b7280', cls:'evt-otro'     },
};
function tipoColor(tipo) { return TIPO_EVENTO[tipo]?.color || '#6b7280'; }
function tipoCls(tipo)   { return TIPO_EVENTO[tipo]?.cls   || 'evt-otro'; }
function tipoLabel(tipo) { return TIPO_EVENTO[tipo]?.label || tipo; }

function formatFechaCalendario(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatHora(h) { return h ? h.slice(0,5) : ''; }

function tiempoRelativo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins} min`;
  const hs = Math.floor(mins / 60);
  if (hs  < 24)  return `hace ${hs}h`;
  const ds = Math.floor(hs  / 24);
  if (ds  < 7)   return `hace ${ds}d`;
  return formatFechaCalendario(isoStr.slice(0,10));
}

// ── UTILS ───────────────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('epm_token');
const getUser  = () => { try { return JSON.parse(localStorage.getItem('epm_user')); } catch { return null; } };

async function apiFetch(url, opts = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization:`Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── CSV IMPORT UTILITIES ────────────────────────────────────────────────────────
const COLS_CSV = ['Nombre','Apellido','DNI','CUIT','Fecha de nacimiento','Teléfono','Dirección',
                  'Tutor','DNI del tutor','Teléfono del tutor','Autorización de Imagen','Autorización General',
                  'Autorización Boleto Estudiantil','Curso','Instrumento'];

function descargarPlantilla() {
  // Curso e Instrumento soportan múltiples valores separados por | (uno por inscripción)
  const ej1 = ['Juan','García','45123456','20-45123456-7','15/03/2015','1122334455','Av. Siempreviva 742','María García','23456789','1155667788','sí','sí','no','Delfines|Mojarritas','Guitarra|Canto'];
  const ej2 = ['Sofía','López','45678901','','22/07/2016','','','','','','no','no','sí','Tiburones','Batería'];
  const csv = [COLS_CSV,ej1,ej2].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download = 'EPM_plantilla_importacion.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function parseBool(v) {
  return ['si','sí','x','1','true','yes','y'].includes(String(v||'').toLowerCase().trim());
}
function parseFecha(v) {
  const s = String(v||'').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function parseCsvLine(line, sep=',') {
  const res=[]; let cur='', inQ=false;
  for (let i=0; i<line.length; i++) {
    const c=line[i];
    if (c==='"') { if (inQ&&line[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if (c===sep&&!inQ) { res.push(cur.trim()); cur=''; }
    else cur+=c;
  }
  res.push(cur.trim()); return res;
}
function parseCsv(text) {
  // Strip BOM (both UTF-8 and UTF-16 variants), normalize line endings
  const clean = text.replace(/^﻿/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
  const lines = clean.split('\n').filter(l=>l.trim());
  if (lines.length<2) return [];
  // Auto-detect delimiter: semicolon (Excel Spanish locale) vs comma
  const firstLine = lines[0];
  const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  // Normalize headers to NFC so accented chars match regardless of Unicode form
  const headers = parseCsvLine(firstLine, sep).map(h => h.normalize('NFC'));
  return lines.slice(1).map(l => {
    const vals = parseCsvLine(l, sep);
    const row = {};
    headers.forEach((h,i)=>{ row[h] = vals[i]||''; });
    return row;
  });
}
function validarFilaCSV(row, cursos, instrumentos, allDnis, idx) {
  const errors=[];
  const nombre   = row['Nombre']?.trim()||'';
  const apellido = row['Apellido']?.trim()||'';
  const dni      = row['DNI']?.trim()||'';
  if (!nombre)   errors.push('Nombre requerido');
  if (!apellido) errors.push('Apellido requerido');
  if (!dni)      errors.push('DNI requerido');
  if (dni && allDnis.filter(d=>d===dni).length>1) errors.push('DNI duplicado en el archivo');
  let fecha_nacimiento='';
  if (row['Fecha de nacimiento']?.trim()) {
    const f=parseFecha(row['Fecha de nacimiento']);
    if (f===null) errors.push('Fecha inválida (usar DD/MM/AAAA o AAAA-MM-DD)');
    else fecha_nacimiento=f;
  }

  // Parsear inscripciones: columna Instrumento (opcional) emparejada con Curso
  const instrStr = row['Instrumento']?.trim()||'';
  const cursoStr = row['Curso']?.trim()||'';
  const inscripciones = [];
  let inscripcionesLabel = '';

  if (instrStr) {
    const instrNombres = instrStr.split('|').map(s=>s.trim()).filter(Boolean);
    const cursoNombres = cursoStr.split('|').map(s=>s.trim()).filter(Boolean);
    instrNombres.forEach((instrNombre, i) => {
      const cursoNombre = cursoNombres[i] || '';
      const instr = (instrumentos||[]).find(x=>x.nombre.toLowerCase()===instrNombre.toLowerCase());
      const curso = cursos.find(c=>c.nombre.toLowerCase()===cursoNombre.toLowerCase());
      if (!instr) {
        errors.push(`Instrumento "${instrNombre}" no encontrado en el sistema`);
      } else if (!cursoNombre) {
        errors.push(`Falta el nivel para instrumento "${instrNombre}"`);
      } else if (!curso) {
        errors.push(`Nivel "${cursoNombre}" no existe`);
      } else {
        inscripciones.push({ curso_id: Number(curso.id), instrumento_id: Number(instr.id),
                             curso_nombre: curso.nombre, instrumento_nombre: instr.nombre });
      }
    });
    inscripcionesLabel = inscripciones.map(i=>`${i.curso_nombre} · ${i.instrumento_nombre}`).join(' | ');
  }

  return {
    idx:idx+1, ok:errors.length===0, errors,
    nombre, apellido, dni,
    cuit:         row['CUIT']?.trim()||'',
    fecha_nacimiento,
    telefono:       row['Teléfono']?.trim()||'',
    direccion:      row['Dirección']?.trim()||'',
    tutor_nombre:   row['Tutor']?.trim()||'',
    tutor_dni:      row['DNI del tutor']?.trim()||'',
    tutor_telefono: row['Teléfono del tutor']?.trim()||'',
    auth_imagen:  parseBool(row['Autorización de Imagen']),
    auth_general: parseBool(row['Autorización General']),
    auth_boleto:  parseBool(row['Autorización Boleto Estudiantil']),
    inscripciones, inscripcionesLabel,
  };
}

async function apiFotoUpload(id, file) {
  const fd = new FormData();
  fd.append('foto', file);
  const res = await fetch(`/api/estudiantes/${id}/foto`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al subir foto');
  return data;
}
