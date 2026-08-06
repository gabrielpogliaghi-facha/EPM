// ── LAYOUT ──────────────────────────────────────────────────────────────────────
// Sincroniza la sección activa con el hash de la URL (#/seccion) para que el botón
// "atrás" del navegador (muy usado en celular) navegue dentro de la app en vez de
// salir de ella. Cada cambio de sección agrega una entrada al historial del navegador;
// "atrás" dispara 'hashchange' y volvemos a la sección anterior sin recargar nada.
function useHashSection(defaultSection) {
  const leerHash = () => (window.location.hash || '').replace(/^#\/?/, '') || defaultSection;
  const [section, setSectionState] = useState(leerHash);

  useEffect(() => {
    const onHashChange = () => setSectionState(leerHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setSection = (id) => {
    if (id === leerHash()) return;
    window.location.hash = '/' + id;
  };

  return [section, setSection];
}

// ── TOUR GUIADO DE BIENVENIDA ──────────────────────────────────────────────────
// Overlay oscuro con un "agujero" (spotlight) sobre el ítem del menú activo + un
// tooltip con la descripción de esa sección. Implementado 100% con CSS/JS propio
// (sin librerías externas). En mobile fuerza la apertura del sidebar para poder
// medir y resaltar los ítems, y lo vuelve a cerrar al terminar.
function TourGuiado({ pasos, onAbrirSidebar, onCerrarSidebar, onFinish, onSkip }) {
  const [i,    setI]    = useState(0);
  const [rect, setRect] = useState(null);
  const paso = pasos[i];
  const esMobile = window.innerWidth < 769;

  useEffect(() => {
    if (esMobile) onAbrirSidebar();
    return () => { if (esMobile) onCerrarSidebar(); };
  }, []);

  const medir = useCallback(() => {
    const el = document.querySelector(`[data-tour="${paso.id}"]`);
    if (el) setRect(el.getBoundingClientRect());
  }, [paso.id]);

  useEffect(() => {
    // Se limpia el rect anterior para no mostrar el tooltip un instante en la posición
    // del paso viejo mientras el nuevo elemento todavía se está scrolleando a la vista.
    setRect(null);
    let t2;
    const t1 = setTimeout(() => {
      // Scrollea el elemento resaltado al centro de su contenedor (el sidebar tiene su
      // propio scroll interno, `.sidebar-nav{overflow-y:auto}`) ANTES de medir su posición
      // — si no, un ítem lejos en la lista (ej. "Backup") puede quedar fuera del área
      // visible y el tooltip se calcula mal / queda cortado.
      const el = document.querySelector(`[data-tour="${paso.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      t2 = setTimeout(medir, 350); // espera a que termine el scroll suave antes de medir
    }, esMobile ? 350 : 60); // en mobile primero espera a que el sidebar termine de abrirse
    window.addEventListener('resize', medir);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', medir); };
  }, [medir]);

  const siguiente = () => { if (i < pasos.length - 1) setI(i + 1); else onFinish(); };
  const anterior  = () => { if (i > 0) setI(i - 1); };

  // Posición del tooltip: SIEMPRE dentro del viewport. Se elige el lado (arriba/abajo)
  // según cuál tenga más espacio libre, y se limita con max-height + scroll interno como
  // red de seguridad final para que nunca quede cortado, ni siquiera en un viewport chico.
  const vw = window.innerWidth, vh = window.innerHeight;
  const margin = 12;
  const tw = Math.min(320, vw - margin * 2);
  let tooltipStyle = { width: tw, left: margin, top: vh / 2 - 80 };
  if (rect) {
    const espacioAbajo  = vh - rect.bottom - margin;
    const espacioArriba = rect.top - margin;
    const vaAbajo = espacioAbajo >= 170 || espacioAbajo >= espacioArriba;
    const left = Math.max(margin, Math.min(rect.left, vw - tw - margin));
    if (vaAbajo) {
      const top = Math.min(rect.bottom + margin, vh - margin - 60);
      tooltipStyle = { width: tw, left, top, maxHeight: Math.max(120, vh - top - margin), overflowY: 'auto' };
    } else {
      const bottom = Math.max(vh - rect.top + margin, margin + 60);
      tooltipStyle = { width: tw, left, bottom, maxHeight: Math.max(120, vh - bottom - margin), overflowY: 'auto' };
    }
  }

  return (
    <div className="tour-overlay">
      {rect && (
        <div className="tour-spotlight" style={{
          top: rect.top - 6, left: rect.left - 6,
          width: rect.width + 12, height: rect.height + 12,
        }} />
      )}
      <div className="tour-tooltip" style={tooltipStyle}>
        <div className="tour-tooltip-title">{NAV.find(n=>n.id===paso.id)?.icon} {NAV.find(n=>n.id===paso.id)?.label}</div>
        <div className="tour-tooltip-desc">{paso.descripcion}</div>
        <div className="tour-tooltip-foot">
          <span className="tour-tooltip-progress">{i+1} / {pasos.length}</span>
          <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
            <button className="tour-btn-skip" onClick={onSkip}>Saltar tour</button>
            {i > 0 && <button className="tour-btn-prev" onClick={anterior}>← Atrás</button>}
            <button className="tour-btn-next" onClick={siguiente}>
              {i < pasos.length - 1 ? 'Siguiente →' : '¡Listo! 🎉'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PANEL DE AYUDA / TIPS POR SECCIÓN ──────────────────────────────────────────
// Ícono ❓ fijo arriba a la derecha de cada sección. Al tocarlo despliega la
// descripción de esa sección + tips de uso. El usuario puede ocultar los tips
// para siempre ("No mostrar más tips"); esa preferencia se guarda en localStorage
// (es una preferencia liviana de UI, no un dato que necesite viajar entre dispositivos).
function AyudaSeccion({ section, onIniciarTour }) {
  const [abierto, setAbierto] = useState(false);
  const [oculto,  setOculto]  = useState(() => localStorage.getItem('epm_tips_ocultos') === '1');
  const info = SECCION_INFO[section];

  if (!info || oculto) return null;

  const noMostrarMas = () => {
    localStorage.setItem('epm_tips_ocultos', '1');
    setOculto(true);
  };

  return (
    <>
      <button className="ayuda-fab" onClick={() => setAbierto(a => !a)} title="Ayuda de esta sección">
        {abierto ? '✕' : '❓'}
      </button>
      {abierto && (
        <div className="ayuda-panel">
          <div className="ayuda-panel-header">
            <strong>{NAV.find(n=>n.id===section)?.icon} {NAV.find(n=>n.id===section)?.label}</strong>
            <button className="ayuda-panel-close" onClick={() => setAbierto(false)}>✕</button>
          </div>
          <p className="ayuda-panel-desc">{info.descripcion}</p>
          {info.tips?.length > 0 && (
            <ul className="ayuda-panel-tips">
              {info.tips.map((t, idx) => <li key={idx}>{t}</li>)}
            </ul>
          )}
          {onIniciarTour && (
            <button className="ayuda-panel-tour" onClick={() => { setAbierto(false); onIniciarTour(); }}>
              🎓 Repetir tour de bienvenida
            </button>
          )}
          <button className="ayuda-panel-hide" onClick={noMostrarMas}>No mostrar más tips</button>
        </div>
      )}
    </>
  );
}

