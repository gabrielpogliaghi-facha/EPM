# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas de autonomía

- Trabajar de corrido sin pedir confirmación para tareas técnicas.
- Crear, editar y borrar archivos según haga falta.
- Instalar dependencias por cuenta propia cuando sea necesario.
- Iniciar y reiniciar el servidor solo, sin preguntar, cada vez que se hagan cambios que lo requieran.
- Si se encuentra un error, corregirlo solo y seguir.
- Consultar al usuario solo si hay una acción irreversible que podría hacerle perder datos sin forma razonable de inferir qué prefiere.

## Contexto del proyecto

- Sistema de gestión escolar para la **EPM**. Los cursos (**Mojarritas, Delfines, Tiburones, Pulpos**) son **niveles de experiencia por instrumento**.
- Está pensado para escalar al secundario de la **Escuela Técnica UNSAM**, con acceso de padres, materias y asistencia por materia.
- Diseñar siempre pensando en **multi-institución** y en migrar a un servidor online más adelante.
- El uso principal es desde **celulares**: todo mobile-first.

## Estado del proyecto

### Módulos terminados

| # | Módulo | Fecha | Notas |
|---|--------|-------|-------|
| 0 | **Esqueleto** (DB + estructura + navegación vacía) | 2026-06-19 | Base completa: 14 tablas, permisos granulares, seed, SPA mobile-first |
| 1 | **Cursos** (CRUD) | 2026-06-20 | Listar, crear, renombrar, eliminar con confirmación |
| 2 | **Ficha de estudiante** (CRUD + listado) | 2026-06-20 | Ficha tipo legajo, autorizaciones destacadas, "Guardar y cargar otro", baja suave |
| 2+ | **Mejoras a la ficha** (foto, CSV, bulk auth) | 2026-06-20 | Dirección en Identidad, foto en avatar, export CSV client-side, marcado masivo de autorizaciones |
| 3  | **Tomar asistencia** (general) | 2026-06-20 | Mobile-first, upsert por fecha/curso, detección de asistencia existente, "Todos presentes" |
| 2c | **Importar / Exportar CSV** | 2026-06-20 | Importación con preview+validación, plantilla descargable con ejemplos, exportación roundtrip-compatible |
| 4  | **Reportes de asistencia** | 2026-06-20 | Tabla ordenable, stats, filtro por semestre/rango/curso, exportar CSV, imprimir, editar fechas de semestre |
| 4+ | **Gráficos de torta** en reportes | 2026-06-20 | SVG nativo (sin librerías), torta general del curso + mini-torta por estudiante en la tabla |
| 5  | **Usuarios y Roles** | 2026-06-20 | CRUD usuarios, asignación de cursos, matriz de permisos editable, protección de sistema |
| 6  | **Planificaciones** | 2026-06-20 | Períodos propios, planif. por curso+docente, contenidos con reorden ↑↓, vistas por rol |
| 7  | **Backup** | 2026-06-20 | Backup automático inicial + semanal, backup manual, lista, descarga, restauración con reinicio |
| +  | **Historial de asistencia** (calendario visual) | 2026-06-20 | Grilla mensual color-coded en Ficha de estudiante y en sección Asistencias |

