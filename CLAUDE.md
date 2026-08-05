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
| 20 | **Perfil unificado Docentes → Usuarios** | 2026-08-04 | Se elimina el modelo separado `docentes`/`docente_instrumentos`: el perfil extendido (apellido, dni, fecha_nacimiento, teléfono, foto, instrumentos, formación, `instrumento_principal_id`) pasa a vivir directamente en `usuarios` + nueva tabla `usuario_instrumentos`. Migración automática e idempotente en `runSchema` (copia datos viejos y dropea las tablas legacy; las recrea vacías por compatibilidad). Nuevo componente `PerfilUsuario` reutilizado por "Equipo Docente" y por "Usuarios y Roles". Nuevos endpoints `GET/PUT /api/usuarios/:id`, `PUT /api/usuarios/:id/perfil`, `POST /api/usuarios/:id/foto`. `routes/docentes.js` quedó sin montar en `server.js` (deprecado). Invitaciones ahora también puede completar perfil/instrumentos al aceptar. |
| 21 | **Reuniones** | 2026-08-04 | Registro de reuniones institucionales: fecha/hora, motivo, participantes (selector de usuarios del sistema), resumen tipo WhatsApp con emoji picker. Listado cronológico con filtros por fecha/participante/texto, detalle con copiar texto plano e imprimir/PDF. Cualquier usuario con `ver_reuniones` puede ver; `crear_reuniones` para crear; edición permitida a Gestión/Operador (`editar_reuniones`) o a cualquier participante de esa reunión puntual. Widget "Última reunión" en el Dashboard. Tablas `reuniones` + `reunion_participantes`. |
| 22 | **Fix crítico: código muerto rompía toda la app** | 2026-08-05 | El refactor del módulo 20 había dejado ~475 líneas de código muerto (el viejo `ModalNuevoDocente` sin su línea de declaración + un `Docentes`/`FichaDocente` duplicados) intercaladas antes del componente real de Inventario. Esto rompía el parseo de **todo** el script de `index.html` (`'return' outside of function'` en Babel), dejando la SPA completamente en blanco. Detectado recién al probar en un navegador real (los tests vía `curl`/API no lo detectan porque no ejecutan el frontend). Eliminado el bloque completo. **Lección: después de cualquier refactor grande en `index.html`, probar en un navegador real (consola sin errores), no alcanza con probar los endpoints.** |
| 23 | **@Menciones** | 2026-08-05 | Menciones de usuarios (`@Nombre Apellido`) en el resumen de reuniones, en "Observaciones generales" del legajo personal y en las observaciones de asistencia. Se guardan como texto plano dentro del mismo campo (sin marcado especial) — se detectan comparando contra los nombres completos de usuarios activos de la institución, tanto en frontend (chips) como en backend (notificaciones). Picker mobile-first: al escribir "@" aparece un dropdown filtrable (`MencionInput`, reutilizable como textarea o input); al seleccionar inserta `@Nombre Apellido` en el cursor. Render de menciones como chips clickeables (`MencionesTexto`/`MencionChip`, con tooltip mostrando el rol). Al guardar, cada usuario mencionado *nuevo* (no notifica de nuevo si la mención ya estaba antes de editar) recibe una notificación in-app; click en la notificación navega directo a la reunión / ficha del estudiante correspondiente. Endpoint `GET /api/usuarios/mencionables` (cualquier usuario autenticado). Lógica de detección/diff compartida en `utils/menciones.js` (backend) y duplicada en JS de frontend (misma regex por nombre completo). |
| 24 | **Tanda de 9 correcciones/mejoras** | 2026-08-05 | (1) **Mostrar contraseña**: componente `PasswordInput` reutilizable (ojito 👁/🙈) usado en los 7 campos de contraseña del sistema (login, invitación, cambio de contraseña propio y por admin, reset). (2) **Eventos multi-día**: columna `eventos.fecha_fin` (backfill = `fecha` para eventos viejos); `ModalEvento` pide "Fecha inicio"/"Fecha fin"; el calendario expande cada evento a todos los días de su rango (`fechasEnRango`) y dibuja los días intermedios como una barrita conectada (`.evtcal-chip/dot.multi-start/mid/end`); reprogramar preserva la duración. (3)-(4) **Teléfono estudiante + DNI/teléfono tutor**: columnas `estudiantes.telefono` y `estudiantes.tutor_telefono` (`tutor_dni` ya existía), ninguno obligatorio; agregados a Identidad y Familia/Tutor en la Ficha, a la plantilla/import/export CSV. (5) **Navegación atrás mobile**: hook `useHashSection` sincroniza la sección activa del `Layout` con `location.hash` (`#/seccion`) — el botón atrás del navegador ahora navega entre secciones dentro de la SPA en vez de salir. La mayoría de las vistas de detalle (Ficha, Reuniones, Proyectos, Planificaciones) ya tenían botón "← Volver"/"← Lista" explícito. (6) **Reporte por nivel**: nuevo endpoint `GET /api/reportes/nivel?curso_id=` + tab "🏫 Por nivel / curso" dentro de Reportes (`ReportePorNivel`). Por estudiante: nivel·instrumento, contacto, % asistencia y una fila de indicadores de completitud (`CAMPOS_COMPLETITUD`: DNI, fecha nac., teléfono, tutor, tel. tutor, dirección, foto) — cada indicador faltante (❌) es clickeable y navega a la Ficha (reusa el mecanismo `deepLink`/`onNavigate` ya usado por las notificaciones). Exportable a CSV. (7) **Instrumentos Teclado/Chancha**: migración idempotente en `runSchema` + agregado a la lista inicial del seed. (8) **Prioridad nivel > instrumento**: en listados, tags, panel de inscripciones y títulos de sección se muestra siempre "Nivel · Instrumento" (antes era al revés en varios lugares). (9) **Tabs Legajo personal en mobile**: `.ficha-tab-bar`/`.ficha-tab-btn` reforzados con `min-height:44px` (touch target), `touch-action:manipulation` (evita el delay de 300ms / dobles-tap que puede leerse como "no responde" en mobile), `white-space:nowrap` + `text-overflow:ellipsis` para que el texto largo no rompa el layout, y `overflow-x:auto` como red de seguridad. |
| 25 | **Fix: inscripciones multi-nivel** | 2026-08-05 | El `UNIQUE(estudiante_id, instrumento_id)` original impedía dos cosas legítimas: (a) re-agregar un instrumento después de borrarlo (el soft delete dejaba el registro inactivo bloqueando el alta) y (b) tener el mismo instrumento en dos niveles a la vez (ej: Mojarrita de Guitarra y Delfín de Guitarra simultáneamente, por transición o repitencia). Se reemplaza por un índice único **parcial**: `idx_inscripciones_activa ON inscripciones(estudiante_id, instrumento_id, curso_id) WHERE activo=1` — solo bloquea la inscripción activa idéntica (mismo estudiante+instrumento+curso). Migración recrea la tabla (SQLite no permite dropear un UNIQUE inline). Frontend (`InscripcionesPanel`): ya no oculta del selector los instrumentos que el estudiante ya tiene en otro nivel; si hay coincidencia con otro nivel muestra una advertencia ámbar no bloqueante y deja continuar. |
| 26 | **Perfil personal de usuario ("Mi perfil")** | 2026-08-05 | Autoservicio de perfil para cualquier usuario logueado, reutilizando el componente `PerfilUsuario` (antes solo usado por Gestión/Equipo Docente para editar a otros). Acceso: nuevo ítem "👤 Mi perfil" en `NAV_GROUPS` (arriba de todo, sin permiso requerido) y el bloque de usuario en el pie del sidebar ahora es clickeable (`onSection('mi-perfil')`), mostrando la foto real si existe. Editable por el propio usuario: nombre, apellido, email, DNI, fecha de nacimiento, teléfono, foto (subir/cambiar/**quitar**, antes no se podía quitar) y, si es Docente, instrumento principal/otros instrumentos/formación. Solo-lectura: rol, cursos asignados, fecha de registro ("Usuario desde"). Aviso de cambios sin guardar (`.dirty-bar`, mismo patrón que la Ficha de estudiante) comparando `form` vs `savedForm`. **Cambio de contraseña propio**: nuevo endpoint `PUT /api/usuarios/:id/mi-password` — a diferencia de `PUT /:id/password` (solo admin, resetea sin pedir la actual, usado por Usuarios y Roles para resetear la de otros), esta ruta exige `password_actual` y la valida con `bcrypt.compareSync` antes de permitir el cambio, sin importar el rol (incluso Gestión debe dar su contraseña actual para cambiar la propia). El botón "🔑 Contraseña" en `PerfilUsuario` ahora es visible también para el dueño del perfil (antes solo para admins, dejando a los demás sin forma de cambiar su propia contraseña). `PUT /:id/perfil` ahora también acepta `nombre`/`email` (antes solo campos extendidos) con validación de `UNIQUE` en email. Nuevo endpoint `DELETE /api/usuarios/:id/foto`. `GET /api/auth/login` y `GET /api/auth/me` ahora incluyen `foto_path` en el payload/JWT para que el sidebar muestre la foto sin esperar a un refresh manual. Tras guardar cambios propios (nombre/foto), `App()` expone `onUserUpdate(patch)` que mergea el cambio en el `user` de memoria + `localStorage.epm_user` sin necesitar re-login, y se propaga por `Layout` → `PerfilUsuario` vía prop `onSelfUpdate`. |

### Estado general

**Sistema completo sin dependencia de email. Invitaciones por link. Equipo docente unificado dentro de Usuarios. Reuniones institucionales con acta tipo WhatsApp y @menciones con notificaciones. Finanzas en estructura. Navegación con historial (hash routing) para mobile. Reporte por nivel/curso con completitud de datos. Inscripciones multi-nivel (mismo instrumento en niveles distintos). Autoservicio de perfil personal ("Mi perfil") con cambio de contraseña propio.**

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
- **Perfil unificado (Docentes → Usuarios)**: las columnas de perfil viven ahora en `usuarios` (no en una tabla `docentes` aparte). `usuario_instrumentos(usuario_id, instrumento_id)` reemplaza a `docente_instrumentos`. La migración en `runSchema` es tolerante a estados previos: agrega `instrumento_principal_id` a la vieja tabla `docentes` si faltaba (bug corregido — sin esa columna la migración fallaba silenciosamente y dejaba `docentes` sin dropear) antes de copiar los datos y borrar las tablas legacy. `docentes`/`docente_instrumentos` se recrean vacías después del drop solo por compatibilidad hacia atrás; `routes/docentes.js` ya no está montado en `server.js`. El componente `PerfilUsuario` en el frontend es compartido entre "Equipo Docente" (filtra `?rol=Docente`) y "Usuarios y Roles".
- **Reuniones**: tabla `reuniones` (fecha, hora, motivo, resumen, created_by) + `reunion_participantes(reunion_id, usuario_id)`. Permisos `ver_reuniones` / `crear_reuniones` / `editar_reuniones`. Puede editar una reunión puntual quien tenga `editar_reuniones` **o** sea uno de sus participantes (`puedeEditar()` en `routes/reuniones.js`); el creador siempre queda agregado como participante. `GET /api/reuniones` soporta filtros `fecha_inicio`, `fecha_fin`, `participante_id`, `q` (busca en motivo y resumen). El resumen es un textarea libre con picker de emojis (`EmojiPicker`) que inserta en la posición del cursor — no hay editor de texto enriquecido, es texto plano + emoji, al estilo WhatsApp. `GET /api/reuniones/ultima` alimenta el widget del Dashboard.
- **@Menciones**: no hay marcado especial guardado en DB — una mención es literalmente el texto `@Nombre Apellido` dentro del campo (resumen / descripción de legajo / observación de asistencia), y se detecta comparando contra los nombres completos de usuarios activos de la institución (`utils/menciones.js` en el backend; misma lógica reimplementada en JS de frontend para el render de chips, ver `parseMenciones`/`extraerMenciones`). Esto evita cambios de schema pero implica dos riesgos aceptados a esta escala: (1) si dos usuarios comparten nombre y apellido exactos, la mención es ambigua; (2) solo se detectan menciones insertadas por el picker (`MencionInput`) o escritas con el nombre exacto — no hay tolerancia a typos ni variaciones de mayúsculas. `nuevasMenciones()` compara texto anterior vs. nuevo para notificar **solo menciones agregadas**, no en cada re-guardado sin cambios. Componentes de frontend: `MencionInput` (textarea o input con dropdown filtrable, mobile-first — dropdown ancla debajo del campo, no sigue el caret), `MencionesTexto`/`MencionChip` (render de solo-lectura, chip clickeable con tooltip de rol), `useMencionables()` (hook que trae `/api/usuarios/mencionables`). Habilitado en: resumen de reuniones, "Observaciones generales" del legajo (no en salud/trayectoria), observación de asistencia (alta en Tomar Asistencia + edición individual). Notificaciones usan `entidad_tipo`/`entidad_id` ya existentes en la tabla `notificaciones`: `'reunion'`→id de la reunión, `'legajo'`/`'asistencia'`→id del estudiante. Click en la notificación navega vía `deepLink` (estado en `Layout`, prop pasada a `Reuniones`/`Estudiantes`) — `Estudiantes` abre la `Ficha` en el tab correspondiente (`legajo` o `datos`) y `Reuniones` abre el detalle directo.
- **Bug histórico importante**: un refactor previo dejó ~475 líneas de código muerto (función sin su línea de `function`, componentes duplicados) que rompían el parseo de **todo** `index.html` sin que ningún test de backend lo detectara. Desde entonces, cualquier cambio grande en `index.html` se valida cargando la página en un navegador real y revisando la consola (no alcanza con probar los endpoints vía `curl`).
- **Eventos multi-día**: `eventos.fecha` sigue siendo la fecha de inicio (nombre de columna sin cambios para no romper índices/queries existentes); `fecha_fin` es la nueva columna (nullable en la migración, con backfill = `fecha`). El backend siempre persiste `fecha_fin = fecha_fin || fecha` así nunca queda NULL en filas nuevas. `GET /api/eventos` no cambió su forma de filtrar por rango (`e.fecha BETWEEN`), así que un evento multi-día "aparece" en la consulta por su fecha de inicio — es el frontend (`Calendario`) el que expande el rango día por día (`fechasEnRango`) para pintarlo en cada celda del mes.
- **Navegación con historial (mobile)**: `useHashSection()` en `Layout` reemplaza el `useState('dashboard')` plano — sincroniza la sección activa con `location.hash` (`#/seccion`) escuchando `hashchange`. Cada `setSection(id)` hace `location.hash = '/'+id`, lo que agrega una entrada al historial del navegador; el botón atrás dispara `hashchange` y vuelve a la sección anterior sin salir de la SPA. Es navegación de **primer nivel** (sidebar) — el detalle dentro de cada sección (ficha abierta, reunión abierta) sigue siendo estado local de ese componente y no todos tienen entrada propia en el historial; se cubre en su lugar con botones "← Volver"/"← Lista" explícitos (la mayoría ya existían antes de esta tanda: Ficha, Reuniones, Proyectos, Planificaciones).
- **Reporte por nivel**: `GET /api/reportes/nivel?curso_id=` (opcional; sin filtro trae todos los estudiantes activos). No usa el `estudiantes.curso_id` deprecated — arma la lista de estudiantes vía `inscripciones` igual que `GET /api/estudiantes`, y la asistencia se agrega **por estudiante** (no por inscripción), sobre el histórico completo de `asistencias` sin filtro de fecha (a diferencia del reporte de asistencia por semestre/rango). Si un estudiante tiene más de una inscripción (varios instrumentos), aparece una sola fila con todas sus inscripciones listadas. La completitud de datos (`CAMPOS_COMPLETITUD` en el frontend) es puramente de presentación — no hay un campo "completitud" persistido, se recalcula en cada render a partir de los mismos campos que ya trae la fila.
- **Inscripciones**: la unicidad ya no es `(estudiante_id, instrumento_id)` sino un índice único **parcial** `(estudiante_id, instrumento_id, curso_id) WHERE activo=1` (`idx_inscripciones_activa`). Esto es intencional: el mismo instrumento puede repetirse en niveles distintos para el mismo estudiante; lo único prohibido es la inscripción activa exactamente duplicada. Las filas inactivas (soft-deleted) nunca cuentan para la unicidad, así que borrar y volver a agregar el mismo instrumento+nivel siempre funciona.
- **Cambio de contraseña propio vs. reseteo por admin**: son dos rutas separadas a propósito. `PUT /api/usuarios/:id/mi-password` es exclusiva de `esPropio` (`req.user.id === id`) y **siempre** exige `password_actual` (verificada con `bcrypt.compareSync`), sin importar el rol — ni Gestión puede saltearse este paso para su propia contraseña. `PUT /api/usuarios/:id/password` (admin-only, sin chequeo de actual) sigue existiendo tal cual para que Gestión/Operador puedan resetear la contraseña de **otro** usuario que la olvidó. `PerfilUsuario` decide cuál llamar según `esPropio`.
- **"Mi perfil"**: el componente `PerfilUsuario` (ya existente para uso admin) ahora también se usa en modo autoservicio vía la sección `mi-perfil` del `Layout` (`usuarioId={user.id}`). Como el token JWT no se refresca solo, los cambios propios de nombre/foto se reflejan al instante en el sidebar gracias a `App().onUserUpdate(patch)`, que mergea el cambio en el `user` de memoria + `localStorage.epm_user` — no reemplaza el token (los permisos siguen requiriendo re-login si cambian, sin cambios respecto al comportamiento previo). `login` y `GET /auth/me` incluyen `foto_path` en el payload por este motivo.

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
