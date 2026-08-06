// ── EQUIPO DOCENTE (vista filtrada de usuarios con rol Docente) ───────────────
function Docentes({ user }) {
  const puede = (p) => user.permisos?.includes(p);
  const [lista,      setLista]     = useState([]);
  const [instrumentos,setInstrumentos]=useState([]);
  const [busqueda,   setBusqueda]  = useState('');
  const [filtroInst, setFiltroInst]= useState('');
  const [perfil,     setPerfil]    = useState(null); // usuarioId seleccionado
  const [cargando,   setCargando]  = useState(true);
  const [modalNuevo, setModalNuevo]= useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [d, i] = await Promise.all([
        apiFetch('/api/usuarios?rol=Docente'),
        apiFetch('/api/instrumentos'),
      ]);
      setLista(d); setInstrumentos(i);
    } catch(e) {}
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const listaFiltrada = lista.filter(d => {
    const txt = `${d.nombre} ${d.apellido||''} ${(d.instrumentos||[]).map(i=>i.nombre).join(' ')}`.toLowerCase();
    if (busqueda   && !txt.includes(busqueda.toLowerCase())) return false;
    if (filtroInst && !(d.instrumentos||[]).some(i=>i.nombre===filtroInst)) return false;
    return true;
  });

  if (perfil !== null) return (
    <PerfilUsuario usuarioId={perfil} user={user} puede={puede}
      titulo="Perfil del docente"
      onVolver={() => { setPerfil(null); cargar(); }} />
  );

  return (
    <div>
      <div className="section-header">
        <h2 style={{fontSize:18,fontWeight:800}}>👩‍🏫 Equipo Docente</h2>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span className="badge-count">{listaFiltrada.length} profes</span>
          {puede('administrar_usuarios_roles') && (
            <button className="btn btn-primary btn-auto" onClick={() => setModalNuevo(true)}>+ Nuevo profe</button>
          )}
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        <input className="form-control" style={{flex:1,minWidth:160}}
          placeholder="Buscar por nombre o instrumento..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="form-control" style={{width:'auto'}} value={filtroInst}
          onChange={e => setFiltroInst(e.target.value)}>
          <option value="">Todos los instrumentos</option>
          {instrumentos.map(i => <option key={i.id} value={i.nombre}>{i.nombre}</option>)}
        </select>
      </div>
      {cargando ? <div className="spinner"><div className="spin"/></div>
        : listaFiltrada.length === 0
        ? <div className="empty-state"><div className="empty-state-icon">👩‍🏫</div><div>No hay docentes registrados</div></div>
        : listaFiltrada.map(d => {
            const nombre = [d.nombre, d.apellido].filter(Boolean).join(' ');
            const iniciales = nombre.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
            return (
              <div key={d.id} className="docente-card" onClick={() => setPerfil(d.id)}>
                <div className="docente-avatar">
                  {d.foto_path ? <img src={d.foto_path} alt={nombre} /> : iniciales}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="docente-nombre">
                    {nombre}
                    {d.instrumento_principal_nombre && (
                      <span style={{marginLeft:8,fontSize:12,fontWeight:600,color:'#92400e',
                                    background:'#fef3c7',borderRadius:8,padding:'1px 8px'}}>
                        ★ {d.instrumento_principal_nombre}
                      </span>
                    )}
                  </div>
                  <div className="docente-meta">
                    {d.instrumentos?.length > 0
                      ? d.instrumentos.map((i,k) => (
                          <span key={k} style={{background:'var(--bg3)',borderRadius:8,padding:'1px 7px',fontSize:11,fontWeight:600}}>{i.nombre}</span>
                        ))
                      : <span style={{color:'var(--text2)'}}>Sin instrumentos cargados</span>
                    }
                    {d.cursos?.length > 0 && <span>· {d.cursos.map(c=>c.nombre).join(', ')}</span>}
                  </div>
                </div>
              </div>
            );
          })
      }
      {modalNuevo && (
        <ModalNuevoUsuario
          roles={[]}  titulo="Nuevo profe" rolFijo="Docente"
          onClose={() => setModalNuevo(false)}
          onCreado={(uid) => { setModalNuevo(false); cargar(); setPerfil(uid); }}
        />
      )}
    </div>
  );
}

