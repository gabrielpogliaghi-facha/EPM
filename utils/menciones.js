// ── MENCIONES (@usuario) ─────────────────────────────────────────────────────
// Las menciones se guardan como texto plano dentro del campo de texto
// (resumen / descripción / observación): "...avisale a @Laura Martínez que...".
// No hay marcado especial en la DB — se detectan comparando el texto contra
// los nombres completos de los usuarios activos de la institución. El picker
// del frontend es la única forma de insertarlas, así que el nombre siempre
// coincide exactamente con el de la lista de usuarios.

function nombreCompleto(u) {
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim();
}

// Devuelve los ids (Number) de usuarios mencionados en el texto.
function extraerMenciones(texto, usuarios) {
  if (!texto) return [];
  const candidatos = (usuarios || [])
    .map(u => ({ id: Number(u.id), nombre: nombreCompleto(u) }))
    .filter(u => u.nombre)
    .sort((a, b) => b.nombre.length - a.nombre.length); // más largos primero (evita matches parciales)
  if (candidatos.length === 0) return [];

  const encontrados = new Set();
  for (const c of candidatos) {
    const escaped = c.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, 'u');
    if (re.test(texto)) encontrados.add(c.id);
  }
  return [...encontrados];
}

// Ids mencionados en `textoNuevo` que NO estaban ya en `textoAnterior` (evita
// re-notificar en cada edición si la mención ya estaba desde antes). Excluye
// al propio autor.
function nuevasMenciones(usuarios, textoAnterior, textoNuevo, autorId) {
  const antes = new Set(extraerMenciones(textoAnterior || '', usuarios));
  return extraerMenciones(textoNuevo || '', usuarios)
    .filter(id => !antes.has(id) && id !== Number(autorId));
}

async function crearNotificacionesMenciones(db, ids, { titulo, mensaje, entidadTipo, entidadId, tipo }) {
  for (const uid of ids) {
    try {
      await db.execute({
        sql: 'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, entidad_tipo, entidad_id) VALUES (?,?,?,?,?,?)',
        args: [uid, titulo, mensaje, tipo || 'info', entidadTipo, entidadId],
      });
    } catch(e) { console.error('Error creando notificación de mención para', uid, e.message); }
  }
}

module.exports = { extraerMenciones, nuevasMenciones, crearNotificacionesMenciones };