| 8  | **Instrumentos + Inscripciones** | 2026-06-22 | Nuevo modelo: estudiante puede tener múltiples cursos por instrumento. CRUD de instrumentos, panel de inscripciones en Ficha, filtros en lista, instrumento visible en asistencia. Historial de progresión preparado en DB sin UI aún. |
| 9  | **Legajo personal** | 2026-06-22 | Segunda pestaña en la Ficha. Campos fijos: grupo familiar, salud, trayectoria. Tres timelines: historial de salud, historial de trayectoria, observaciones generales. Permisos `ver_legajo_personal` + `editar_legajo_personal` (Gestión + Docente; Operador no ve). Migración de permisos automática en `runSchema`. |
| inf| **Migración a Turso (libSQL)** | 2026-06-22 | Reemplaza node:sqlite por @libsql/client. Dev usa file:./epm.db; prod usa TURSO_URL + TURSO_AUTH_TOKEN. |
| 10 | **Recuperación de contraseña** | 2026-06-23 | Self-service vía email (Resend): link con token hasheado, expira 1 hora, uso único. Reseteo manual por Gestión ya existía. UI: "¿Olvidaste tu contraseña?" en login + pantalla de nueva contraseña vía `?token=` en URL. |
| 11 | **Calendario de eventos + Notificaciones** | 2026-06-23 | Calendario mensual con tipos de eventos (muestra/feriado/reunión/ensayo/salida/festival/otro), colores por tipo, vistas mes y agenda. Cancelar/reprogramar con motivo: notifica in-app (campanita en topbar) + email vía Resend. Tabla `eventos`, `evento_cursos`, `notificaciones`. Permisos `ver_calendario`, `crear_eventos`, `editar_eventos`. Dashboard muestra próximos eventos. |
| 12 | **Equipo Docente** | 2026-06-24 | Ficha extendida de profes vinculada a `usuarios`. Tabla `docentes` + `docente_instrumentos`. Campos: DNI, fecha nacimiento, teléfono, foto, formación/experiencia, instrumentos que enseña. Docente puede editar su propio perfil. Permisos `ver_equipo_docente` + `editar_equipo_docente`. |
| 13 | **Cumpleaños en calendario** | 2026-06-24 | Puntitos rosas en el calendario para cumpleaños de estudiantes y docentes. Modal al click con detalle. Card "Cumpleaños del mes" en Dashboard (hoy resaltado, próximos 7 días, resto del mes). Campanita notifica cumpleaños de la semana (deduplicado por día). Endpoint `GET /api/cumpleanios` + `POST /api/cumpleanios/notificar`. |
| 14 | **Inventario de instrumentos** | 2026-06-24 | Inventario de instrumentos físicos (no tipos). Tabla `inventario` con nombre, tipo, estado (disponible/en uso/en reparación/baja), asignado a, número de serie, observaciones. Filtros por tipo y estado. Export CSV client-side. Permisos `ver_inventario` + `editar_inventario`. |
| 15 | **Proyectos institucionales** | 2026-06-24 | Gestión de proyectos con estados (borrador/en curso/presentado/aprobado/rechazado/finalizado), timeline de historial de estados, adjuntos (PDF/Word/imagen hasta 20MB). Filtro por estado. Permisos `ver_proyectos` + `editar_proyectos`. Tablas `proyectos`, `proyecto_historial`, `proyecto_adjuntos`. |
| 16 | **Finanzas (estructura)** | 2026-06-24 | Módulo pendiente de CUIT. Pantalla "en construcción" con explicación. Tablas `movimientos_financieros` + `categorias_financieras` ya creadas. Permisos `ver_finanzas` + `editar_finanzas` + `administrar_finanzas`. Listo para activar cuando la EPM tenga CUIT. |
| +  | **Reorganización del menú** | 2026-06-24 | Sidebar con grupos: Alumnos / Educación / Institución / Administración. `NAV_GROUPS` reemplaza el array plano; `NAV` sigue existiendo como flat map para lookups. |
| 17 | **Invitaciones por link** | 2026-06-24 | Link con token (SHA-256, 7 días, uso único). Sin email: el admin genera el link y lo comparte por WhatsApp vía "📋 Copiar" o "📱 Compartir" (Web Share API). El invitado completa nombre, email y contraseña. Tab "Invitaciones" en Usuarios y Roles con nota interna, estados y regenerar. |
| 18 | **Limpieza total de emails** | 2026-06-24 | Eliminados Nodemailer, Resend y Gmail SMTP del código. `utils/mailer.js` eliminado. `utils/notificaciones.js` ya no envía emails (solo notificaciones in-app). Login: "¿Olvidaste tu contraseña?" muestra mensaje para contactar a Gestión. |
| 19 | **Instrumentos de docentes fix** | 2026-06-24 | Corregido selector múltiple en FichaDocente (conversión Number() para evitar fallos de tipo). Nuevo campo `instrumento_principal_id` en tabla `docentes`. El listado muestra ★ instrumento principal. |

### Estado general

