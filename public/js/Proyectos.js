// ── PROYECTOS ────────────────────────────────────────────────────────────────────
const PROY_ESTADOS = {
  borrador:'Borrador', en_curso:'En curso', presentado:'Presentado',
  aprobado:'Aprobado', rechazado:'Rechazado', finalizado:'Finalizado',
};
const PROY_ICONOS = {
  borrador:'✏️', en_curso:'🔄', presentado:'📤', aprobado:'✅', rechazado:'❌', finalizado:'🏁',
};

function Proyectos({ user }) {
  const puede = (p) => user.permisos?.includes(p);
  const [lista,    setLista]   = useState([]);
  const [filtroEst,setFiltroEst] = useState('');
  const [cargando, setCargando] = useState(true);
  const [detalleId,setDetalleId] = useState(null);
  const [modalNuevo,setModalNuevo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const url = filtroEst ? `/api/proyectos?estado=${filtroEst}` : '/api/proyectos';
      setLista(await apiFetch(url));
    } catch(e) {}
    finally { setCargando(false); }
  }, [filtroEst]);
  useEffect(() => { cargar(); }, [cargar]);

  if (detalleId) return <DetalleProy proyId={detalleId} user={user} puede={puede}
    onVolver={() => { setDetalleId(null); cargar(); }} />;

  return (
    <div>
      <div className="section-header">
        <h2 style={{fontSize:18,fontWeight:800}}>📁 Proyectos</h2>
        {puede('editar_proyectos') && (
          <button className="btn btn-primary btn-auto" onClick={() => setModalNuevo(true)}>+ Nuevo proyecto</button>
        )}
      </div>
      <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto'}}>
        {[['','Todos'],['borrador','Borrador'],['en_curso','En curso'],
          ['presentado','Presentado'],['aprobado','Aprobado'],
          ['rechazado','Rechazado'],['finalizado','Finalizado']].map(([k,v]) => (
          <button key={k} className={`curso-tab ${filtroEst===k?'active':''}`} onClick={()=>setFiltroEst(k)}>{v}</button>
        ))}
      </div>
      {cargando ? <div className="spinner"><div className="spin"/></div>
        : lista.length === 0
        ? <div className="empty-state"><div className="empty-state-icon">📁</div><div>No hay proyectos</div></div>
        : lista.map(p => (
            <div key={p.id} className="proy-card" onClick={() => setDetalleId(p.id)}>
              <div className="proy-card-titulo">{PROY_ICONOS[p.estado]} {p.titulo}</div>
              <div className="proy-card-meta">
                <span className={`proy-badge proy-estado-${p.estado}`}>{PROY_ESTADOS[p.estado]}</span>
                {p.destino && <span>📍 {p.destino}</span>}
                {p.fecha_presentacion && <span>📅 {formatFechaCalendario(p.fecha_presentacion)}</span>}
                <span style={{marginLeft:'auto',color:'var(--text2)'}}>{p.creado_por_nombre}</span>
              </div>
            </div>
          ))
      }
      {modalNuevo && (
        <ModalProy onClose={() => setModalNuevo(false)}
          onGuardado={(p) => { setModalNuevo(false); setDetalleId(p.id); }} />
      )}
    </div>
  );
}

