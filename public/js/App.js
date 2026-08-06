function Layout({ user, onUserUpdate }) {
  const [section, setSection] = useHashSection('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [deepLink, setDeepLink] = useState(null); // { tipo, id, ts } — destino de una notificación
  const [filtroNivel, setFiltroNivel] = useState(null); // { curso_id, instrumento_id, ts } — desde un badge de inscripción
  const [tourActivo, setTourActivo] = useState(false);
  const title = NAV.find(n => n.id === section)?.label || 'Dashboard';
  const puede = (p) => !p || user.permisos?.includes(p);

  // Tour guiado de bienvenida: se dispara solo la primera vez (usuarios.tour_completado=0).
  useEffect(() => {
    if (!user.tour_completado) setTourActivo(true);
  }, []);

  const tourPasos = TOUR_ORDEN
    .filter(id => puede(NAV.find(n => n.id === id)?.permiso))
    .map(id => ({ id, descripcion: SECCION_INFO[id]?.descripcion || '' }));

  const cerrarTour = () => {
    setTourActivo(false);
    apiFetch(`/api/usuarios/${user.id}/tour`, { method:'PUT' }).catch(() => {});
    onUserUpdate?.({ tour_completado: true });
  };

  // Click en una notificación con entidad asociada → navega a la sección correspondiente.
  const irANotificacion = (tipo, id) => {
    const destino = { reunion:'reuniones', legajo:'estudiantes', asistencia:'estudiantes' }[tipo];
    if (!destino) return; // ej: 'evento' no tiene vista de detalle propia todavía
    setSection(destino);
    setDeepLink({ tipo, id: Number(id), ts: Date.now() });
  };

  // Click en un badge de inscripción ("Tiburones · Canto") en Estudiantes → Reportes
  // filtrado por ese curso + ese instrumento.
  const verReporteNivel = (curso_id, instrumento_id) => {
    setSection('reportes');
    setFiltroNivel({ curso_id, instrumento_id, ts: Date.now() });
  };

  return (
    <div className="layout">
      <Sidebar
        user={user} section={section}
        onSection={setSection}
        open={menuOpen} onClose={() => setMenuOpen(false)}
      />
      <div className="main">
        <div className="topbar">
          <button className="topbar-menu" onClick={() => setMenuOpen(o => !o)}>☰</button>
          <span className="topbar-title">{title}</span>
          <div className="header-icons-wrap">
            <CumpleanosBell />
            <NotificacionesBell user={user} onNavigate={irANotificacion} />
          </div>
        </div>
        <AyudaSeccion section={section} onIniciarTour={() => setTourActivo(true)} />
        <div className="page">
          {section === 'dashboard'
            ? <Dashboard user={user} onSection={setSection} />
            : section === 'mi-perfil'
            ? <PerfilUsuario usuarioId={user.id} user={user} puede={puede}
                onVolver={() => setSection('dashboard')} onSelfUpdate={onUserUpdate} titulo="👤 Mi perfil"
                onIniciarTour={() => setTourActivo(true)} />
            : section === 'estudiantes'
            ? <Estudiantes user={user} deepLink={deepLink} onVerReporteNivel={verReporteNivel} />
            : section === 'asistencia'
            ? <AsistenciasView user={user} />
            : section === 'reportes'
            ? <Reportes user={user} onNavigate={irANotificacion} filtroNivel={filtroNivel} />
            : section === 'usuarios'
            ? <UsuariosYRoles user={user} />
            : section === 'planificaciones'
            ? <Planificaciones user={user} />
            : section === 'backup'
            ? <Backup />
            : section === 'cursos'
            ? <Cursos user={user} />
            : section === 'instrumentos'
            ? <Instrumentos user={user} />
            : section === 'calendario'
            ? <Calendario user={user} />
            : section === 'docentes'
            ? <Docentes user={user} />
            : section === 'inventario'
            ? <Inventario user={user} />
            : section === 'proyectos'
            ? <Proyectos user={user} />
            : section === 'reuniones'
            ? <Reuniones user={user} deepLink={deepLink} />
            : section === 'finanzas'
            ? <Finanzas />
            : <Placeholder id={section} />}
        </div>
      </div>
      {tourActivo && tourPasos.length > 0 && (
        <TourGuiado
          pasos={tourPasos}
          onAbrirSidebar={() => setMenuOpen(true)}
          onCerrarSidebar={() => setMenuOpen(false)}
          onFinish={cerrarTour}
          onSkip={cerrarTour}
        />
      )}
    </div>
  );
}

// ── APP ─────────────────────────────────────────────────────────────────────────
// ── BANNER DE INSTALACIÓN PWA ──────────────────────────────────────────────────
// Android/Chrome/Edge disparan 'beforeinstallprompt' y permiten disparar el prompt
// nativo por código. iOS Safari NO tiene ese evento — ahí solo se puede guiar al
// usuario a hacerlo a mano (Compartir → Agregar a inicio).
// A pedido: el banner aparece SIEMPRE que se entra a la app (no se guarda ninguna
// preferencia de "ya lo vi"), pero se puede cerrar y desaparece por el resto de esa
// visita — sin tocar ningún storage, así que la próxima vez que se entre (nueva
// pestaña, recarga, o abrir la app instalada/agregada) vuelve a aparecer.
// Solo tiene sentido en celulares/tablets — en desktop no se muestra nunca (doble
// chequeo: user agent Y ancho de pantalla, para cubrir tanto un desktop angosto
// como una tablet grande que no matchee el user agent).
function esMobileOTablet() {
  const uaMovil = /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent);
  const pantallaChica = window.innerWidth < 768;
  return uaMovil || pantallaChica;
}
function InstallBanner() {
  const [prompt,  setPrompt]  = useState(null);
  const [visible, setVisible] = useState(false);
  const [esIOS,   setEsIOS]   = useState(false);

  useEffect(() => {
    if (!esMobileOTablet()) return;

    const yaInstalada = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // iOS
    if (yaInstalada) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (ios) { setEsIOS(true); setVisible(true); return; }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const cerrar = () => setVisible(false);

  const instalar = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    cerrar();
  };

  if (!visible) return null;

  return (
    <div className="install-banner">
      <span className="install-banner-icon">📲</span>
      <div className="install-banner-text">
        {esIOS
          ? <>Instalá EPM en tu celular: tocá <strong>Compartir</strong> y luego <strong>"Agregar a inicio"</strong>.</>
          : <>Instalá EPM en tu celular para acceso rápido.</>}
      </div>
      {!esIOS && <button className="install-banner-btn" onClick={instalar}>Instalar</button>}
      <button className="install-banner-close" onClick={cerrar} title="Cerrar">✕</button>
    </div>
  );
}

function App() {
  const [user,        setUser]       = useState(null);
  const [loading,     setLoading]    = useState(true);
  const [inviteToken, setInviteToken] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('invite') || null;
  });

  useEffect(() => {
    if (inviteToken) { setLoading(false); return; }
    if (!getUser()) { setLoading(false); return; }
    apiFetch('/api/auth/me')
      .then(d => {
        // Reemplaza token y usuario con datos frescos de la DB.
        // Resuelve tokens viejos que no tengan todos los campos (ej: institucion_id, permisos).
        if (d.token) localStorage.setItem('epm_token', d.token);
        localStorage.setItem('epm_user', JSON.stringify(d.user));
        setUser(d.user);
      })
      .catch(() => {
        localStorage.removeItem('epm_token');
        localStorage.removeItem('epm_user');
      })
      .finally(() => setLoading(false));
  }, []);

  // Actualiza el usuario en memoria + localStorage sin necesitar re-login
  // (ej: al cambiar nombre o foto desde "Mi perfil").
  const onUserUpdate = (patch) => {
    setUser(u => {
      const nu = { ...u, ...patch };
      localStorage.setItem('epm_user', JSON.stringify(nu));
      return nu;
    });
  };

  let contenido;
  if (loading) {
    contenido = (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
                   background:'linear-gradient(135deg,#1e1b4b,#312e81)'}}>
        <div className="spinner">
          <div className="spin" style={{borderColor:'rgba(255,255,255,.3)',borderTopColor:'#a5b4fc'}} />
        </div>
      </div>
    );
  } else if (inviteToken) {
    contenido = <InvitacionPage token={inviteToken} onDone={() => { setInviteToken(null); window.history.replaceState({}, '', '/'); }} />;
  } else {
    contenido = user ? <Layout user={user} onUserUpdate={onUserUpdate} /> : <LoginPage onLogin={setUser} />;
  }

  return <>{contenido}<InstallBanner /></>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