**Sistema completo sin dependencia de email. Invitaciones por link. Equipo docente con instrumento principal. Finanzas en estructura.**

### Decisiones tomadas

- **Eliminación de curso con estudiantes**: se *desactiva* (`activo=0`), nunca se borran datos. Sin estudiantes: se elimina físicamente. El pop-up explica la diferencia antes de confirmar.
- **Modelo inscripciones**: `inscripciones(estudiante_id, curso_id, instrumento_id)` con UNIQUE(estudiante_id, instrumento_id). Un estudiante puede estar en N cursos simultáneos pero solo uno por instrumento. `estudiantes.curso_id` quedó deprecated (nullable, ignorado en UI).
- **Conteo de estudiantes en `GET /api/cursos`**: via subquery sobre `inscripciones` + `estudiantes` activos. No usa `estudiantes.curso_id`.
- **Roles globales vs. por institución**: los tres roles base (`Gestión`, `Operador`, `Docente`) tienen `institucion_id = NULL` (globales). Los roles personalizados que Gestión cree tendrán `institucion_id` de la institución.
- **Permisos en JWT**: los 13 permisos van en el payload del token para evitar una query extra por request. Si se cambian permisos de un rol, el usuario tiene que volver a loguearse para que se reflejen.
- **DB**: `epm.db` (nueva). La DB anterior está en `escuela_v1.db` como backup.
- **Recuperación de contraseña**: token = `crypto.randomBytes(32)` hex; se guarda SHA-256 en `password_reset_tokens`. El raw token va en el link. `POST /forgot-password` siempre responde genérico (no revela si el email existe). La URL base se detecta con `req.protocol + '://' + req.get('host')` → funciona en local y en Render. Remitente: `onboarding@resend.dev` (dominio gratuito de Resend). `RESEND_API_KEY` requerida en .env y en Render → Settings → Environment.
- **Asistencia general vs. por materia**: columna `tipo_asistencia` + `materia_id` nullable + índices parciales únicos. La general es lo que usa EPM ahora; la por materia queda lista para UNSAM.
- **Calendario de eventos**: tabla `eventos` (titulo, fecha, hora_inicio, hora_fin, lugar, tipo, alcance, estado, motivo_cambio, fecha_original). `evento_cursos` para eventos dirigidos a cursos específicos. Tipos: muestra/feriado/reunion/ensayo/salida/otro (colores distintos). Alcance: `institucion` (todos) o `cursos` (específicos). Estado: activo/cancelado/reprogramado. Cancelar/reprogramar requiere motivo → notifica a usuarios afectados.
- **Notificaciones**: tabla `notificaciones` (usuario_id, titulo, mensaje, tipo, entidad_tipo, entidad_id, leida). `utils/notificaciones.js` crea registros en DB + envía emails. Campanita en topbar con badge de no-leídas, polling cada 30s. Panel desplegable al hacer click. `GET /api/notificaciones`, `PUT /api/notificaciones/leer-todas`, `PUT /api/notificaciones/:id/leer`. Sistema genérico reutilizable para otros avisos futuros.
- **Filtro de visibilidad eventos**: Gestión/Operador ven todos. Docente: solo eventos `alcance='institucion'` + eventos de sus cursos asignados.
- **Notificados en cancelación/reprogramación**: si alcance=`institucion` → todos los usuarios activos. Si alcance=`cursos` → usuarios con esos cursos en `usuarios_cursos` + usuarios con permiso `administrar_cursos`.
- **Equipo Docente**: tabla `docentes` (usuario_id UNIQUE, dni, fecha_nacimiento, telefono, formacion, foto_path) + `docente_instrumentos` (docente_id, instrumento_id). La ficha se crea con `PUT /api/docentes/:usuarioId` (upsert). Un Docente puede editar SU PROPIO perfil (sin necesitar `editar_equipo_docente`). Fotos en `/uploads/docentes/`.
- **Cumpleaños**: `GET /api/cumpleanios?mes=MM&anio=YYYY` → array con {nombre, tipo, dia, fecha_nacimiento}. `POST /api/cumpleanios/notificar` crea notificaciones in-app para cumpleaños de hoy y próximos 6 días (deduplicado por día via localStorage key). Se llama desde Dashboard `CumpleaniosMes` una vez por día.
- **Inventario**: `GET/POST /api/inventario`, `PUT/DELETE /api/inventario/:id`. Sin FK rígida en `asignado_tipo`/`asignado_id` (texto libre + id). Export CSV client-side en el frontend.
- **Proyectos**: `GET /api/proyectos`, `GET /api/proyectos/:id` (incluye historial + adjuntos), `POST/PUT/DELETE`. Al cambiar estado en PUT, se crea entrada en `proyecto_historial` automáticamente. Adjuntos con multer en `/uploads/proyectos/`.
- **Finanzas**: solo esqueleto. Las tablas `movimientos_financieros` y `categorias_financieras` existen en DB. El endpoint GET retorna `{estado:'en_construccion'}`. Activar cuando la EPM obtenga CUIT.
- **Menú**: `NAV_GROUPS` es el array de grupos para el sidebar. `NAV` es el flat map derivado de `NAV_GROUPS.flatMap(g=>g.items)` — todos los lookups por `id` siguen funcionando igual.
- **Invitaciones**: tabla `invitaciones` (email, rol_id, token_hash SHA-256, estado, expires_at, cursos_ids JSON, created_by, accepted_by). `utils/mailer.js` = Nodemailer con Gmail SMTP. El raw token va en el link `?invite=TOKEN`; el hash se guarda en DB. `POST /api/invitaciones` acepta array de emails para envío masivo. Rutas públicas (sin auth): `GET /api/invitaciones/verificar/:token` y `POST /api/invitaciones/aceptar`. Al aceptar se crea el usuario + asigna cursos + marca la invitación como aceptada. `InvitacionPage` componente detectado vía `?invite=` en URL (igual que `?token=` para reset de contraseña).
- **Gmail SMTP**: `GMAIL_USER` + `GMAIL_APP_PASSWORD` en .env. `utils/mailer.js` verifica que estén configuradas; si no, loggea warning y no falla.

