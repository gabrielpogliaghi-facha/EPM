// ── CURSOS ──────────────────────────────────────────────────────────────────────
function Cursos({ user }) {
  const [cursos,  setCursos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [modal,   setModal]   = useState(null);
  const [editing, setEditing] = useState(null);
  const [nombre,  setNombre]  = useState('');
  const [delTarget, setDelTarget] = useState(null);
  const [toast,   setToast]   = useState({ type:'', text:'' });
  const [formErr, setFormErr] = useState('');

  const puede = (p) => user.permisos?.includes(p);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type:'', text:'' }), 4000);
  };

  const cargar = async () => {
    setLoading(true);
    try { setCursos(await apiFetch('/api/cursos')); }
    catch (e) { showToast('error', e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo   = () => { setEditing(null); setNombre(''); setFormErr(''); setModal('form'); };
  const abrirEditar  = (c) => { setEditing(c); setNombre(c.nombre); setFormErr(''); setModal('form'); };
  const cerrarModal  = ()  => setModal(null);

  const abrirBorrar = async (c) => {
    try {
      const info = await apiFetch(`/api/cursos/${c.id}/info`);
      setDelTarget({ curso: c, estudiantes: info.estudiantes });
      setModal('delete');
    } catch (e) { showToast('error', e.message); }
  };

  const guardar = async () => {
    const n = nombre.trim();
    if (!n) { setFormErr('El nombre no puede estar vacío.'); return; }
    setSaving(true); setFormErr('');
    try {
      if (editing) {
        await apiFetch(`/api/cursos/${editing.id}`, { method:'PUT', body:{ nombre:n } });
        showToast('success', `"${n}" actualizado.`);
      } else {
        await apiFetch('/api/cursos', { method:'POST', body:{ nombre:n } });
        showToast('success', `Curso "${n}" creado.`);
      }
      cerrarModal(); cargar();
    } catch (e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const confirmarBorrar = async () => {
    setSaving(true);
    try {
      const r = await apiFetch(`/api/cursos/${delTarget.curso.id}`, { method:'DELETE' });
      const txt = r.accion === 'desactivado'
        ? `Curso desactivado. Los ${r.estudiantes} estudiantes conservan todos sus datos.`
        : 'Curso eliminado permanentemente.';
      showToast('success', txt); cerrarModal(); cargar();
    } catch (e) { showToast('error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {toast.text && (
        <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}}
          onClick={() => setToast({ type:'', text:'' })}>
          {toast.text}
        </div>
      )}

      <div className="card">
        <div className="section-header">
          <span className="card-title" style={{marginBottom:0}}>🏫 Cursos</span>
          {puede('administrar_cursos') && (
            <button className="btn btn-primary btn-auto" onClick={abrirNuevo}>＋ Nuevo curso</button>
          )}
        </div>

        {loading ? (
          <div className="spinner"><div className="spin" /></div>
        ) : cursos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏫</div>
            <p>No hay cursos cargados todavía.</p>
          </div>
        ) : cursos.map(c => (
          <div key={c.id} className="list-row">
            <span className="list-row-label">{c.nombre}</span>
            <span className="badge-count">{c.estudiantes} est.</span>
            {puede('administrar_cursos') && (
              <div className="row-actions">
                <button className="btn-icon" onClick={() => abrirEditar(c)} title="Renombrar">✏️</button>
                <button className="btn-icon btn-icon-danger" onClick={() => abrirBorrar(c)} title="Eliminar">🗑️</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal === 'form' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && cerrarModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Renombrar curso' : 'Nuevo curso'}</span>
              <button className="modal-close" onClick={cerrarModal}>✕</button>
            </div>
            {formErr && <div className="alert alert-error">{formErr}</div>}
            <div className="form-group">
              <label className="form-label">Nombre del curso</label>
              <input className="form-control" value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && guardar()}
                placeholder="Ej: Mojarritas" autoFocus />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear curso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && delTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && cerrarModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                ⚠️ {delTarget.estudiantes > 0 ? 'Desactivar' : 'Eliminar'} curso
              </span>
              <button className="modal-close" onClick={cerrarModal}>✕</button>
            </div>
            <p style={{marginBottom:12}}>Curso: <strong>{delTarget.curso.nombre}</strong></p>
            {delTarget.estudiantes > 0 ? (
              <div className="alert alert-warning">
                <strong>Este curso tiene {delTarget.estudiantes} estudiante(s).</strong><br />
                El curso quedará <strong>desactivado</strong> y no aparecerá en los listados.
                Los estudiantes y todos sus registros (asistencias, etc.) se conservan intactos;
                quedan sin curso asignado hasta que los reasignes desde su ficha.
              </div>
            ) : (
              <div className="alert alert-warning">
                Este curso no tiene estudiantes y se <strong>eliminará permanentemente</strong>.
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-danger btn-auto" onClick={confirmarBorrar} disabled={saving}>
                {saving ? 'Procesando…' : delTarget.estudiantes > 0 ? 'Desactivar curso' : 'Eliminar curso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── INSTRUMENTOS ────────────────────────────────────────────────────────────────
function Instrumentos({ user }) {
  const [instrumentos, setInstrumentos] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [modal,    setModal]    = useState(null);
  const [editing,  setEditing]  = useState(null);
  const [nombre,   setNombre]   = useState('');
  const [delTarget,setDelTarget]= useState(null);
  const [toast,    setToast]    = useState({ type:'', text:'' });
  const [formErr,  setFormErr]  = useState('');
  const puede = (p) => user.permisos?.includes(p);

  const showToast = (type, text) => { setToast({type,text}); setTimeout(()=>setToast({type:'',text:''}),4000); };
  const cargar = async () => {
    setLoading(true);
    try { setInstrumentos(await apiFetch('/api/instrumentos')); }
    catch(e) { showToast('error', e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const abrirNuevo  = () => { setEditing(null); setNombre(''); setFormErr(''); setModal('form'); };
  const abrirEditar = (i) => { setEditing(i); setNombre(i.nombre); setFormErr(''); setModal('form'); };
  const cerrar      = () => setModal(null);

  const guardar = async () => {
    const n = nombre.trim();
    if (!n) { setFormErr('El nombre no puede estar vacío.'); return; }
    setSaving(true); setFormErr('');
    try {
      if (editing) {
        await apiFetch(`/api/instrumentos/${editing.id}`, { method:'PUT', body:{nombre:n} });
        showToast('success', `"${n}" actualizado.`);
      } else {
        await apiFetch('/api/instrumentos', { method:'POST', body:{nombre:n} });
        showToast('success', `Instrumento "${n}" creado.`);
      }
      cerrar(); cargar();
    } catch(e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const confirmarBorrar = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/instrumentos/${delTarget.id}`, { method:'DELETE' });
      showToast('success', 'Instrumento eliminado.'); cerrar(); cargar();
    } catch(e) { showToast('error', e.message); }
    finally { setSaving(false); setDelTarget(null); }
  };

  return (
    <div>
      {toast.text && <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}} onClick={()=>setToast({type:'',text:''})}>{toast.text}</div>}
      <div className="card">
        <div className="section-header">
          <span className="card-title" style={{marginBottom:0}}>🎸 Instrumentos</span>
          {puede('administrar_cursos') && (
            <button className="btn btn-primary btn-auto" onClick={abrirNuevo}>＋ Nuevo</button>
          )}
        </div>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:12}}>
          Los instrumentos se combinan con los niveles (Mojarritas → Pulpos) para formar las inscripciones de cada estudiante.
        </p>
        {loading ? <div className="spinner"><div className="spin"/></div>
        : instrumentos.length === 0
          ? <div className="empty-state"><div className="empty-state-icon">🎸</div><p>No hay instrumentos cargados.</p></div>
          : instrumentos.map(i => (
          <div key={i.id} className="list-row">
            <span className="list-row-label">{i.nombre}</span>
            <span className="badge-count">{Number(i.inscripciones)} insc.</span>
            {puede('administrar_cursos') && (
              <div className="row-actions">
                <button className="btn-icon" onClick={()=>abrirEditar(i)} title="Renombrar">✏️</button>
                <button className="btn-icon btn-icon-danger"
                  onClick={()=>{ setDelTarget(i); setModal('delete'); }} title="Eliminar">🗑️</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal === 'form' && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&cerrar()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Renombrar instrumento' : 'Nuevo instrumento'}</span>
              <button className="modal-close" onClick={cerrar}>✕</button>
            </div>
            {formErr && <div className="alert alert-error">{formErr}</div>}
            <div className="form-group">
              <label className="form-label">Nombre del instrumento</label>
              <input className="form-control" value={nombre}
                onChange={e=>setNombre(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&guardar()}
                placeholder="Ej: Guitarra, Canto, Batería…" autoFocus />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear instrumento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && delTarget && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&cerrar()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Eliminar instrumento</span>
              <button className="modal-close" onClick={cerrar}>✕</button>
            </div>
            <p style={{marginBottom:12}}>Instrumento: <strong>{delTarget.nombre}</strong></p>
            {Number(delTarget.inscripciones) > 0
              ? <div className="alert alert-error">Tiene {Number(delTarget.inscripciones)} inscripción(es) activa(s). Quitálas desde las fichas de los estudiantes antes de eliminar el instrumento.</div>
              : <div className="alert alert-warning">Esta acción no puede deshacerse.</div>
            }
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrar}>Cancelar</button>
              {Number(delTarget.inscripciones) === 0 && (
                <button className="btn btn-danger btn-auto" onClick={confirmarBorrar} disabled={saving}>
                  {saving ? 'Eliminando…' : 'Eliminar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
