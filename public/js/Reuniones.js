// ── REUNIONES ─────────────────────────────────────────────────────────────────────
const EMOJIS_REUNION = ['😊','👍','🎉','📌','✅','❌','⚠️','💡','📝','🎵','🎸','🥁','🎤','🎹',
  '📅','⏰','🙌','🤝','💬','❤️','🔥','😀','🙂','🤔','😅','👏','🚀','⭐','📷','🗒️','✏️','📞'];

function iniciales(nombre, apellido) {
  return `${(nombre||'?')[0]||''}${(apellido||'')[0]||''}`.toUpperCase();
}

function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="emoji-picker-wrap">
      <button type="button" className="emoji-picker-btn" onClick={() => setOpen(o => !o)}>😊</button>
      {open && (
        <div className="emoji-picker-popover">
          {EMOJIS_REUNION.map(em => (
            <button key={em} type="button" className="emoji-picker-item"
              onClick={() => { onPick(em); setOpen(false); }}>{em}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Reuniones({ user, deepLink }) {
  const puede = (p) => user.permisos?.includes(p);
  const [lista,      setLista]      = useState([]);
  const [cargando,   setCargando]   = useState(true);
  const [detalleId,  setDetalleId]  = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [usuarios,   setUsuarios]   = useState([]);
  const [filtros,    setFiltros]    = useState({ fecha_inicio:'', fecha_fin:'', participante_id:'', q:'' });

  useEffect(() => {
    apiFetch('/api/reuniones/participantes-disponibles').then(setUsuarios).catch(() => {});
  }, []);

  // Llegada desde la campanita de notificaciones ("Te mencionaron en la reunión...")
  useEffect(() => {
    if (deepLink?.tipo === 'reunion' && deepLink.id) setDetalleId(deepLink.id);
  }, [deepLink]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k,v]) => { if (v) params.set(k,v); });
      const qs = params.toString();
      setLista(await apiFetch(`/api/reuniones${qs ? `?${qs}` : ''}`));
    } catch(e) {}
    finally { setCargando(false); }
  }, [filtros]);
  useEffect(() => { cargar(); }, [cargar]);

  if (detalleId) return <DetalleReunion reunionId={detalleId} user={user} puede={puede}
    onVolver={() => { setDetalleId(null); cargar(); }} />;

  return (
    <div>
      <div className="section-header">
        <h2 style={{fontSize:18,fontWeight:800}}>🗒️ Reuniones</h2>
        {puede('crear_reuniones') && (
          <button className="btn btn-primary btn-auto" onClick={() => setModalNuevo(true)}>+ Nueva reunión</button>
        )}
      </div>

      <div className="ficha-section">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Desde</label>
            <input type="date" className="form-control" value={filtros.fecha_inicio}
              onChange={e => setFiltros(f => ({...f, fecha_inicio:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Hasta</label>
            <input type="date" className="form-control" value={filtros.fecha_fin}
              onChange={e => setFiltros(f => ({...f, fecha_fin:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Participante</label>
            <select className="form-control" value={filtros.participante_id}
              onChange={e => setFiltros(f => ({...f, participante_id:e.target.value}))}>
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>)}
            </select>
          </div>
          <div className="form-group col-full">
            <label className="form-label">Buscar</label>
            <input className="form-control" value={filtros.q} placeholder="Motivo o texto del acta..."
              onChange={e => setFiltros(f => ({...f, q:e.target.value}))} />
          </div>
        </div>
      </div>

      {cargando ? <div className="spinner"><div className="spin"/></div>
        : lista.length === 0
        ? <div className="empty-state"><div className="empty-state-icon">🗒️</div><div>No hay reuniones registradas</div></div>
        : lista.map(r => (
            <div key={r.id} className="proy-card" onClick={() => setDetalleId(r.id)}>
              <div className="proy-card-titulo">{r.motivo}</div>
              <div className="proy-card-meta">
                <span>📅 {formatFechaCalendario(r.fecha)}{r.hora ? ` · ${formatHora(r.hora)}` : ''}</span>
                <span>👥 {r.participantes_count} participante{r.participantes_count===1?'':'s'}</span>
                {r.resumen_preview && <span style={{flex:'1 1 100%',color:'var(--text2)'}}>{r.resumen_preview}{r.resumen_preview.length>=120?'…':''}</span>}
              </div>
            </div>
          ))
      }

      {modalNuevo && (
        <ModalReunion usuarios={usuarios} user={user} onClose={() => setModalNuevo(false)}
          onGuardado={(r) => { setModalNuevo(false); setDetalleId(r.id); }} />
      )}
    </div>
  );
}

function ModalReunion({ reunion, usuarios, user, onClose, onGuardado }) {
  const [form, setForm] = useState({
    fecha:         reunion?.fecha || new Date().toISOString().slice(0,10),
    hora:          reunion?.hora || '',
    motivo:        reunion?.motivo || '',
    resumen:       reunion?.resumen || '',
    participantes: reunion?.participantes ? reunion.participantes.map(p => p.id) : [user.id],
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k,v) => setForm(f => ({...f, [k]:v}));
  const textareaRef = React.useRef(null);

  const toggleParticipante = (id) => setForm(f => ({
    ...f,
    participantes: f.participantes.includes(id) ? f.participantes.filter(x=>x!==id) : [...f.participantes, id],
  }));

  const insertarEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (!ta) { set('resumen', form.resumen + emoji); return; }
    const start = ta.selectionStart ?? form.resumen.length;
    const end   = ta.selectionEnd ?? form.resumen.length;
    const nuevo = form.resumen.slice(0,start) + emoji + form.resumen.slice(end);
    set('resumen', nuevo);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + emoji.length; });
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const method = reunion?.id ? 'PUT' : 'POST';
      const url    = reunion?.id ? `/api/reuniones/${reunion.id}` : '/api/reuniones';
      const data   = await apiFetch(url, { method, body: form });
      onGuardado(data);
    } catch(err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{reunion?.id ? 'Editar reunión' : 'Nueva reunión'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input type="date" className="form-control" value={form.fecha} onChange={e=>set('fecha',e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Hora</label>
              <input type="time" className="form-control" value={form.hora} onChange={e=>set('hora',e.target.value)} />
            </div>
            <div className="form-group col-full">
              <label className="form-label">Motivo / Asunto *</label>
              <input className="form-control" value={form.motivo} onChange={e=>set('motivo',e.target.value)}
                placeholder="Ej: Reunión de equipo, Planificación del festival..." required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Participantes</label>
            <div className="curso-checks">
              {usuarios.map(u => (
                <button key={u.id} type="button"
                  className={`curso-check-btn ${form.participantes.includes(u.id)?'selected':''}`}
                  onClick={() => toggleParticipante(u.id)}>
                  {u.apellido}, {u.nombre} <span style={{opacity:.6}}>({u.rol_nombre})</span>
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <label className="form-label" style={{marginBottom:0}}>Resumen / Acta</label>
              <EmojiPicker onPick={insertarEmoji} />
            </div>
            <MencionInput inputRef={textareaRef} rows={8} value={form.resumen} usuarios={usuarios}
              onChange={v=>set('resumen',v)}
              placeholder="Escribí el resumen de la reunión, como un mensaje de WhatsApp... (@ para mencionar a alguien)" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-auto" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
              {saving ? 'Guardando...' : reunion?.id ? 'Guardar cambios' : 'Crear reunión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetalleReunion({ reunionId, user, puede, onVolver }) {
  const [reunion,  setReunion]  = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [error,    setError]    = useState('');
  const [copiado,  setCopiado]  = useState(false);

  const cargar = useCallback(async () => {
    try { setReunion(await apiFetch(`/api/reuniones/${reunionId}`)); }
    catch(e) { setError(e.message); }
    finally { setCargando(false); }
  }, [reunionId]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { apiFetch('/api/reuniones/participantes-disponibles').then(setUsuarios).catch(() => {}); }, []);

  if (cargando) return <div className="spinner"><div className="spin"/></div>;
  if (!reunion)  return <div className="alert alert-error">{error || 'Reunión no encontrada'}</div>;

  const puedeEditar = reunion.puede_editar;

  const textoPlano = () => {
    const parts = [
      `🗒️ ${reunion.motivo}`,
      `📅 ${formatFechaCalendario(reunion.fecha)}${reunion.hora ? ` · ${formatHora(reunion.hora)}` : ''}`,
      `👥 ${reunion.participantes.map(p => `${p.nombre} ${p.apellido}`).join(', ')}`,
      '',
      reunion.resumen || '',
    ];
    return parts.join('\n');
  };

  const copiarTexto = async () => {
    try { await navigator.clipboard.writeText(textoPlano()); setCopiado(true); setTimeout(()=>setCopiado(false), 2000); }
    catch(e) { alert('No se pudo copiar el texto'); }
  };

  return (
    <div style={{maxWidth:720,margin:'0 auto'}}>
      <div className="no-print" style={{display:'flex',alignItems:'center',gap:10,marginBottom:18,flexWrap:'wrap'}}>
        <button className="btn btn-secondary btn-auto" onClick={onVolver}>← Volver</button>
        <h2 style={{fontSize:18,fontWeight:800,flex:1}}>{reunion.motivo}</h2>
        <button className="btn btn-secondary btn-auto" onClick={copiarTexto}>{copiado ? '✅ Copiado' : '📋 Copiar texto'}</button>
        <button className="btn btn-secondary btn-auto" onClick={() => window.print()}>🖨 Exportar / PDF</button>
        {puedeEditar && (
          <button className="btn btn-secondary btn-auto" onClick={() => setEditando(true)}>✏️ Editar</button>
        )}
      </div>

      <div className="ficha-section">
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,fontSize:13,color:'var(--text2)'}}>
          <span>📅 {formatFechaCalendario(reunion.fecha)}{reunion.hora ? ` · ${formatHora(reunion.hora)}` : ''}</span>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {reunion.participantes.map(p => (
            <span key={p.id} className="participante-chip">
              <span className="participante-chip-avatar">{iniciales(p.nombre,p.apellido)}</span>
              {p.nombre} {p.apellido}
            </span>
          ))}
        </div>
      </div>

      <div className="ficha-section">
        <div className="ficha-section-title">📝 Resumen / Acta</div>
        {reunion.resumen
          ? <div className="resumen-box"><MencionesTexto texto={reunion.resumen} usuarios={usuarios} /></div>
          : <div style={{color:'var(--text2)',fontSize:13}}>Sin resumen cargado</div>}
      </div>

      {editando && (
        <ModalReunion reunion={reunion} usuarios={usuarios} user={user} onClose={() => setEditando(false)}
          onGuardado={() => { setEditando(false); cargar(); }} />
      )}
    </div>
  );
}