### Pendientes / por decidir

- **Ficha de estudiante**: baja de estudiante es soft delete (`activo=0`). La búsqueda usa SQLite LIKE, que no maneja acentos en la comparación — funciona bien sin acento en el buscador.
- **"Guardar y cargar otro"**: usa `key={fichaKey}` en el componente Ficha para forzar remount con form vacío del mismo curso. Solo disponible al crear (no al editar).
- **Foto del estudiante**: se guarda en `/uploads/estudiantes/est_<id>_<timestamp>.ext`. La URL se almacena en `estudiantes.foto_path`. Servida como estático desde `/uploads`. Multer limita a 5 MB. Foto del avatar en el header es clickeable para cambiar (label + input file oculto).
- **CSV export**: generado 100% client-side con BOM UTF-8 (`﻿`) para compatibilidad con Excel. No exporta foto_path.
- **Bulk autorizar**: `PUT /api/estudiantes/bulk-autorizar` DEBE estar definido ANTES de `PUT /:id` en el router para evitar que Express lo trate como un id.
- **Asistencia upsert**: `POST /api/asistencias/bulk` hace INSERT o UPDATE por cada alumno usando `SELECT id ... WHERE estudiante_id=? AND fecha=? AND tipo_asistencia='general'` dentro de una transacción. Esto respeta el índice parcial único sin conflictos.
- **Historial asistencia**: `GET /api/asistencias/estudiante/:id?fecha_inicio=&fecha_fin=` devuelve registros generales del alumno. `CalendarioAsistencia` es un componente reutilizable (se usa en Ficha y en pestaña Historial). Al hacer click en un día muestra estado + observación. Navega por mes con ← →. El componente debe ir definido ANTES de Ficha y de HistorialAsistencia.
- **Backup**: archivos en `/backups/` con nombre `backup_YYYY-MM-DD_HH-MM-SS.db`. Backup automático al arranque si no hay ninguno, luego cada 7 días. `utils/backup.js` es la utilidad compartida (importada por routes/backup.js y server.js).
- **Restauración**: cierra DB con `db.close()` (libera lock en Windows), copia el backup, luego `process.exit(0)`. El usuario reinicia el servidor manualmente. Antes de restaurar siempre se hace un backup automático de seguridad del estado actual.
- **FUTURO NUBE**: en `utils/backup.js` y `routes/backup.js` hay comentarios marcando dónde integrar un provider de cloud storage (S3/GCS/Azure Blob).
- **Planificaciones acceso**: Docente ve solo `docente_id = req.user.id`. Gestión (tiene `administrar_cursos`) ve todas. El backend devuelve 404 (no 403) cuando no se tiene acceso, para no filtrar información.
- **Reordenar contenidos**: `PUT /api/planificaciones/:id/contenidos/orden` debe estar definido ANTES de `PUT /:id/contenidos/:cid` para que Express no interprete "orden" como un :cid.
- **UNSAM futuro**: la columna `materia_id` existe en `planificaciones` (NULL para EPM). El modal de creación ya tiene el comentario ℹ️. La lógica de filtro acepta `materia_id` en las queries para cuando se implemente.
- **Módulo 5 protecciones backend**: (1) No se puede eliminar al último admin (`hayOtroAdmin(excludeId)`). (2) No se puede cambiar el rol del admin a uno sin `administrar_usuarios_roles` si no hay otro admin. (3) No se puede quitar `administrar_usuarios_roles` de un rol si es el único con ese permiso. (4) No se puede dar de baja la propia cuenta.
- **Cursos asignados a docentes**: tabla `usuarios_cursos` ahora se usa. Al crear/editar un usuario se asignan cursos. Docentes sin cursos ven lista vacía en Tomar Asistencia.
- **Grafico de torta**: componente `PieChart({ presencias, ausencias, tardes, size })` SVG puro. Maneja 3 edge cases: 0 total (circulo gris con —), 1 solo segmento (circulo completo), multiples (sectores SVG con `path`+`arc`). Para futura asistencia por materia: reutilizar el mismo componente con los totales por materia.
- **Reporte % asistencia**: se calcula como `presencias / total_registros * 100` por alumno. "Sin datos" si no tiene registros en el período. Los días registrados se cuentan como `COUNT(DISTINCT fecha)` en el período.
- **Editar semestre**: `PUT /api/periodos/semestres/:id` requiere `editar_reportes`. El botón ✏️ en los tabs de semestre solo aparece si tiene ese permiso.
- **Print**: `@media print` en CSS oculta sidebar, topbar y controles; muestra `.print-header` con el período y curso.
- **Importar CSV**: `POST /api/estudiantes/importar` recibe JSON (el frontend parsea el CSV). La validación completa ocurre en el frontend antes de enviar; el backend solo verifica UNIQUE. Las funciones de parseo CSV (`parseCsv`, `validarFilaCSV`, `parseBool`, `parseFecha`) son utilidades globales en index.html.
- **Exportar CSV**: usa los mismos `COLS_CSV` que la plantilla de importación → los archivos exportados son re-importables. Las fechas se exportan en DD/MM/AAAA, las autorizaciones como sí/no minúscula.
- **mis-cursos**: `GET /api/cursos/mis-cursos` — si el usuario tiene `administrar_cursos` devuelve todos los cursos; si no, solo los de `usuarios_cursos`. Los docentes sin cursos asignados ven lista vacía (asignar desde Módulo 5).
- **Asistencia por materia**: el campo `tipo_asistencia` y `materia_id` ya existen en la tabla. El módulo actual solo usa `tipo_asistencia = 'general'`.
- **Selección masiva**: usa `Set` de ids. "Seleccionar todos" actúa sobre los estudiantes visibles en ese momento (filtrado por curso/búsqueda).
- Al construir Tomar Asistencia (Módulo 3): definir si el docente solo ve los cursos que tiene asignados o todos (hoy la tabla `usuarios_cursos` existe pero no se usa aún).
- Al construir Usuarios y Roles (Módulo 5): proteger que nunca quede el sistema sin ningún usuario con `administrar_usuarios_roles`.

