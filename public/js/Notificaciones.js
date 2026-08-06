// ── NOTIFICACIONES BELL ─────────────────────────────────────────────────────────
function NotificacionesBell({ user, onNavigate }) {
  const [open,          setOpen]         = useState(false);
  const [notifs,        setNotifs]       = useState([]);
  const [noLeidas,      setNoLeidas]     = useState(0);
  const [cargando,      setCargando]     = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const d = await apiFetch('/api/notificaciones/no-leidas');
      setNoLeidas(d.total);
    } catch(e) {}
  }, []);

  // Poll cada 30 s
  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => clearInterval(t);
  }, [fetchCount]);

  const abrirPanel = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setCargando(true);
    try {
      const data = await apiFetch('/api/notificaciones');
      setNotifs(data);
      if (noLeidas > 0) {
        await apiFetch('/api/notificaciones/leer-todas', { method:'PUT' });
        setNoLeidas(0);
      }
    } catch(e) {}
    finally { setCargando(false); }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest('.notif-bell-wrap')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dotCls = (tipo) => `notif-dot notif-dot-${tipo}`;

  return (
    <div className="notif-bell-wrap">
      <button className="notif-bell-btn" onClick={abrirPanel} title="Notificaciones">
        🔔
        {noLeidas > 0 && <span className="notif-badge">{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>Notificaciones</span>
            {notifs.some(n => !n.leida) && (
              <button className="btn btn-secondary btn-auto" style={{fontSize:11,padding:'3px 8px'}}
                onClick={async () => {
                  await apiFetch('/api/notificaciones/leer-todas', { method:'PUT' });
                  setNotifs(ns => ns.map(n => ({...n, leida:1})));
                  setNoLeidas(0);
                }}>
                ✓ Leer todo
              </button>
            )}
          </div>
          <div className="notif-panel-list">
            {cargando ? (
              <div className="notif-empty">Cargando...</div>
            ) : notifs.length === 0 ? (
              <div className="notif-empty">Sin notificaciones</div>
            ) : notifs.map(n => (
              <div key={n.id} className={`notif-item ${!n.leida ? 'unread' : ''}`}
                onClick={async () => {
                  if (!n.leida) {
                    await apiFetch(`/api/notificaciones/${n.id}/leer`, { method:'PUT' });
                    setNotifs(ns => ns.map(x => x.id===n.id ? {...x,leida:1} : x));
                  }
                  if (n.entidad_tipo && n.entidad_id && onNavigate) {
                    setOpen(false);
                    onNavigate(n.entidad_tipo, n.entidad_id);
                  }
                }}>
                <div className="notif-item-header">
                  <div className={dotCls(n.tipo)} />
                  <div className="notif-item-titulo">{n.titulo}</div>
                </div>
                <div className="notif-item-msg">{n.mensaje}</div>
                <div className="notif-item-time">{tiempoRelativo(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CUMPLEAÑOS BELL (🎂) ────────────────────────────────────────────────────────
// Separado de la campanita de notificaciones: lee en vivo de /api/cumpleanios
// (vía el hook compartido) en vez de depender de registros en la tabla `notificaciones`.
function CumpleanosBell() {
  const [open, setOpen] = useState(false);
  const { cumpleHoy, cumpleProx, cargando } = useCumpleaniosProximos();
  const total = cumpleHoy.length + cumpleProx.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest('.cumple-bell-wrap')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const Fila = ({ c, hoy }) => (
    <div className={`cumple-panel-item ${hoy ? 'hoy' : ''}`}>
      <span style={{fontSize:18}}>{hoy ? '🎂' : (c.tipo === 'usuario' ? '👩‍🏫' : '👦')}</span>
      <div>
        <div className="cumple-panel-nombre">{c.nombre}</div>
        <div className="cumple-panel-meta">
          {cumpleEtiqueta(c)} · {hoy ? `cumple ${c.edad} hoy` : `${c.dia}/${c.mes} · cumple ${c.edad}`}
        </div>
      </div>
    </div>
  );

  const Grupo = ({ lista, hoy }) => {
    const ests  = lista.filter(c => c.tipo === 'estudiante');
    const staff = lista.filter(c => c.tipo === 'usuario');
    return <>
      {ests.map((c,i) => <Fila key={'e'+i} c={c} hoy={hoy} />)}
      {staff.map((c,i) => <Fila key={'s'+i} c={c} hoy={hoy} />)}
    </>;
  };

  return (
    <div className="cumple-bell-wrap">
      <button className="cumple-bell-btn" onClick={() => setOpen(o => !o)} title="Cumpleaños">
        🎂
        {total > 0 && <span className="cumple-badge">{total > 9 ? '9+' : total}</span>}
      </button>
      {open && (
        <div className="notif-panel cumple-panel">
          <div className="notif-panel-header">
            <span>🎂 Cumpleaños</span>
          </div>
          <div className="notif-panel-list">
            {cargando ? (
              <div className="notif-empty">Cargando...</div>
            ) : total === 0 ? (
              <div className="notif-empty">No hay cumpleaños esta semana</div>
            ) : (
              <>
                {cumpleHoy.length > 0 && (
                  <>
                    <div className="cumple-panel-section">🎂 Hoy cumple</div>
                    <Grupo lista={cumpleHoy} hoy />
                  </>
                )}
                {cumpleProx.length > 0 && (
                  <>
                    <div className="cumple-panel-section">📅 Esta semana</div>
                    <Grupo lista={cumpleProx} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
