const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

function formatFechaES(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildEventoEmail(userName, eventoTitulo, accion, motivo, fechaOriginal, nuevaFecha, nuevaHora) {
  const colorAccion = accion === 'cancelado' ? '#ef4444' : '#f59e0b';
  const iconAccion  = accion === 'cancelado' ? '❌' : '📅';
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Evento ${accion} - EPM</title></head>
<body style="margin:0;padding:0;background:#f0f2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,.15);">
        <tr><td style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:28px 40px;text-align:center;">
          <h1 style="color:#a5b4fc;font-size:22px;font-weight:800;margin:0;">EPM</h1>
          <p style="color:rgba(255,255,255,.6);font-size:13px;margin:4px 0 0;">Sistema de Gestión Escolar</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <div style="background:${colorAccion}18;border:1px solid ${colorAccion}40;border-radius:10px;padding:16px;margin-bottom:24px;text-align:center;">
            <div style="font-size:32px;margin-bottom:6px;">${iconAccion}</div>
            <div style="color:${colorAccion};font-weight:700;font-size:15px;text-transform:capitalize;">Evento ${accion}</div>
          </div>
          <h2 style="color:#1e1b4b;font-size:17px;font-weight:700;margin:0 0 12px;">Hola, ${userName}</h2>
          <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 16px;">
            El siguiente evento fue <strong>${accion}</strong>:
          </p>
          <div style="background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;color:#1e1b4b;margin-bottom:6px;">📌 ${eventoTitulo}</div>
            <div style="color:#6b7280;font-size:13px;">Fecha original: ${fechaOriginal}</div>
          </div>
          <p style="color:#4b5563;font-size:14px;margin:0 0 8px;"><strong>Motivo:</strong> ${motivo}</p>
          ${nuevaFecha ? `<p style="color:#4b5563;font-size:14px;margin:8px 0 0;"><strong>Nueva fecha:</strong> ${nuevaFecha}${nuevaHora ? ' a las ' + nuevaHora : ''}</p>` : ''}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#d1d5db;font-size:12px;margin:0;">EPM – Escuela de Música &nbsp;|&nbsp; Sistema de Gestión Escolar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function notificarCambioEvento(db, evento, tipoAccion, motivo, nuevaFecha, nuevaHoraInicio) {
  try {
    let usuarios;
    if (evento.alcance === 'institucion') {
      const { rows } = await db.execute({
        sql: 'SELECT id, nombre, email FROM usuarios WHERE institucion_id=? AND activo=1',
        args: [evento.institucion_id],
      });
      usuarios = rows;
    } else {
      // Usuarios con esos cursos + usuarios con administrar_cursos
      const { rows: cursoRows } = await db.execute({
        sql: 'SELECT curso_id FROM evento_cursos WHERE evento_id=?',
        args: [evento.id],
      });
      const cursosIds = cursoRows.map(r => Number(r.curso_id));
      if (!cursosIds.length) {
        const { rows } = await db.execute({
          sql: `SELECT DISTINCT u.id, u.nombre, u.email FROM usuarios u
                JOIN roles_permisos rp ON rp.rol_id = u.rol_id
                JOIN permisos p ON p.id = rp.permiso_id
                WHERE u.institucion_id=? AND u.activo=1 AND p.codigo='administrar_cursos'`,
          args: [evento.institucion_id],
        });
        usuarios = rows;
      } else {
        const ph = cursosIds.map(() => '?').join(',');
        const { rows } = await db.execute({
          sql: `SELECT DISTINCT u.id, u.nombre, u.email FROM usuarios u
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

    const accion     = tipoAccion === 'cancelado' ? 'cancelado' : 'reprogramado';
    const tipoNotif  = tipoAccion === 'cancelado' ? 'danger' : 'warning';
    const titulo     = `Evento ${accion}: ${evento.titulo}`;
    const fechaStr   = formatFechaES(evento.fecha);
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

    const emailUsers = usuarios.filter(u => u.email);
    for (const u of emailUsers) {
      try {
        await resend.emails.send({
          from: 'EPM Sistema <onboarding@resend.dev>',
          to:   u.email,
          subject: `${titulo} – EPM`,
          html: buildEventoEmail(u.nombre, evento.titulo, accion, motivo, fechaStr,
                                 nuevaFecha ? formatFechaES(nuevaFecha) : null, nuevaHoraInicio),
        });
      } catch(e) { console.error(`Error email a ${u.email}:`, e.message); }
    }
  } catch(e) {
    console.error('Error en notificarCambioEvento:', e.message);
  }
}

module.exports = { notificarCambioEvento };
