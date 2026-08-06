// ── PERFIL DE USUARIO UNIFICADO ──────────────────────────────────────────────────
// Usado tanto desde Equipo Docente como desde Usuarios y Roles
function PerfilUsuario({ usuarioId, user, puede, onVolver, titulo, onSelfUpdate, onIniciarTour }) {
  const [perfil,     setPerfil]      = useState(null);
  const [instrumentos,setInstrumentos]= useState([]);
  const [todosLosCursos,setTodosCursos]=useState([]);
  const [cargando,   setCargando]    = useState(true);
  const [form,       setForm]        = useState(null);
  const [savedForm,  setSavedForm]   = useState(null);
  const [saving,     setSaving]      = useState(false);
  const [msg,        setMsg]         = useState('');
  const [pwModal,    setPwModal]     = useState(false);
  const [pwForm,     setPwForm]      = useState({ actual:'', pass:'', confirm:'' });
  const [pwSaving,   setPwSaving]    = useState(false);
  const [pwErr,      setPwErr]       = useState('');

  const esPropio   = user.id === usuarioId;
  const esAdmin    = puede('administrar_usuarios_roles');
  const puedeEd    = esAdmin || esPropio || puede('editar_equipo_docente');
  const esDocente  = perfil?.rol_nombre === 'Docente';
  const isDirty    = form && savedForm && JSON.stringify(form) !== JSON.stringify(savedForm);

  const cargar = useCallback(async () => {
    try {
      const [p, inst, cursos] = await Promise.all([
        apiFetch(`/api/usuarios/${usuarioId}`),
        apiFetch('/api/instrumentos'),
        apiFetch('/api/cursos'),
      ]);
      setPerfil(p);
      setInstrumentos(inst);
      setTodosCursos(cursos);
      const f = {
        nombre:                   p.nombre || '',
        email:                    p.email || '',
        apellido:                 p.apellido || '',
        dni:                      p.dni || '',
        fecha_nacimiento:         p.fecha_nacimiento || '',
        telefono:                 p.telefono || '',
        formacion:                p.formacion || '',
        instrumento_ids:          (p.instrumentos || []).map(i => Number(i.id)),
        instrumento_principal_id: p.instrumento_principal_id ? Number(p.instrumento_principal_id) : null,
      };
      setForm(f); setSavedForm(f);
    } catch(e) { setMsg('Error: ' + e.message); }
    finally { setCargando(false); }
  }, [usuarioId]);
  useEffect(() => { cargar(); }, [cargar]);

  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const toggleInst = (id) => setForm(f => {
    const nid = Number(id);
    const ids = f.instrumento_ids.includes(nid) ? f.instrumento_ids.filter(x=>x!==nid) : [...f.instrumento_ids,nid];
    return { ...f, instrumento_ids: ids, instrumento_principal_id: ids.includes(f.instrumento_principal_id) ? f.instrumento_principal_id : null };
  });

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setMsg('Error: el nombre no puede quedar vacío.'); return; }
    if (!form.email.trim())  { setMsg('Error: el email no puede quedar vacío.');  return; }
    setSaving(true); setMsg('');
    try {
      await apiFetch(`/api/usuarios/${usuarioId}/perfil`, { method:'PUT', body: form });
      setMsg('✅ Perfil guardado.');
      setSavedForm(form);
      if (esPropio) onSelfUpdate?.({ nombre: form.nombre, email: form.email });
      cargar();
    } catch(err) { setMsg('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const subirFoto = async (file) => {
    if (!file) return;
    const fd = new FormData(); fd.append('foto', file);
    const res = await fetch(`/api/usuarios/${usuarioId}/foto`, {
      method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('epm_token')}` }, body:fd,
    });
    const d = await res.json();
    if (res.ok) { setPerfil(p => ({...p, foto_path: d.foto_path})); if (esPropio) onSelfUpdate?.({ foto_path: d.foto_path }); }
    else alert(d.error);
  };

  const quitarFoto = async () => {
    if (!window.confirm('¿Quitar la foto de perfil?')) return;
    try {
      await apiFetch(`/api/usuarios/${usuarioId}/foto`, { method:'DELETE' });
      setPerfil(p => ({...p, foto_path: null}));
      if (esPropio) onSelfUpdate?.({ foto_path: null });
    } catch(e) { alert(e.message); }
  };

  const abrirPassword = () => { setPwForm({ actual:'', pass:'', confirm:'' }); setPwErr(''); setPwModal(true); };

  const cambiarPassword = async () => {
    if (esPropio && !pwForm.actual) { setPwErr('Ingresá tu contraseña actual'); return; }
    if (pwForm.pass.length < 6) { setPwErr('La nueva contraseña debe tener mínimo 6 caracteres'); return; }
    if (pwForm.pass !== pwForm.confirm) { setPwErr('Las contraseñas no coinciden'); return; }
    setPwSaving(true); setPwErr('');
    try {
      if (esPropio) {
        await apiFetch(`/api/usuarios/${usuarioId}/mi-password`, { method:'PUT', body:{ password_actual:pwForm.actual, password:pwForm.pass } });
      } else {
        await apiFetch(`/api/usuarios/${usuarioId}/password`, { method:'PUT', body:{ password:pwForm.pass } });
      }
      setPwModal(false); setPwForm({ actual:'', pass:'', confirm:'' }); setMsg('✅ Contraseña actualizada.');
    } catch(e) { setPwErr(e.message); }
    finally { setPwSaving(false); }
  };

  if (cargando) return <div className="spinner"><div className="spin"/></div>;
  if (!perfil)  return <div className="alert alert-error">{msg || 'Usuario no encontrado'}</div>;

  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ');
  const iniciales = nombreCompleto.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  const fechaRegistro = perfil.created_at ? new Date(perfil.created_at).toLocaleDateString('es-AR') : '—';

  return (
    <div style={{maxWidth:660,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18,flexWrap:'wrap'}}>
        <button className="btn btn-secondary btn-auto" onClick={onVolver}>← Volver</button>
        <h2 style={{fontSize:18,fontWeight:800}}>{titulo || 'Perfil'}</h2>
        {esPropio && onIniciarTour && (
          <button className="btn btn-secondary btn-auto" style={{marginLeft:'auto',fontSize:12}}
            onClick={onIniciarTour}>🎓 Repetir tour de bienvenida</button>
        )}
      </div>

      {/* Cabecera con foto */}
      <div className="ficha-section">
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <label style={{cursor:puedeEd?'pointer':'default'}}>
            <div className="docente-avatar" style={{width:64,height:64,fontSize:22,borderRadius:14}}>
              {perfil.foto_path
                ? <img src={perfil.foto_path} alt={nombreCompleto} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                : iniciales}
            </div>
            {puedeEd && <input type="file" accept="image/*" style={{display:'none'}}
              onChange={e => e.target.files[0] && subirFoto(e.target.files[0])} />}
          </label>
          <div style={{flex:1,minWidth:160}}>
            <div style={{fontSize:18,fontWeight:800}}>{nombreCompleto}</div>
            <div style={{fontSize:13,color:'var(--text2)'}}>{perfil.email}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
              <span style={{fontSize:12,background:'var(--bg3)',borderRadius:8,padding:'1px 8px',fontWeight:600}}>
                {perfil.rol_nombre}
              </span>
              {perfil.instrumento_principal_nombre && (
                <span style={{fontSize:12,background:'#fef3c7',color:'#92400e',borderRadius:8,padding:'1px 8px',fontWeight:700}}>
                  ★ {perfil.instrumento_principal_nombre}
                </span>
              )}
            </div>
            {puedeEd && perfil.foto_path && (
              <button onClick={quitarFoto} style={{background:'none',border:'none',color:'var(--danger)',fontSize:11,cursor:'pointer',padding:0,marginTop:6}}>
                ✕ Quitar foto
              </button>
            )}
          </div>
          {(esAdmin || esPropio) && (
            <button className="btn btn-secondary btn-auto" style={{fontSize:12}} onClick={abrirPassword}>🔑 Contraseña</button>
          )}
        </div>
        <div style={{fontSize:12,color:'var(--text2)',marginTop:10,display:'flex',flexDirection:'column',gap:2}}>
          {perfil.cursos?.length > 0 && <div>Cursos asignados: {perfil.cursos.map(c=>c.nombre).join(', ')}</div>}
          <div>Usuario desde: {fechaRegistro}</div>
        </div>
      </div>

      {isDirty && <div className="dirty-bar"><span>●</span> Cambios sin guardar</div>}
      {msg && <div className={`alert ${msg.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

      <form onSubmit={guardar}>
        {/* Datos personales */}
        <div className="ficha-section">
          <div className="ficha-section-title">Datos personales</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-control" value={form.nombre} disabled={!puedeEd}
                onChange={e => set('nombre', e.target.value)} placeholder="Ana" />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido</label>
              <input className="form-control" value={form.apellido} disabled={!puedeEd}
                onChange={e => set('apellido', e.target.value)} placeholder="González" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} disabled={!puedeEd}
                onChange={e => set('email', e.target.value)} placeholder="ana@epm.edu.ar" />
            </div>
            <div className="form-group">
              <label className="form-label">DNI</label>
              <input className="form-control" value={form.dni} disabled={!puedeEd}
                onChange={e => set('dni', e.target.value)} placeholder="12345678" />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de nacimiento</label>
              <input className="form-control" type="date" value={form.fecha_nacimiento} disabled={!puedeEd}
                onChange={e => set('fecha_nacimiento', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="form-control" value={form.telefono} disabled={!puedeEd}
                onChange={e => set('telefono', e.target.value)} placeholder="+54 11..." />
            </div>
          </div>
        </div>

        {/* Instrumentos y formación — solo para Docentes */}
        {esDocente && (
          <>
            <div className="ficha-section">
              <div className="ficha-section-title">Instrumentos que enseña</div>
              <div className="curso-checks" style={{marginBottom: form.instrumento_ids.length > 0 ? 12 : 0}}>
                {instrumentos.map(i => {
                  const id = Number(i.id);
                  return (
                    <button key={id} type="button" disabled={!puedeEd}
                      className={`curso-check-btn ${form.instrumento_ids.includes(id)?'selected':''}`}
                      onClick={() => puedeEd && toggleInst(id)}>
                      {i.nombre}
                    </button>
                  );
                })}
              </div>
              {form.instrumento_ids.length > 0 && (
                <div>
                  <div style={{fontSize:12,color:'var(--text2)',fontWeight:700,marginBottom:6}}>★ Principal</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {instrumentos.filter(i => form.instrumento_ids.includes(Number(i.id))).map(i => {
                      const id = Number(i.id);
                      const es = form.instrumento_principal_id === id;
                      return (
                        <button key={id} type="button" disabled={!puedeEd}
                          onClick={() => puedeEd && set('instrumento_principal_id', es ? null : id)}
                          style={{padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:700,
                                  cursor:puedeEd?'pointer':'default',
                                  border:`2px solid ${es?'#f59e0b':'var(--border)'}`,
                                  background:es?'#fef3c7':'var(--card)',
                                  color:es?'#92400e':'var(--text2)'}}>
                          {es ? '★' : '☆'} {i.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="ficha-section">
              <div className="ficha-section-title">Formación y experiencia</div>
              <textarea className="form-control" rows={5} value={form.formacion} disabled={!puedeEd}
                onChange={e => set('formacion', e.target.value)}
                placeholder="Estudios, trayectoria, experiencia docente..." />
            </div>
          </>
        )}

        {puedeEd && (
          <div style={{display:'flex',justifyContent:'flex-end',padding:'6px 0'}}>
            <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
              {saving ? 'Guardando...' : '💾 Guardar perfil'}
            </button>
          </div>
        )}
      </form>

      {/* Modal cambiar contraseña */}
      {pwModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setPwModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">🔑 Cambiar contraseña</span>
              <button className="modal-close" onClick={() => setPwModal(false)}>×</button>
            </div>
            {pwErr && <div className="alert alert-error">{pwErr}</div>}
            {esPropio && (
              <div className="form-group">
                <label className="form-label">Contraseña actual</label>
                <PasswordInput value={pwForm.actual} autoComplete="current-password"
                  onChange={e => setPwForm(f=>({...f,actual:e.target.value}))} placeholder="Tu contraseña actual" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Nueva contraseña</label>
              <PasswordInput value={pwForm.pass}
                onChange={e => setPwForm(f=>({...f,pass:e.target.value}))} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar</label>
              <PasswordInput value={pwForm.confirm}
                onChange={e => setPwForm(f=>({...f,confirm:e.target.value}))} placeholder="Repetí la contraseña" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={() => setPwModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={cambiarPassword} disabled={pwSaving}>
                {pwSaving ? 'Cambiando…' : 'Cambiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
