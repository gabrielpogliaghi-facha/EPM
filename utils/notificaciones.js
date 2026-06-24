function formatFechaES(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function notificarCambioEvento(db, evento, tipoAccion, motivo, nuevaFecha, nuevaHoraInicio) {
  try {
    let usuarios;
    if (evento.alcance === 'institucion') {
      const { rows } = await db.execute({
        sql: 'SELECT id, nombre FROM usuarios WHERE institucion_id=? AND activo=1',
        args: [evento.institucion_id],
      });
      usuarios = rows;
    } else {
      const { rows: cursoRows } = await db.execute({
        sql: 'SELECT curso_id FROM evento_cursos WHERE evento_id=?',
        args: [evento.id],
      });
      const cursosIds = cursoRows.map(r => Number(r.curso_id));
      if (!cursosIds.length) {
        const { rows } = await db.execute({
          sql: `SELECT DISTINCT u.id, u.nombre FROM usuarios u
                JOIN roles_permisos rp ON rp.rol_id = u.rol_id
                JOIN permisos p ON p.id = rp.permiso_id
                WHERE u.institucion_id=? AND u.activo=1 AND p.codigo='administrar_cursos'`,
          args: [evento.institucion_id],
        });
        usuarios = rows;
      } else {
        const ph = cursosIds.map(() => '?').join(',');
        const { rows } = await db.execute({
          sql: `SELECT DISTINCT u.id, u.nombre FROM usuarios u
                WHERE u.activo=1 AND u.institucion_id=? AND (
                  EXISTS (SELECT 1 FROM usuarios_cursos uc WHERE uc.usuario_id=u.id AND uc.curso_id IN (${ph}))
                  OR EXISTS (
                    SELECT 1 FROM roles_permisos rp JOIN permisos p ON rp.permiso_id=p.id
                    WHERE rp.rol_id=u.rol_id AND p.codigo='administrar_cursos'
                  )
                )`,
          args: [evento.institucion_id, ...cursosIds],
        });
        usuarios = rows;
      }
    }

    const accion    = tipoAccion === 'cancelado' ? 'cancelado' : 'reprogramado';
    const tipoNotif = tipoAccion === 'cancelado' ? 'danger' : 'warning';
    const titulo    = `Evento ${accion}: ${evento.titulo}`;
    const fechaStr  = formatFechaES(evento.fecha);
    let mensaje = `El evento "${evento.titulo}" del ${fechaStr} fue ${accion}. Motivo: ${motivo}.`;
    if (tipoAccion === 'reprogramado' && nuevaFecha) {
      mensaje += ` Nueva fecha: ${formatFechaES(nuevaFecha)}${nuevaHoraInicio ? ' a las ' + nuevaHoraInicio : ''}.`;
    }

    for (const u of usuarios) {
      try {
        await db.execute({
          sql: 'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, entidad_tipo, entidad_id) VALUES (?,?,?,?,?,?)',
          args: [u.id, titulo, mensaje, tipoNotif, 'evento', evento.id],
        });
      } catch(e) { console.error('Error creando notif para usuario', u.id, e.message); }
    }
  } catch(e) {
    console.error('Error en notificarCambioEvento:', e.message);
  }
}

module.exports = { notificarCambioEvento };