// ── MODAL NUEVO USUARIO (usado desde Docentes y GestionUsuarios) ─────────────
function ModalNuevoUsuario({ onClose, onCreado, titulo, rolFijo }) {
  const [roles,    setRoles]   = useState([]);
  const [nombre,   setNombre]  = useState('');
  const [apellido, setApel]    = useState('');
  const [email,    setEmail]   = useState('');
  const [password, setPwd]     = useState('');
  const [rolId,    setRolId]   = useState('');
  const [showPwd,  setShowPwd] = useState(false);
  const [saving,   setSaving]  = useState(false);
  const [error,    setError]   = useState('');
  const [resultado,setResult]  = useState(null);

  useEffect(() => {
    if (rolFijo) return; // no need roles list if fixed
    apiFetch('/api/roles').then(r => { setRoles(r); setRolId(String(r[0]?.id||'')); }).catch(()=>{});
  }, [rolFijo]);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const rolesFetch = roles.length ? roles : await apiFetch('/api/roles');
      const rolSeleccionado = rolFijo
        ? rolesFetch.find(r => r.nombre === rolFijo)
        : rolesFetch.find(r => String(r.id) === rolId);
      if (!rolSeleccionado) throw new Error('Rol no encontrado');

      const tempPwd  = password.trim() || Math.random().toString(36).slice(-8) + '!';
      const r = await apiFetch('/api/usuarios', {
        method:'POST',
        body:{ nombre:nombre.trim(), apellido:apellido.trim()||undefined, email:email.trim(), password:tempPwd, rol_id:rolSeleccionado.id },
      });
      setResult({ id:r.id, nombre:[nombre,apellido].filter(Boolean).join(' '), email, tempPwd });
    } catch(err) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (resultado) return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">✅ Usuario creado</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="alert alert-success">{resultado.nombre} fue creado correctamente.</div>
        <div style={{background:'var(--bg3)',borderRadius:10,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'var(--text2)',marginBottom:6}}>🔑 Contraseña temporal</div>
          <div style={{fontFamily:'monospace',fontSize:17,fontWeight:800,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>{resultado.tempPwd}</span>
            <button className="btn btn-secondary btn-auto" style={{fontSize:12}}
              onClick={() => navigator.clipboard?.writeText(resultado.tempPwd)}>Copiar</button>
          </div>
          <div style={{fontSize:11,color:'var(--text2)',marginTop:6}}>Email: {resultado.email}</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-auto" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary btn-auto" onClick={() => onCreado(resultado.id)}>Ver perfil →</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{titulo || 'Nuevo usuario'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={nombre} onChange={e=>setNombre(e.target.value)} required placeholder="María" />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido</label>
              <input className="form-control" value={apellido} onChange={e=>setApel(e.target.value)} placeholder="González" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="maria@epm.edu.ar" />
          </div>
          {!rolFijo && roles.length > 0 && (
            <div className="form-group">
              <label className="form-label">Rol *</label>
              <select className="form-control" value={rolId} onChange={e=>setRolId(e.target.value)} required>
                {roles.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          )}
          {rolFijo && (
            <div className="form-group">
              <label className="form-label">Rol</label>
              <input className="form-control" value={rolFijo} disabled />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Contraseña temporal <span style={{fontSize:11,color:'var(--text2)'}}>(auto si vacío)</span></label>
            <div style={{display:'flex',gap:6}}>
              <input className="form-control" type={showPwd?'text':'password'} value={password}
                onChange={e=>setPwd(e.target.value)} placeholder="Mínimo 6 caracteres o dejar vacío" />
              <button type="button" className="btn btn-secondary btn-auto" style={{padding:'0 12px'}}
                onClick={()=>setShowPwd(s=>!s)}>{showPwd?'🙈':'👁'}</button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-auto" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
              {saving?'Creando...':'+ Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