## Commands (actualizados post-refactor)

```bash
npm start       # production — node server.js
npm run dev     # development — nodemon (auto-restart on change)
```

No build step, no tests, no linter configured.

## Estructura de archivos

```
server.js                  # Entry point: registra rutas, sirve SPA
db/
  index.js                 # Abre DB, ejecuta schema y seed al arrancar
  schema.js                # CREATE TABLE / CREATE INDEX (función runSchema)
  seed.js                  # Datos iniciales: institución, cursos, roles, permisos, admin
middleware/
  auth.js                  # verifyToken — JWT Bearer → req.user
  permission.js            # requirePermiso(codigo) — 403 si no tiene el permiso
routes/
  auth.js                  # POST /api/auth/login  GET /api/auth/me  (implementado)
  cursos.js                # GET /api/cursos        (implementado — devuelve cursos activos)
  estudiantes.js           # /api/estudiantes       (skeleton 501)
  asistencias.js           # /api/asistencias       (skeleton 501)
  usuarios.js              # /api/usuarios          (skeleton 501)
  roles.js                 # /api/roles             (GET implementado, resto 501)
  planificaciones.js       # /api/planificaciones   (skeleton 501)
  periodos.js              # /api/periodos          (skeleton 501)
  reportes.js              # /api/reportes          (skeleton 501)
  backup.js                # /api/backup            (skeleton 501)
public/
  index.html               # React 18 SPA (CDN + Babel standalone, mobile-first)
epm.db                     # SQLite con WAL mode + foreign keys
escuela_v1.db              # Backup del DB anterior (v1 monolítica)
```

