// ── DASHBOARD ───────────────────────────────────────────────────────────────────
function ProximosEventos({ user, onSection }) {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user.permisos?.includes('ver_calendario')) { setCargando(false); return; }
    apiFetch('/api/eventos/proximos?limite=5')
      .then(data => setEventos(data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  if (!user.permisos?.includes('ver_calendario') || (!cargando && eventos.length === 0)) return null;

  return (
    <div className="card" style={{marginBottom:16}}>
      <div className="card-title" style={{marginBottom:8}}>
        📅 Próximos eventos
        <button className="btn btn-secondary btn-auto" style={{marginLeft:'auto',fontSize:12,padding:'4px 10px'}}
          onClick={() => onSection('calendario')}>Ver todos</button>
      </div>
      {cargando ? <div style={{color:'var(--text2)',fontSize:13}}>Cargando...</div> : (
        eventos.map(ev => (
          <div key={ev.id} className="prox-evento" onClick={() => onSection('calendario')}>
            <div className="prox-evento-dot" style={{background:tipoColor(ev.tipo)}} />
            <div>
              <div className="prox-evento-titulo">{ev.titulo}</div>
              <div className="prox-evento-fecha">
                {formatFechaCalendario(ev.fecha)}
                {ev.fecha_fin && ev.fecha_fin !== ev.fecha ? ` al ${formatFechaCalendario(ev.fecha_fin)}` : ''}
                {ev.hora_inicio ? ` · ${formatHora(ev.hora_inicio)}` : ''}
                {ev.lugar ? ` · ${ev.lugar}` : ''}
                <span style={{marginLeft:6,background:tipoColor(ev.tipo)+'22',color:tipoColor(ev.tipo),
                  borderRadius:8,padding:'1px 7px',fontSize:10,fontWeight:700}}>
                  {tipoLabel(ev.tipo)}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Etiqueta de tipo + rol para un cumpleaños ('estudiante' o 'usuario' — Docente/Operador/Gestión)
function cumpleEtiqueta(c) {
  return c.tipo === 'usuario' ? `👩‍🏫 ${c.rol_nombre || 'Equipo'}` : '👦 Estudiante';
}

// Hook compartido: trae los cumpleaños del mes actual (+ el mes siguiente si la ventana de
// "próximos 7 días" cruza el límite de mes) y devuelve los grupos ya calculados. Usado tanto
// por la card del Dashboard como por el ícono 🎂 del header, para no duplicar esta lógica.
function useCumpleaniosProximos() {
  const [cumples,  setCumples]  = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const hoy = new Date();
    const mesActual  = hoy.getMonth() + 1, anioActual = hoy.getFullYear();
    // La ventana de "próximos 7 días" puede cruzar a mes siguiente (ej: hoy 28, +7 = mes que viene)
    const finVentana  = new Date(hoy); finVentana.setDate(hoy.getDate() + 7);
    const cruzaMes    = finVentana.getMonth() !== hoy.getMonth();

    const reqs = [apiFetch(`/api/cumpleanios?mes=${mesActual}&anio=${anioActual}`)
      .then(d => d.map(c => ({...c, mes: mesActual, anio: anioActual})))];
    if (cruzaMes) {
      const mesSig = finVentana.getMonth() + 1, anioSig = finVentana.getFullYear();
      reqs.push(apiFetch(`/api/cumpleanios?mes=${mesSig}&anio=${anioSig}`)
        .then(d => d.map(c => ({...c, mes: mesSig, anio: anioSig}))));
    }
    Promise.all(reqs)
      .then(results => setCumples(results.flat()))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const finVentana  = new Date(hoySinHora); finVentana.setDate(finVentana.getDate() + 7);
  // Próxima ocurrencia real de cada cumpleaños + edad que cumple ese día
  const conFecha = cumples.map(c => ({
    ...c,
    fechaOcurrencia: new Date(c.anio, c.mes - 1, c.dia),
    edad: c.anio - parseInt(c.fecha_nacimiento.slice(0, 4)),
  }));

  const cumpleHoy  = conFecha.filter(c => c.fechaOcurrencia.getTime() === hoySinHora.getTime());
  const cumpleProx = conFecha.filter(c => c.fechaOcurrencia > hoySinHora && c.fechaOcurrencia <= finVentana);

  return { cumples: conFecha, cumpleHoy, cumpleProx, cargando, mesActual: hoy.getMonth() + 1 };
}

// Ícono(s) de nivel/curso para una tarjeta de cumpleaños. Un estudiante puede estar en
// más de un curso (varios instrumentos) — en ese caso se muestran todos juntos (ej: 🐟🐬).
// El equipo (docentes/operadores/gestión) no tiene curso: en vez de un único ícono fijo
// (repetitivo si hay varios cumpleaños de adultos en la lista), se elige entre un puñado
// de "personitas" variadas — determinístico por nombre, así la misma persona siempre
// muestra el mismo ícono entre renders/recargas, pero personas distintas se ven distintas.
const NIVEL_EMOJI  = { Mojarritas:'🐟', Delfines:'🐬', Tiburones:'🦈', Pulpos:'🐙' };
const NIVEL_ORDEN  = { Mojarritas:1, Delfines:2, Tiburones:3, Pulpos:4 };
const EQUIPO_EMOJIS = ['👩‍🏫','👨‍🏫','🧑‍🏫','👩‍🎤','👨‍🎤','🧑‍🎨','👩‍💼','👨‍💼'];
function emojiEquipo(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  return EQUIPO_EMOJIS[hash % EQUIPO_EMOJIS.length];
}
function cumpleIconos(c) {
  if (c.tipo === 'usuario') return emojiEquipo(c.nombre);
  if (!c.cursos?.length) return '🎵'; // estudiante sin inscripción activa todavía
  return [...c.cursos]
    .sort((a, b) => (NIVEL_ORDEN[a]||99) - (NIVEL_ORDEN[b]||99))
    .map(n => NIVEL_EMOJI[n] || '📚').join('');
}

// Card compacta de un cumpleaños: nombre, ícono(s) de curso y fecha. El de hoy se
// resalta con fondo especial + 🎂 extra.
function CumpleMesCard({ c }) {
  return (
    <div className={`cumple-mes-card ${c.esHoy ? 'hoy' : ''}`}>
      <span className="cumple-mes-iconos">{cumpleIconos(c)}</span>
      <div className="cumple-mes-info">
        <div className="cumple-mes-nombre">{c.nombre}{c.esHoy ? ' 🎂' : ''}</div>
        <div className="cumple-mes-fecha">{c.esHoy ? '¡Hoy!' : `${c.dia}/${c.mes}`}</div>
      </div>
    </div>
  );
}

function CumpleaniosMes({ user }) {
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const hoy = new Date();
  const [cumples,    setCumples]    = useState([]);
  const [cargando,   setCargando]   = useState(true);
  const [expandido,  setExpandido]  = useState(false);

  useEffect(() => {
    const mes = hoy.getMonth() + 1;
    apiFetch(`/api/cumpleanios?mes=${mes}&anio=${hoy.getFullYear()}`)
      .then(d => setCumples(d.map(c => ({...c, mes})))) // la API no devuelve el mes consultado
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  if (cargando || cumples.length === 0) return null;

  const hoyDia = hoy.getDate();
  // Orden por cercanía: hoy primero (distancia 0), después los que faltan este mes
  // (ascendente), y al final los que ya pasaron este mes.
  const ordenados = cumples
    .map(c => ({
      ...c,
      esHoy: c.dia === hoyDia,
      distancia: c.dia === hoyDia ? 0 : c.dia > hoyDia ? c.dia - hoyDia : 1000 + c.dia,
    }))
    .sort((a, b) => a.distancia - b.distancia);

  const visibles = expandido ? ordenados : ordenados.slice(0, 2);
  const hayMas   = ordenados.length > 2;

  return (
    <div className="card" style={{marginBottom:16,borderColor:'#ec489920',background:'linear-gradient(135deg,#fff,#fdf2f8)'}}>
      <div className="card-title" style={{marginBottom:10}}>
        🎂 Cumpleaños del mes ({MESES[hoy.getMonth()]})
        <span style={{marginLeft:'auto',fontSize:12,color:'var(--text2)'}}>
          {cumples.length} {cumples.length === 1 ? 'cumpleaños' : 'cumpleaños'}
        </span>
      </div>
      <div className="cumple-mes-grid">
        {visibles.map((c, i) => <CumpleMesCard key={i} c={c} />)}
      </div>
      {hayMas && (
        <button className="cumple-mes-toggle" onClick={() => setExpandido(v => !v)}>
          {expandido ? '▲ Ver menos' : `▼ Ver todos los de este mes (${ordenados.length})`}
        </button>
      )}
    </div>
  );
}

function UltimaReunion({ user, onSection }) {
  const [reunion, setReunion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user.permisos?.includes('ver_reuniones')) { setCargando(false); return; }
    apiFetch('/api/reuniones/ultima')
      .then(data => setReunion(data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  if (!user.permisos?.includes('ver_reuniones') || cargando || !reunion) return null;

  return (
    <div className="card" style={{marginBottom:16}}>
      <div className="card-title" style={{marginBottom:8}}>
        🗒️ Última reunión
        <button className="btn btn-secondary btn-auto" style={{marginLeft:'auto',fontSize:12,padding:'4px 10px'}}
          onClick={() => onSection('reuniones')}>Ver todas</button>
      </div>
      <div className="prox-evento" onClick={() => onSection('reuniones')}>
        <div className="prox-evento-dot" style={{background:'#6366f1'}} />
        <div>
          <div className="prox-evento-titulo">{reunion.motivo}</div>
          <div className="prox-evento-fecha">
            {formatFechaCalendario(reunion.fecha)}
            {reunion.hora ? ` · ${formatHora(reunion.hora)}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, onSection }) {
  const puede = (p) => user.permisos?.includes(p);
  const items = NAV.filter(n => n.id !== 'dashboard' && (!n.permiso || puede(n.permiso)));

  return (
    <div>
      <div className="dash-welcome">
        <h2>Bienvenido/a, {user.nombre.split(' ')[0]} 👋</h2>
        <p>{user.institucion_nombre} · {user.rol_nombre}</p>
      </div>
      <ProximosEventos user={user} onSection={onSection} />
      <CumpleaniosMes user={user} />
      <UltimaReunion user={user} onSection={onSection} />
      <div className="card">
        <div className="card-title">🗂 Módulos disponibles</div>
        <div className="modules-grid">
          {items.map(item => (
            <div key={item.id} className="module-card" onClick={() => onSection(item.id)}>
              <div className="module-icon">{item.icon}</div>
              <div className="module-label">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PLACEHOLDER ─────────────────────────────────────────────────────────────────
function Placeholder({ id }) {
  const item = NAV.find(n => n.id === id) || {};
  return (
    <div className="placeholder">
      <div className="placeholder-icon">{item.icon}</div>
      <div className="placeholder-title">{item.label}</div>
      <div className="placeholder-sub">
        Este módulo está siendo desarrollado y pronto vas a poder usarlo desde acá.
      </div>
      <span className="badge-wip">🚧 En construcción</span>
    </div>
  );
}
