// ── PÁGINA DE ACEPTAR INVITACIÓN ─────────────────────────────────────────────────
function InvitacionPage({ token, onDone }) {
  const [info,    setInfo]   = useState(null); // {rol_nombre, nota}
  const [cargando,setCargando]= useState(true);
  const [form,    setForm]   = useState({ nombre:'', email:'', password:'', confirm:'' });
  const [saving,  setSaving] = useState(false);
  const [error,   setError]  = useState('');
  const [exito,   setExito]  = useState(false);

  useEffect(() => {
    apiFetch(`/api/invitaciones/verificar/${token}`)
      .then(d => setInfo(d))
      .catch(e => setError(e.message || 'Invitación inválida o expirada'))
      .finally(() => setCargando(false));
  }, [token]);

  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim())            { setError('El nombre es requerido'); return; }
    if (!form.email.trim())             { setError('El email es requerido'); return; }
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden'); return; }
    if (form.password.length < 6)       { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setSaving(true); setError('');
    try {
      await apiFetch('/api/invitaciones/aceptar', {
        method: 'POST',
        body:   { token, nombre: form.nombre.trim(), email: form.email.trim(), password: form.password },
      });
      setExito(true);
    } catch(err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{maxWidth:420}}>
        <div className="login-logo">
          <img src="/logo-epm.jpg" alt="EPM" style={{borderRadius:10}} />
          <h1>EPM</h1>
          <p>Escuela Popular de Música</p>
        </div>

        {cargando ? <div className="spinner"><div className="spin" /></div>
        : exito ? (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:12}}>🎉</div>
            <div className="alert alert-success" style={{marginBottom:20}}>
              ¡Cuenta creada! Ya podés iniciar sesión con tu email y contraseña.
            </div>
            <button className="btn btn-primary" onClick={onDone}>Ir al inicio de sesión</button>
          </div>
        ) : error && !info ? (
          <div>
            <div className="login-error">{error}</div>
            <p style={{fontSize:13,color:'var(--text2)',textAlign:'center',marginTop:8}}>
              Si el link expiró, pedile a quien te invitó que genere uno nuevo.
            </p>
            <button className="btn btn-primary" style={{marginTop:16}} onClick={onDone}>Volver al inicio</button>
          </div>
        ) : info ? (
          <>
            <div style={{background:'var(--bg3)',borderRadius:10,padding:14,marginBottom:20,textAlign:'center'}}>
              <div style={{fontSize:13,color:'var(--text2)',marginBottom:4}}>Fuiste invitado/a como</div>
              <div style={{fontWeight:800,fontSize:17,color:'var(--primary)'}}>{info.rol_nombre}</div>
              {info.nota && <div style={{fontSize:12,color:'var(--text2)',marginTop:4}}>{info.nota}</div>}
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Tu nombre completo *</label>
                <input className="form-control" value={form.nombre} required autoFocus
                  onChange={e => set('nombre', e.target.value)} placeholder="Nombre y Apellido" />
              </div>
              <div className="form-group">
                <label className="form-label">Tu email *</label>
                <input className="form-control" type="email" value={form.email} required
                  onChange={e => set('email', e.target.value)} placeholder="tucorreo@ejemplo.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña *</label>
                <PasswordInput value={form.password} required
                  onChange={e => set('password', e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar contraseña *</label>
                <PasswordInput value={form.confirm} required
                  onChange={e => set('confirm', e.target.value)} placeholder="Repetí la contraseña" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Creando cuenta...' : 'Crear mi cuenta →'}
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── GESTIÓN DE INVITACIONES ───────────────────────────────────────────────────────
const ESTADO_INVITE = {
  pendiente:  { label:'Pendiente',  cls:'inv-pendiente'  },
  aceptada:   { label:'Aceptada',   cls:'inv-aceptada'   },
  expirada:   { label:'Expirada',   cls:'inv-expirada'   },
  cancelada:  { label:'Cancelada',  cls:'inv-cancelada'  },
};

function GestionInvitaciones() {
  const [lista,     setLista]    = useState([]);
  const [roles,     setRoles]    = useState([]);
  const [cursos,    setCursos]   = useState([]);
  const [cargando,  setCargando] = useState(true);
  const [modal,     setModal]    = useState(false);
  const [linkModal, setLinkModal]= useState(null); // { token, rol_nombre }
  const [error,     setError]    = useState('');
  const [toast,     setToast]    = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [inv, rs, cs] = await Promise.all([
        apiFetch('/api/invitaciones'),
        apiFetch('/api/roles'),
        apiFetch('/api/cursos'),
      ]);
      setLista(inv); setRoles(rs); setCursos(cs);
    } catch(e) { setError(e.message); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cancelar = async (id) => {
    if (!confirm('¿Cancelar esta invitación?')) return;
    try { await apiFetch(`/api/invitaciones/${id}`, { method:'DELETE' }); showToast('Invitación cancelada'); cargar(); }
    catch(e) { alert(e.message); }
  };

  const regenerar = async (id) => {
    try {
      const data = await apiFetch(`/api/invitaciones/${id}/reenviar`, { method:'POST' });
      cargar();
      setLinkModal({ token: data.token, rol_nombre: data.rol_nombre });
    } catch(e) { alert(e.message); }
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta invitación del historial?')) return;
    try { await apiFetch(`/api/invitaciones/${id}`, { method:'DELETE' }); showToast('Eliminada'); cargar(); }
    catch(e) { alert(e.message); }
  };

  const pendientes = lista.filter(i => i.estado === 'pendiente');
  const resto      = lista.filter(i => i.estado !== 'pendiente');

  return (
    <div>
      <div className="section-header">
        <h2 style={{fontSize:16,fontWeight:800}}>🔗 Invitaciones por link</h2>
        <button className="btn btn-primary btn-auto" onClick={() => setModal(true)}>
          + Generar link
        </button>
      </div>

      {toast && <div className="alert alert-success" style={{marginBottom:12}}>{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {cargando ? <div className="spinner"><div className="spin"/></div> : (
        lista.length === 0
          ? <div className="empty-state"><div className="empty-state-icon">🔗</div><div>No hay invitaciones generadas</div></div>
          : <>
              {pendientes.length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--text2)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.05em'}}>
                    Activas ({pendientes.length})
                  </div>
                  {pendientes.map(inv => <InvRow key={inv.id} inv={inv} onCancelar={cancelar} onRegenerarLink={regenerar} onEliminar={eliminar} />)}
                </div>
              )}
              {resto.length > 0 && (
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--text2)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.05em'}}>
                    Historial
                  </div>
                  {resto.map(inv => <InvRow key={inv.id} inv={inv} onCancelar={cancelar} onRegenerarLink={regenerar} onEliminar={eliminar} />)}
                </div>
              )}
            </>
      )}

      {modal && (
        <ModalInvitar roles={roles} cursos={cursos}
          onClose={() => setModal(false)}
          onGenerado={(data) => {
            setModal(false);
            cargar();
            setLinkModal({ token: data.token, rol_nombre: data.rol_nombre });
          }}
        />
      )}
      {linkModal && (
        <ModalLinkInvitacion
          token={linkModal.token} rolNombre={linkModal.rol_nombre}
          onClose={() => setLinkModal(null)}
        />
      )}
    </div>
  );
}

function InvRow({ inv, onCancelar, onRegenerarLink, onEliminar }) {
  const est = ESTADO_INVITE[inv.estado] || { label: inv.estado, cls: 'inv-pendiente' };
  const dias = Math.ceil((new Date(inv.expires_at) - Date.now()) / 86400000);
  return (
    <div className="inv-row">
      <div style={{flex:1,minWidth:0}}>
        <div className="inv-email">
          {inv.nota || `Rol: ${inv.rol_nombre}`}
          {inv.email && <span style={{fontSize:11,color:'var(--text2)',marginLeft:8}}>→ {inv.email}</span>}
        </div>
        <div className="inv-meta">
          {inv.rol_nombre}
          {inv.estado === 'pendiente' && dias > 0 && ` · expira en ${dias}d`}
          {inv.estado === 'pendiente' && dias <= 0 && ' · expira hoy'}
          {' · '}{inv.creado_por_nombre}
        </div>
      </div>
      <span className={`inv-badge ${est.cls}`}>{est.label}</span>
      {inv.estado === 'pendiente' && (
        <button className="btn-icon" title="Cancelar" onClick={() => onCancelar(inv.id)}>✕</button>
      )}
      {(inv.estado === 'expirada' || inv.estado === 'cancelada') && (<>
        <button className="btn-icon" title="Generar nuevo link" onClick={() => onRegenerarLink(inv.id)}>↩</button>
        <button className="btn-icon btn-icon-danger" title="Eliminar del historial" onClick={() => onEliminar(inv.id)}>🗑</button>
      </>)}
    </div>
  );
}

// Muestra el link con botones Copiar y Compartir
function ModalLinkInvitacion({ token, rolNombre, onClose }) {
  const link    = `${window.location.origin}/?invite=${token}`;
  const [copied, setCopied] = useState(false);

  const copiar = () => {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  };

  const compartir = () => {
    if (navigator.share) {
      navigator.share({
        title: `Invitación EPM — ${rolNombre}`,
        text:  `Te invitamos a crear tu cuenta en el sistema de la Escuela Popular de Música (como ${rolNombre}).`,
        url:   link,
      });
    } else { copiar(); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal-header">
          <span className="modal-title">🔗 Link de invitación generado</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{background:'var(--bg3)',borderRadius:8,padding:10,marginBottom:14,textAlign:'center'}}>
          <div style={{fontSize:12,color:'var(--text2)',marginBottom:4}}>Invitación como</div>
          <div style={{fontWeight:800,fontSize:15,color:'var(--primary)'}}>{rolNombre}</div>
        </div>
        <div style={{background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:8,padding:'10px 12px',
                     fontFamily:'monospace',fontSize:12,wordBreak:'break-all',marginBottom:14,color:'var(--text2)'}}>
          {link}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <button className="btn btn-primary btn-auto" style={{flex:1}} onClick={copiar}>
            {copied ? '✅ ¡Copiado!' : '📋 Copiar link'}
          </button>
          <button className="btn btn-secondary btn-auto" style={{flex:1}} onClick={compartir}>
            📱 Compartir
          </button>
        </div>
        <div className="alert alert-warning" style={{fontSize:12,marginBottom:0}}>
          Compartí este link por WhatsApp o el medio que prefieras. Expira en <strong>7 días</strong> y solo puede usarse una vez.
        </div>
      </div>
    </div>
  );
}

function ModalInvitar({ roles, cursos, onClose, onGenerado }) {
  const [rolId,     setRolId]    = useState(String(roles[0]?.id || ''));
  const [cursosIds, setCursosIds]= useState([]);
  const [nota,      setNota]     = useState('');
  const [saving,    setSaving]   = useState(false);
  const [error,     setError]    = useState('');

  const toggleCurso = (id) => setCursosIds(c => c.includes(id) ? c.filter(x=>x!==id) : [...c, id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!rolId) { setError('Seleccioná un rol'); return; }
    setSaving(true); setError('');
    try {
      const data = await apiFetch('/api/invitaciones', {
        method: 'POST',
        body:   { rol_id: rolId, cursos_ids: cursosIds, nota: nota || undefined },
      });
      onGenerado(data);
    } catch(err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">🔗 Generar link de invitación</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Rol asignado *</label>
            <select className="form-control" value={rolId} onChange={e => setRolId(e.target.value)} required>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          {cursos.length > 0 && (
            <div className="form-group">
              <label className="form-label">Cursos asignados (opcional)</label>
              <div className="curso-checks">
                {cursos.map(c => (
                  <button key={c.id} type="button"
                    className={`curso-check-btn ${cursosIds.includes(c.id)?'selected':''}`}
                    onClick={() => toggleCurso(c.id)}>
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Nota interna (opcional)</label>
            <input className="form-control" value={nota} onChange={e => setNota(e.target.value)}
              placeholder="Ej: Para Ana González, docente de guitarra" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-auto" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
              {saving ? 'Generando...' : '🔗 Generar link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