## Modelo de datos

**instituciones** → **cursos**, **materias** (futuro), **usuarios**, **estudiantes**, **periodos_planificacion**, **ciclos_lectivos**

**roles** (globales o por institución) ↔ **permisos** via **roles_permisos**  
**usuarios** → rol_id (un rol), institucion_id  
**usuarios** ↔ **cursos** via **usuarios_cursos** (materia_id nullable para UNSAM futuro)  
**usuarios** ↔ **estudiantes** via **usuarios_estudiantes** (futuro acceso padres)

**asistencias** — `tipo_asistencia: 'general'|'materia'`, materia_id NULL para EPM.  
Índices parciales únicos: uno por (estudiante, fecha) para general, otro por (estudiante, fecha, materia) para materia.

**planificaciones** → curso + docente + periodo + materia_id (NULL para EPM)  
**planificacion_contenidos** → planificacion_id + orden (ítems ordenables)

**ciclos_lectivos** → **semestres** (1 y 2, para reportes de asistencia)  
**periodos_planificacion** — independientes de los semestres

## Sistema de permisos

Roles de sistema (es_sistema=1): **Gestión**, **Operador**, **Docente**.  
13 permisos en catálogo `permisos`, agrupados por: `estudiantes`, `asistencias`, `reportes`, `planificaciones`, `administracion`.

Los permisos van en el JWT payload (`user.permisos[]`). El backend los verifica con `requirePermiso(codigo)` en cada ruta. El frontend los usa para mostrar/ocultar secciones del menú.

## Auth flow

`POST /api/auth/login` → devuelve `{ token, user: { id, nombre, email, rol_id, rol_nombre, institucion_id, institucion_nombre, permisos[] } }`.  
Token se guarda en `localStorage.epm_token`. `localStorage.epm_user` guarda el objeto user.  
`apiFetch(url, opts)` en el frontend inyecta `Authorization: Bearer` automáticamente.

## Cómo agregar un módulo nuevo

1. Implementar la lógica en `routes/<modulo>.js` (ya existe con sus rutas skeleton)
2. Agregar el componente React en `public/index.html` en el `switch` del Layout
3. No tocar server.js ni la estructura existente

## Environment variables (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `JWT_SECRET` | fallback string | JWT signing key |
| `JWT_EXPIRES_IN` | `24h` | Token lifetime |
| `DB_PATH` | `./epm.db` | SQLite file path |

## Node version requirement

`node:sqlite` requiere **Node 22+**. El proyecto corre en Node 24.
