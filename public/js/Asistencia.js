// ── HISTORIAL DE ASISTENCIA (sección de Asistencias) ───────────────────────────
function HistorialAsistencia({ user }) {
  const [cursos,      setCursos]      = useState([]);
  const [cursoId,     setCursoId]     = useState('');
  const [estudiantes, setEstudiantes] = useState([]);
  const [estId,       setEstId]       = useState('');
  const [loadingEst,  setLoadingEst]  = useState(false);

  useEffect(() => {
    apiFetch('/api/cursos/mis-cursos')
      .then(cs => { setCursos(cs); if (cs.length===1) setCursoId(String(cs[0].id)); })
      .catch(()=>{});
  }, []);

  useEffect(() => {
    if (!cursoId) { setEstudiantes([]); setEstId(''); return; }
    setLoadingEst(true);
    apiFetch(`/api/estudiantes?curso_id=${cursoId}`)
      .then(es => { setEstudiantes(es); setEstId(es.length>0?String(es[0].id):''); })
      .catch(()=>{})
      .finally(()=>setLoadingEst(false));
  }, [cursoId]);

  const estActual = estudiantes.find(e=>String(e.id)===estId);

  return (
    <div>
      <div className="card" style={{marginBottom:14}}>
        <div className="card-title" style={{marginBottom:12}}>📊 Historial de asistencia</div>
        <div className="form-grid">
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Curso</label>
            <select className="form-control" value={cursoId} onChange={e=>{setCursoId(e.target.value);setEstId('');}}>
              <option value="">-- Seleccionar --</option>
              {cursos.map(c=><option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Estudiante</label>
            <select className="form-control" value={estId} onChange={e=>setEstId(e.target.value)}
              disabled={!cursoId||loadingEst}>
              <option value="">-- Seleccionar --</option>
              {estudiantes.map(e=><option key={e.id} value={String(e.id)}>{e.apellido}, {e.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {estId ? (
        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>
            {estActual && `${estActual.apellido}, ${estActual.nombre}`}
          </div>
          <CalendarioAsistencia estudianteId={Number(estId)} />
        </div>
      ) : cursoId ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p>Seleccioná un estudiante para ver su historial.</p>
        </div>
      ) : null}
    </div>
  );
}

// ── VISTA ASISTENCIAS (contenedor con tabs) ──────────────────────────────────────
function AsistenciasView({ user }) {
  const [tab, setTab] = useState('tomar');
  return (
    <div>
      <div className="curso-tabs" style={{marginBottom:16}}>
        <div className={`curso-tab ${tab==='tomar'?'active':''}`} onClick={()=>setTab('tomar')}>📋 Tomar asistencia</div>
        <div className={`curso-tab ${tab==='historial'?'active':''}`} onClick={()=>setTab('historial')}>📊 Historial</div>
      </div>
      {tab==='tomar' ? <TomarAsistencia user={user} /> : <HistorialAsistencia user={user} />}
    </div>
  );
}

// ── TOMAR ASISTENCIA ────────────────────────────────────────────────────────────
function TomarAsistencia({ user }) {
  const hoy = (() => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  })();

  const [cursos,      setCursos]      = useState([]);
  const [cursoId,     setCursoId]     = useState('');
  const [fecha,       setFecha]       = useState(hoy);
  const [estudiantes, setEstudiantes] = useState([]);
  const [asis,        setAsis]        = useState({});  // { id: { estado, observacion } }
  const [existente,   setExistente]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');
  const mencionables = useMencionables();

  const puede = (p) => user.permisos?.includes(p);

  useEffect(() => {
    apiFetch('/api/cursos/mis-cursos')
      .then(cs => {
        setCursos(cs);
        if (cs.length === 1) setCursoId(String(cs[0].id));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cursoId || !fecha) return;
    setSaved(false); setError('');
    const load = async () => {
      setLoading(true);
      try {
        const [ests, existentes] = await Promise.all([
          apiFetch(`/api/estudiantes?curso_id=${cursoId}`),
          apiFetch(`/api/asistencias?curso_id=${cursoId}&fecha=${fecha}`),
        ]);
        setEstudiantes(ests);
        const map = {};
        existentes.forEach(a => { map[a.estudiante_id] = { estado: a.estado, observacion: a.observacion || '' }; });
        const init = {};
        ests.forEach(e => { init[e.id] = map[e.id] || { estado: '', observacion: '' }; });
        setAsis(init);
        setExistente(existentes.length > 0);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();
  }, [cursoId, fecha]);

  const setEst = (id, estado) => setAsis(prev => ({ ...prev, [id]: { ...prev[id], estado } }));
  const setObs = (id, obs)    => setAsis(prev => ({ ...prev, [id]: { ...prev[id], observacion: obs } }));
  const marcarTodos = (estado) => {
    const next = {};
    estudiantes.forEach(e => { next[e.id] = { ...asis[e.id], estado }; });
    setAsis(next);
  };

  const guardar = async () => {
    const items = estudiantes
      .filter(e => asis[e.id]?.estado)
      .map(e => ({ estudiante_id: e.id, estado: asis[e.id].estado, observacion: asis[e.id].observacion || '' }));

    if (items.length === 0) { setError('Seleccioná el estado de al menos un estudiante.'); return; }

    const sinMarcar = estudiantes.filter(e => !asis[e.id]?.estado).length;
    if (sinMarcar > 0 && !window.confirm(`Quedan ${sinMarcar} estudiante(s) sin marcar. ¿Guardar igual?`)) return;

    setSaving(true); setError('');
    try {
      await apiFetch('/api/asistencias/bulk', {
        method: 'POST',
        body: { curso_id: Number(cursoId), fecha, asistencias: items }
      });
      setSaved(true); setExistente(true);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const stats = { presente: 0, ausente: 0, tarde: 0, sin: 0 };
  estudiantes.forEach(e => {
    const est = asis[e.id]?.estado;
    if      (est === 'presente') stats.presente++;
    else if (est === 'ausente')  stats.ausente++;
    else if (est === 'tarde')    stats.tarde++;
    else                         stats.sin++;
  });

  const cursoNombre = cursos.find(c => String(c.id) === cursoId)?.nombre || '';
  const fechaStr = fecha
    ? new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })
    : '';

  return (
    <div>
      {/* ── Selector de curso y fecha ── */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-title" style={{marginBottom:12}}>📋 Tomar Asistencia</div>
        <div className="form-grid">
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Curso</label>
            <select className="form-control" value={cursoId} onChange={e => setCursoId(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {cursos.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Fecha</label>
            <input className="form-control" type="date" value={fecha}
              onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
        {cursoId && fecha && !loading && (
          <p style={{fontSize:12, color:'var(--text2)', marginTop:8}}>
            {cursoNombre} · {fechaStr}
          </p>
        )}
        {!puede('cargar_asistencias') && cursos.length === 0 && (
          <p style={{fontSize:13, color:'var(--text2)', marginTop:10}}>
            No tenés cursos asignados. Pedile a un administrador que te asigne cursos.
          </p>
        )}
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')} style={{cursor:'pointer'}}>{error}</div>}

      {!cursoId ? null : loading ? (
        <div className="spinner"><div className="spin" /></div>
      ) : saved ? (
        <div className="asis-success">
          <div style={{fontSize:56, marginBottom:8}}>✅</div>
          <h3>¡Asistencia guardada!</h3>
          <p style={{marginTop:6, opacity:.9}}>{cursoNombre} · {fechaStr}</p>
          <p style={{marginTop:4, opacity:.85, fontSize:13}}>
            {stats.presente} presentes · {stats.ausente} ausentes · {stats.tarde} tardes
          </p>
          <button className="btn btn-secondary btn-auto" style={{marginTop:20}}
            onClick={() => setSaved(false)}>
            ← Seguir editando
          </button>
        </div>
      ) : (
        <>
          {existente && (
            <div className="alert alert-warning">
              ✏️ Ya existe asistencia para este día. Editándola.
            </div>
          )}

          {estudiantes.length > 0 && (
            <div className="asis-counter">
              <span style={{color:'var(--success)'}}>✅ {stats.presente}</span>
              <span style={{color:'var(--danger)'}}>❌ {stats.ausente}</span>
              <span style={{color:'#3b82f6'}}>⏰ {stats.tarde}</span>
              {stats.sin > 0 && <span style={{color:'var(--text2)'}}>○ {stats.sin} sin marcar</span>}
              <button style={{marginLeft:'auto', background:'none', border:'none',
                color:'var(--primary)', fontWeight:700, fontSize:12, cursor:'pointer', padding:0}}
                onClick={() => marcarTodos('presente')}>
                Todos presentes →
              </button>
            </div>
          )}

          {estudiantes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <p>No hay estudiantes en este curso.</p>
            </div>
          ) : (
            <>
              {estudiantes.map(e => {
                const a = asis[e.id] || { estado: '', observacion: '' };
                const instrLabel = (e.inscripciones||[])
                  .map(i=>i.instrumento_nombre).join(' / ');
                return (
                  <div key={e.id} className={`asis-row ${a.estado ? 'asis-row-'+a.estado : ''}`}>
                    <div className="asis-nombre">
                      {e.apellido}, {e.nombre}
                      {instrLabel && <span style={{fontSize:11,color:'var(--text2)',marginLeft:6}}>· {instrLabel}</span>}
                    </div>
                    <div className="asis-btns">
                      <button className={`asis-btn asis-presente ${a.estado==='presente'?'sel':''}`}
                        onClick={() => setEst(e.id, 'presente')}>✅ Presente</button>
                      <button className={`asis-btn asis-ausente ${a.estado==='ausente'?'sel':''}`}
                        onClick={() => setEst(e.id, 'ausente')}>❌ Ausente</button>
                      <button className={`asis-btn asis-tarde ${a.estado==='tarde'?'sel':''}`}
                        onClick={() => setEst(e.id, 'tarde')}>⏰ Tarde</button>
                    </div>
                    {(a.estado === 'ausente' || a.estado === 'tarde' || a.observacion) && (
                      <MencionInput as="input" className="asis-obs"
                        placeholder="Observación opcional… (@ para mencionar a alguien)"
                        value={a.observacion} usuarios={mencionables}
                        onChange={v => setObs(e.id, v)} />
                    )}
                  </div>
                );
              })}

              {puede('cargar_asistencias') && (
                <button className="btn btn-primary" style={{marginTop:16, padding:'16px', fontSize:15}}
                  onClick={guardar} disabled={saving}>
                  {saving ? 'Guardando…' : `💾 Guardar asistencia · ${cursoNombre}`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
