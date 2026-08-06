// ── INPUT DE CONTRASEÑA CON BOTÓN MOSTRAR/OCULTAR ─────────────────────────────────
function PasswordInput({ value, onChange, placeholder, required, className, id, autoComplete }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div style={{position:'relative'}}>
      <input
        id={id}
        className={className || 'form-control'}
        style={{paddingRight:40}}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        style={{
          position:'absolute', right:0, top:0, bottom:0, width:40,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'none', border:'none', cursor:'pointer', fontSize:18,
          color:'var(--text2)', padding:0,
        }}
      >{visible ? '🙈' : '👁'}</button>
    </div>
  );
}

// ── LOGIN ────────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [form,    setForm]    = useState({ email:'', password:'' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showInfo,setShowInfo]= useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', { method:'POST', body:form });
      localStorage.setItem('epm_token', data.token);
      localStorage.setItem('epm_user',  JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo-epm.jpg" alt="Logo EPM" />
          <h1>EPM</h1>
          <p>Sistema de Gestión Escolar</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input className="form-control" type="email" placeholder="usuario@epm.edu.ar"
              value={form.email} onChange={e => setForm({...form, email:e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <PasswordInput placeholder="••••••••"
              value={form.password} onChange={e => setForm({...form, password:e.target.value})} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:'16px'}}>
          {!showInfo
            ? <button onClick={() => setShowInfo(true)}
                style={{background:'none',border:'none',color:'var(--primary)',cursor:'pointer',fontSize:'13px',textDecoration:'underline'}}>
                ¿Olvidaste tu contraseña?
              </button>
            : <div style={{background:'var(--bg3)',borderRadius:8,padding:'12px 14px',fontSize:13,color:'var(--text2)',lineHeight:1.6,textAlign:'left'}}>
                <strong style={{color:'var(--text)'}}>¿Olvidaste tu contraseña?</strong><br/>
                Contactá a quien administre el sistema para que te la resetee desde Usuarios y Roles.
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ── SIDEBAR ─────────────────────────────────────────────────────────────────────
function Sidebar({ user, section, onSection, open, onClose }) {
  const puede = (p) => !p || user.permisos?.includes(p);
  const initials = user.nombre.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();

  const logout = () => {
    localStorage.removeItem('epm_token');
    localStorage.removeItem('epm_user');
    window.location.reload();
  };

  return (
    <>
      <div className={`sidebar-overlay ${open?'open':''}`} onClick={onClose} />
      <nav className={`sidebar ${open?'open':''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-img">
            <img src="/logo-epm.jpg" alt="Logo EPM" />
          </div>
          <div>
            <h1>EPM</h1>
            <p>{user.institucion_nombre}</p>
          </div>
        </div>
        <div className="sidebar-nav">
          {NAV_GROUPS.map((grupo, gi) => {
            const visibles = grupo.items.filter(item => puede(item.permiso));
            if (!visibles.length) return null;
            return (
              <div key={gi}>
                {grupo.label && <div className="nav-group-label">{grupo.label}</div>}
                {visibles.map(item => (
                  <div key={item.id} data-tour={item.id}
                    className={`nav-item ${section===item.id?'active':''}`}
                    onClick={() => { onSection(item.id); onClose(); }}>
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="sidebar-user">
          <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0,cursor:'pointer'}}
            onClick={() => { onSection('mi-perfil'); onClose(); }} title="Ver mi perfil">
            <div className="user-avatar">
              {user.foto_path
                ? <img src={user.foto_path} alt={user.nombre} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}} />
                : initials}
            </div>
            <div className="user-info">
              <div className="user-name">{user.nombre}</div>
              <div className="user-role">{user.rol_nombre}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout} title="Cerrar sesión">⎋</button>
        </div>
      </nav>
    </>
  );
}
