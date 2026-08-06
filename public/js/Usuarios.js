// ── GESTIÓN DE USUARIOS ─────────────────────────────────────────────────────────
function GestionUsuarios({ self }) {
  const [usuarios,    setUsuarios]    = useState([]);
  const [inactivos,   setInactivos]   = useState([]);
  const [mostrarBaja, setMostrarBaja] = useState(false);
  const [cursos,      setCursos]      = useState([]);
  const [roles,       setRoles]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null); // null|'form'|'password'|'delete'
  const [target,      setTarget]      = useState(null);
  const [form,        setForm]        = useState({ nombre:'', email:'', password:'', rol_id:'', cursos:[] });
  const [pwForm,      setPwForm]      = useState({ password:'', confirm:'' });
  const [saving,      setSaving]      = useState(false);
  const [formErr,     setFormErr]     = useState('');
  const [toast,       setToast]       = useState({ type:'', text:'' });

  const showToast = (t,m) => { setToast({type:t,text:m}); setTimeout(()=>setToast({type:'',text:''}),4000); };
  const ini = n => n.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
  const isNew = !target;

  const cargar = async () => {
    setLoading(true);
    try {
      const [us, inact, cs, rs] = await Promise.all([
        apiFetch('/api/usuarios'),
        apiFetch('/api/usuarios?inactivos=1'),
        apiFetch('/api/cursos'),
        apiFetch('/api/roles'),
      ]);
      setUsuarios(us); setInactivos(inact); setCursos(cs); setRoles(rs);
    } catch(e) { showToast('error', e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setTarget(null);
    setForm({ nombre:'', email:'', password:'', rol_id: String(roles[0]?.id||''), cursos:[] });
    setFormErr(''); setModal('form');
  };
  const abrirEditar = u => {
    setTarget(u);
    setForm({ nombre:u.nombre, email:u.email, password:'', rol_id:String(u.rol_id), cursos:(u.cursos||[]).map(c=>c.id) });
    setFormErr(''); setModal('form');
  };
  const abrirPassword = u => { setTarget(u); setPwForm({password:'',confirm:''}); setFormErr(''); setModal('password'); };
  const abrirDelete   = u => { setTarget(u); setModal('delete'); };
  const cerrar = () => setModal(null);

  const toggleCurso = id => setForm(f => ({
    ...f, cursos: f.cursos.includes(id) ? f.cursos.filter(c=>c!==id) : [...f.cursos, id]
  }));

  const guardarUsuario = async () => {
    if (!form.nombre.trim()||!form.email.trim()||!form.rol_id) { setFormErr('Nombre, email y rol son requeridos.'); return; }
    if (isNew && !form.password) { setFormErr('Contraseña requerida.'); return; }
    if (isNew && form.password.length<6) { setFormErr('Contraseña: mínimo 6 caracteres.'); return; }
    setSaving(true); setFormErr('');
    try {
      let uid;
      if (isNew) {
        const r = await apiFetch('/api/usuarios', { method:'POST', body:{ nombre:form.nombre, email:form.email, password:form.password, rol_id:Number(form.rol_id) } });
        uid = r.id;
      } else {
        await apiFetch(`/api/usuarios/${target.id}`, { method:'PUT', body:{ nombre:form.nombre, email:form.email, rol_id:Number(form.rol_id) } });
        uid = target.id;
      }
      await apiFetch(`/api/usuarios/${uid}/cursos`, { method:'PUT', body:{ cursos: form.cursos } });
      showToast('success', isNew ? `Usuario "${form.nombre}" creado.` : `"${form.nombre}" actualizado.`);
      cerrar(); cargar();
    } catch(e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const cambiarPassword = async () => {
    if (!pwForm.password || pwForm.password.length<6) { setFormErr('Mínimo 6 caracteres.'); return; }
    if (pwForm.password!==pwForm.confirm) { setFormErr('Las contraseñas no coinciden.'); return; }
    setSaving(true); setFormErr('');
    try {
      await apiFetch(`/api/usuarios/${target.id}/password`, { method:'PUT', body:{ password:pwForm.password } });
      showToast('success', 'Contraseña actualizada.'); cerrar();
    } catch(e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const eliminarUsuario = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/usuarios/${target.id}`, { method:'DELETE' });
      showToast('success', `"${target.nombre}" dado de baja.`); cerrar(); cargar();
    } catch(e) { showToast('error', e.message); cerrar(); }
    finally { setSaving(false); }
  };

  const reactivarUsuario = async (u) => {
    if (!confirm(`¿Reactivar la cuenta de "${u.nombre}"? Podrá volver a acceder al sistema.`)) return;
    try {
      await apiFetch(`/api/usuarios/${u.id}/reactivar`, { method:'POST' });
      showToast('success', `"${u.nombre}" reactivado.`); cargar();
    } catch(e) { showToast('error', e.message); }
  };

  return (
    <div>
      {toast.text && <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}} onClick={()=>setToast({type:'',text:''})}>{toast.text}</div>}
      <div className="card">
        <div className="section-header">
          <span className="card-title" style={{marginBottom:0}}>👤 Usuarios</span>
          <button className="btn btn-primary btn-auto" onClick={abrirNuevo}>＋ Nuevo usuario</button>
        </div>
        {loading ? <div className="spinner"><div className="spin"/></div>
        : usuarios.length===0 ? <div className="empty-state"><div className="empty-state-icon">👤</div><p>Sin usuarios.</p></div>
        : usuarios.map(u => (
          <div key={u.id} className="usr-row">
            <div className="usr-avatar">{ini(u.nombre)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="usr-nombre">
                {u.nombre}{u.id===self.id && <span className="usr-self">yo</span>}
              </div>
              <div className="usr-meta">
                {u.email} · <span className="rol-badge">{u.rol_nombre}</span>
                {u.cursos?.length>0 && <span style={{marginLeft:4}}>{u.cursos.length} curso(s)</span>}
              </div>
            </div>
            <div className="row-actions">
              <button className="btn-icon" onClick={()=>abrirEditar(u)} title="Editar">✏️</button>
              <button className="btn-icon" onClick={()=>abrirPassword(u)} title="Contraseña">🔑</button>
              <button className="btn-icon btn-icon-danger" onClick={()=>abrirDelete(u)}
                disabled={u.id===self.id} style={{opacity:u.id===self.id?.35:1}}
                title={u.id===self.id?'No podés darte de baja a vos mismo':'Dar de baja'}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Sección usuarios dados de baja */}
      {inactivos.length > 0 && (
        <div style={{marginTop:16}}>
          <button
            style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--text2)',
                    fontWeight:700,padding:'6px 0',display:'flex',alignItems:'center',gap:6}}
            onClick={() => setMostrarBaja(b => !b)}>
            {mostrarBaja ? '▾' : '▸'} Usuarios dados de baja ({inactivos.length})
          </button>
          {mostrarBaja && (
            <div style={{marginTop:8,opacity:.85}}>
              {inactivos.map(u => (
                <div key={u.id} className="usr-row" style={{borderStyle:'dashed'}}>
                  <div className="usr-avatar" style={{opacity:.5}}>{ini(u.nombre)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="usr-nombre" style={{color:'var(--text2)',textDecoration:'line-through'}}>
                      {u.nombre}
                    </div>
                    <div className="usr-meta">{u.email} · {u.rol_nombre}</div>
                  </div>
                  <button className="btn btn-secondary btn-auto" style={{fontSize:12,padding:'5px 10px'}}
                    onClick={() => reactivarUsuario(u)}>
                    ↩ Reactivar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal form usuario */}
      {modal==='form' && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&cerrar()}>
          <div className="modal" style={{maxWidth:520}}>
            <div className="modal-header">
              <span className="modal-title">{isNew?'Nuevo usuario':'Editar usuario'}</span>
              <button className="modal-close" onClick={cerrar}>✕</button>
            </div>
            {formErr && <div className="alert alert-error">{formErr}</div>}
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ana González" />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-control" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="ana@epm.edu.ar" />
            </div>
            {isNew && (
              <div className="form-group">
                <label className="form-label">Contraseña * (mín. 6 caracteres)</label>
                <PasswordInput value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="••••••" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Rol *</label>
              <select className="form-control" value={form.rol_id} onChange={e=>setForm(f=>({...f,rol_id:e.target.value}))}>
                <option value="">Seleccionar…</option>
                {roles.map(r=><option key={r.id} value={String(r.id)}>{r.nombre}</option>)}
              </select>
            </div>
            {cursos.length>0 && (
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Cursos asignados (visibles en Tomar Asistencia)</label>
                <div className="auth-list">
                  {cursos.map(c => {
                    const on = form.cursos.includes(c.id);
                    return (
                      <div key={c.id} className={`auth-row ${on?'on':''}`} onClick={()=>toggleCurso(c.id)} style={{padding:'10px 14px'}}>
                        <div className={`auth-check ${on?'on':''}`}>{on?'✓':''}</div>
                        <div className="auth-label" style={{fontSize:14}}>{c.nombre}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={guardarUsuario} disabled={saving}>
                {saving?'Guardando…':isNew?'Crear usuario':'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal contraseña */}
      {modal==='password' && target && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&cerrar()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">🔑 Cambiar contraseña</span>
              <button className="modal-close" onClick={cerrar}>✕</button>
            </div>
            <p style={{marginBottom:12,fontSize:13}}>Usuario: <strong>{target.nombre}</strong></p>
            {formErr && <div className="alert alert-error">{formErr}</div>}
            <div className="form-group">
              <label className="form-label">Nueva contraseña (mín. 6 caracteres)</label>
              <PasswordInput value={pwForm.password} onChange={e=>setPwForm(f=>({...f,password:e.target.value}))} placeholder="••••••" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar contraseña</label>
              <PasswordInput value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))} placeholder="••••••" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={cambiarPassword} disabled={saving}>
                {saving?'Guardando…':'Cambiar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar baja */}
      {modal==='delete' && target && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&cerrar()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Dar de baja al usuario</span>
              <button className="modal-close" onClick={cerrar}>✕</button>
            </div>
            <p style={{marginBottom:12}}>Usuario: <strong>{target.nombre}</strong></p>
            <div className="alert alert-warning">
              Esto va a generar el siguiente cambio: <strong>{target.nombre}</strong> quedará inactivo y
              no podrá acceder al sistema. Sus registros (asistencias cargadas, etc.) se conservan intactos.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-danger btn-auto" onClick={eliminarUsuario} disabled={saving}>
                {saving?'Procesando…':'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GESTIÓN DE ROLES Y PERMISOS ──────────────────────────────────────────────────
const GRUPOS_PERM = [
  { key:'estudiantes',    label:'👥 Estudiantes' },
  { key:'asistencias',   label:'📋 Asistencias' },
  { key:'reportes',      label:'📊 Reportes' },
  { key:'planificaciones',label:'📝 Planificaciones' },
  { key:'administracion',label:'⚙️ Administración' },
];

function GestionRoles() {
  const [roles,    setRoles]    = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [pending,  setPending]  = useState({});   // { rolId: Set<codigo> }
  const [confirm,  setConfirm]  = useState(null); // { rol, codes }
  const [saving,   setSaving]   = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoForm,  setNuevoForm]  = useState({ nombre:'', descripcion:'' });
  const [delConfirm, setDelConfirm] = useState(null);
  const [toast,    setToast]    = useState({ type:'', text:'' });

  const showToast = (t,m) => { setToast({type:t,text:m}); setTimeout(()=>setToast({type:'',text:''}),4000); };

  const cargar = async () => {
    setLoading(true);
    try {
      const [rs,ps] = await Promise.all([apiFetch('/api/roles'), apiFetch('/api/roles/permisos')]);
      setRoles(rs); setPermisos(ps);
    } catch(e) { showToast('error', e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const toggleExpand = rolId => {
    setExpanded(e => e===rolId ? null : rolId);
    if (!pending[rolId]) {
      const rol = roles.find(r=>r.id===rolId);
      if (rol) setPending(p => ({...p, [rolId]: new Set(rol.permisos)}));
    }
  };

  const togglePerm = (rolId, codigo) => {
    setPending(p => {
      const s = new Set(p[rolId]||[]);
      s.has(codigo) ? s.delete(codigo) : s.add(codigo);
      return {...p, [rolId]: s};
    });
  };

  const hayCambios = rolId => {
    const rol = roles.find(r=>r.id===rolId);
    if (!rol || !pending[rolId]) return false;
    const saved = new Set(rol.permisos), curr = pending[rolId];
    if (saved.size!==curr.size) return true;
    for (const c of saved) if (!curr.has(c)) return true;
    return false;
  };

  const guardarPermisos = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/roles/${confirm.rol.id}/permisos`, { method:'PUT', body:{ permisos: confirm.codes } });
      showToast('success', `Permisos de "${confirm.rol.nombre}" actualizados.`);
      setConfirm(null); await cargar();
    } catch(e) { showToast('error', e.message); setConfirm(null); }
    finally { setSaving(false); }
  };

  const crearRol = async () => {
    if (!nuevoForm.nombre.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/roles', { method:'POST', body: nuevoForm });
      showToast('success', `Rol "${nuevoForm.nombre}" creado.`);
      setModalNuevo(false); setNuevoForm({nombre:'',descripcion:''}); await cargar();
    } catch(e) { showToast('error', e.message); }
    finally { setSaving(false); }
  };

  const eliminarRol = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/roles/${delConfirm.id}`, { method:'DELETE' });
      showToast('success', `Rol "${delConfirm.nombre}" eliminado.`);
      setDelConfirm(null); await cargar();
    } catch(e) { showToast('error', e.message); setDelConfirm(null); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="spinner"><div className="spin"/></div>;

  return (
    <div>
      {toast.text && <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}} onClick={()=>setToast({type:'',text:''})}>{toast.text}</div>}

      <div className="section-header" style={{marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:15}}>🔑 Roles y Permisos</span>
        <button className="btn btn-primary btn-auto" onClick={()=>setModalNuevo(true)}>＋ Nuevo rol</button>
      </div>

      {roles.map(rol => {
        const isOpen  = expanded===rol.id;
        const pend    = pending[rol.id] || new Set(rol.permisos);
        const cambios = hayCambios(rol.id);

        return (
          <div key={rol.id}>
            <div className={`role-header ${isOpen?'open':''}`} onClick={()=>toggleExpand(rol.id)}>
              <span style={{flex:1,fontWeight:700,fontSize:15}}>{rol.nombre}</span>
              {rol.es_sistema===1 && <span className="role-sistema">sistema</span>}
              <span style={{fontSize:12,color:'var(--text2)',flexShrink:0}}>{rol.usuarios_count} usuario(s)</span>
              {!rol.es_sistema && (
                <button className="btn-icon btn-icon-danger" style={{padding:'3px 8px',fontSize:13}}
                  onClick={e=>{e.stopPropagation();setDelConfirm(rol);}}>🗑️</button>
              )}
              <span style={{fontSize:11,color:'var(--text2)'}}>{isOpen?'▲':'▼'}</span>
            </div>

            {isOpen && (
              <div className="role-body">
                {GRUPOS_PERM.map(g => {
                  const gPerms = permisos.filter(p=>p.grupo===g.key);
                  return (
                    <div key={g.key} className="perm-group">
                      <div className="perm-group-title">{g.label}</div>
                      <div className="perm-grid">
                        {gPerms.map(p => {
                          const on = pend.has(p.codigo);
                          return (
                            <div key={p.codigo} className={`perm-item ${on?'on':''}`}
                              onClick={()=>togglePerm(rol.id, p.codigo)}>
                              <div className={`perm-chk ${on?'on':''}`}>{on?'✓':''}</div>
                              <span className="perm-desc">{p.descripcion}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {cambios ? (
                  <button className="btn btn-primary" style={{marginTop:4}} onClick={()=>setConfirm({rol, codes:[...pend]})}>
                    Guardar permisos de "{rol.nombre}"
                  </button>
                ) : (
                  <p style={{fontSize:12,color:'var(--text2)',marginTop:4}}>Sin cambios pendientes.</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Confirmar permisos */}
      {confirm && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirm(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Confirmar cambio de permisos</span>
              <button className="modal-close" onClick={()=>setConfirm(null)}>✕</button>
            </div>
            <div className="alert alert-warning" style={{lineHeight:1.6}}>
              Esto va a generar el siguiente cambio: el rol <strong>"{confirm.rol.nombre}"</strong> tendrá
              <strong> {confirm.codes.length}</strong> permiso(s) habilitado(s).
              Afecta a <strong>{confirm.rol.usuarios_count}</strong> usuario(s) con este rol
              (deben volver a iniciar sesión para que el cambio surta efecto).
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={()=>setConfirm(null)}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={guardarPermisos} disabled={saving}>
                {saving?'Guardando…':'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eliminar rol */}
      {delConfirm && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDelConfirm(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Eliminar rol</span>
              <button className="modal-close" onClick={()=>setDelConfirm(null)}>✕</button>
            </div>
            <p style={{marginBottom:12}}>Rol: <strong>{delConfirm.nombre}</strong></p>
            <div className="alert alert-warning">
              Esto va a generar el siguiente cambio: el rol "{delConfirm.nombre}" será
              eliminado permanentemente. Solo se puede eliminar si no tiene usuarios asignados.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={()=>setDelConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger btn-auto" onClick={eliminarRol} disabled={saving}>
                {saving?'Eliminando…':'Eliminar rol'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nuevo rol */}
      {modalNuevo && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalNuevo(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nuevo rol</span>
              <button className="modal-close" onClick={()=>setModalNuevo(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del rol *</label>
              <input className="form-control" value={nuevoForm.nombre} autoFocus
                onChange={e=>setNuevoForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Preceptor" />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <input className="form-control" value={nuevoForm.descripcion}
                onChange={e=>setNuevoForm(f=>({...f,descripcion:e.target.value}))} placeholder="Opcional" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={()=>setModalNuevo(false)}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={crearRol} disabled={saving||!nuevoForm.nombre.trim()}>
                {saving?'Creando…':'Crear rol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── USUARIOS Y ROLES (contenedor con tabs) ───────────────────────────────────────
function UsuariosYRoles({ user }) {
  const [tab, setTab] = useState('usuarios');
  return (
    <div>
      <div className="curso-tabs" style={{marginBottom:16}}>
        <div className={`curso-tab ${tab==='usuarios'?'active':''}`}     onClick={()=>setTab('usuarios')}>👤 Usuarios</div>
        <div className={`curso-tab ${tab==='roles'?'active':''}`}         onClick={()=>setTab('roles')}>🔑 Roles y Permisos</div>
        <div className={`curso-tab ${tab==='invitaciones'?'active':''}`}  onClick={()=>setTab('invitaciones')}>📩 Invitaciones</div>
      </div>
      {tab==='usuarios'
        ? <GestionUsuarios self={user} />
        : tab==='roles'
        ? <GestionRoles />
        : <GestionInvitaciones />}
    </div>
  );
}