function ModalProy({ proyecto, onClose, onGuardado }) {
  const [form, setForm] = useState({
    titulo:             proyecto?.titulo || '',
    descripcion:        proyecto?.descripcion || '',
    estado:             proyecto?.estado || 'borrador',
    fecha_presentacion: proyecto?.fecha_presentacion || '',
    destino:            proyecto?.destino || '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const method = proyecto?.id ? 'PUT' : 'POST';
      const url    = proyecto?.id ? `/api/proyectos/${proyecto.id}` : '/api/proyectos';
      const data   = await apiFetch(url, { method, body: form });
      onGuardado(data);
    } catch(err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{proyecto?.id ? 'Editar proyecto' : 'Nuevo proyecto'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-control" value={form.titulo} onChange={e=>set('titulo',e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" rows={4} value={form.descripcion} onChange={e=>set('descripcion',e.target.value)}
              placeholder="Descripción detallada del proyecto..." />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-control" value={form.estado} onChange={e=>set('estado',e.target.value)}>
                {Object.entries(PROY_ESTADOS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de presentación</label>
              <input className="form-control" type="date" value={form.fecha_presentacion} onChange={e=>set('fecha_presentacion',e.target.value)} />
            </div>
            <div className="form-group col-full">
              <label className="form-label">Destino de presentación</label>
              <input className="form-control" value={form.destino} onChange={e=>set('destino',e.target.value)}
                placeholder="Ej: Municipalidad de San Martín, Ministerio de Cultura..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-auto" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
              {saving ? 'Guardando...' : proyecto?.id ? 'Guardar cambios' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetalleProy({ proyId, user, puede, onVolver }) {
  const [proy,    setProy]    = useState(null);
  const [cargando,setCargando]= useState(true);
  const [editando,setEditando]= useState(false);
  const [subiendo,setSubiendo]= useState(false);
  const [error,   setError]   = useState('');

  const cargar = useCallback(async () => {
    try { setProy(await apiFetch(`/api/proyectos/${proyId}`)); }
    catch(e) { setError(e.message); }
    finally { setCargando(false); }
  }, [proyId]);
  useEffect(() => { cargar(); }, [cargar]);

  const subirAdjunto = async (file) => {
    if (!file) return; setSubiendo(true);
    try {
      const fd = new FormData(); fd.append('archivo', file);
      const token = localStorage.getItem('epm_token');
      const res = await fetch(`/api/proyectos/${proyId}/adjuntos`, {
        method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      cargar();
    } catch(e) { alert(e.message); }
    finally { setSubiendo(false); }
  };

  const eliminarAdjunto = async (adjId) => {
    if (!confirm('¿Eliminar adjunto?')) return;
    try { await apiFetch(`/api/proyectos/${proyId}/adjuntos/${adjId}`, { method:'DELETE' }); cargar(); }
    catch(e) { alert(e.message); }
  };

  if (cargando) return <div className="spinner"><div className="spin"/></div>;
  if (!proy)    return <div className="alert alert-error">{error || 'Proyecto no encontrado'}</div>;

  return (
    <div style={{maxWidth:720,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
        <button className="btn btn-secondary btn-auto" onClick={onVolver}>← Volver</button>
        <h2 style={{fontSize:18,fontWeight:800,flex:1}}>{proy.titulo}</h2>
        {puede('editar_proyectos') && (
          <button className="btn btn-secondary btn-auto" onClick={() => setEditando(true)}>✏️ Editar</button>
        )}
      </div>
      <div className="ficha-section">
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
          <span className={`proy-badge proy-estado-${proy.estado}`}>{PROY_ICONOS[proy.estado]} {PROY_ESTADOS[proy.estado]}</span>
          {proy.fecha_presentacion && <span style={{fontSize:13,color:'var(--text2)'}}>📅 {formatFechaCalendario(proy.fecha_presentacion)}</span>}
          {proy.destino && <span style={{fontSize:13,color:'var(--text2)'}}>📍 {proy.destino}</span>}
        </div>
        {proy.descripcion && <p style={{fontSize:14,lineHeight:1.7,color:'var(--text)',whiteSpace:'pre-wrap'}}>{proy.descripcion}</p>}
      </div>

      {/* Adjuntos */}
      <div className="ficha-section">
        <div className="ficha-section-title" style={{justifyContent:'space-between'}}>
          📎 Archivos adjuntos
          {puede('editar_proyectos') && (
            <label style={{cursor:'pointer',color:'var(--primary)',fontSize:12,fontWeight:700}}>
              {subiendo ? 'Subiendo...' : '+ Subir archivo'}
              <input type="file" style={{display:'none'}} accept=".pdf,.doc,.docx,.odt,.jpg,.png"
                onChange={e => e.target.files[0] && subirAdjunto(e.target.files[0])} />
            </label>
          )}
        </div>
        {proy.adjuntos?.length === 0
          ? <div style={{color:'var(--text2)',fontSize:13}}>Sin archivos adjuntos</div>
          : proy.adjuntos?.map(adj => (
              <div key={adj.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:18}}>{adj.mime_type?.includes('pdf') ? '📄' : adj.mime_type?.startsWith('image') ? '🖼' : '📝'}</span>
                <a href={adj.path} target="_blank" style={{flex:1,fontSize:13,color:'var(--primary)',fontWeight:600}}>{adj.nombre}</a>
                {puede('editar_proyectos') && (
                  <button className="btn-icon btn-icon-danger" onClick={() => eliminarAdjunto(adj.id)}>🗑</button>
                )}
              </div>
            ))
        }
      </div>

      {/* Historial */}
      <div className="ficha-section">
        <div className="ficha-section-title">🕐 Historial de estados</div>
        {proy.historial?.map((h, i) => (
          <div key={i} className="tl-item">
            <div className="tl-dot" style={{background: h.estado === 'aprobado' ? 'var(--success)' : h.estado === 'rechazado' ? 'var(--danger)' : 'var(--primary)'}} />
            <div className="tl-body">
              <div className="tl-header">
                <span className={`proy-badge proy-estado-${h.estado}`}>{PROY_ESTADOS[h.estado] || h.estado}</span>
                <span className="tl-fecha">{h.created_at.slice(0,10)}</span>
              </div>
              {h.nota && <div className="tl-desc">{h.nota}</div>}
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <ModalProy proyecto={proy} onClose={() => setEditando(false)}
          onGuardado={() => { setEditando(false); cargar(); }} />
      )}
    </div>
  );
}
