// ── MODAL EVENTO ─────────────────────────────────────────────────────────────────
function ModalEvento({ evento, cursos, onClose, onGuardado }) {
  const inicial = evento ? {
    titulo:      evento.titulo || '',
    descripcion: evento.descripcion || '',
    fecha:       evento.fecha || '',
    fecha_fin:   evento.fecha_fin || evento.fecha || '',
    hora_inicio: evento.hora_inicio || '',
    hora_fin:    evento.hora_fin || '',
    lugar:       evento.lugar || '',
    tipo:        evento.tipo || 'otro',
    alcance:     evento.alcance || 'institucion',
    cursos_ids:  evento.cursos_ids || [],
  } : { titulo:'', descripcion:'', fecha:'', fecha_fin:'', hora_inicio:'', hora_fin:'', lugar:'',
        tipo:'otro', alcance:'institucion', cursos_ids:[] };

  const [form,    setForm]   = useState(inicial);
  const [saving,  setSaving] = useState(false);
  const [error,   setError]  = useState('');

  const set = (k, v) => setForm(f => {
    const next = {...f, [k]:v};
    // Si la fecha inicio queda posterior a la fecha fin, la fecha fin se ajusta
    if (k === 'fecha' && (!f.fecha_fin || v > f.fecha_fin)) next.fecha_fin = v;
    return next;
  });

  const toggleCurso = (id) => {
    setForm(f => {
      const ids = f.cursos_ids.includes(id) ? f.cursos_ids.filter(x=>x!==id) : [...f.cursos_ids, id];
      return {...f, cursos_ids: ids};
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const method = evento?.id ? 'PUT' : 'POST';
      const url    = evento?.id ? `/api/eventos/${evento.id}` : '/api/eventos';
      const data   = await apiFetch(url, { method, body: { ...form, fecha_fin: form.fecha_fin || form.fecha } });
      onGuardado(data);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{evento?.id ? 'Editar evento' : 'Nuevo evento'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-control" value={form.titulo}
              onChange={e => set('titulo', e.target.value)} required placeholder="Ej: Muestra de fin de año" />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo *</label>
            <div className="tipo-selector">
              {Object.entries(TIPO_EVENTO).map(([k,v]) => (
                <button key={k} type="button"
                  className={`tipo-btn ${form.tipo===k?'selected':''}`}
                  style={{background:v.color}}
                  onClick={() => set('tipo', k)}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Fecha inicio *</label>
              <input className="form-control" type="date" value={form.fecha}
                onChange={e => set('fecha', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha fin *</label>
              <input className="form-control" type="date" value={form.fecha_fin} min={form.fecha}
                onChange={e => set('fecha_fin', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Lugar</label>
              <input className="form-control" value={form.lugar}
                onChange={e => set('lugar', e.target.value)} placeholder="Aula, Salón, etc." />
            </div>
            <div className="form-group">
              <label className="form-label">Hora inicio</label>
              <input className="form-control" type="time" value={form.hora_inicio}
                onChange={e => set('hora_inicio', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Hora fin</label>
              <input className="form-control" type="time" value={form.hora_fin}
                onChange={e => set('hora_fin', e.target.value)} />
            </div>
          </div>
          <div className="form-group col-full">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" rows={2} value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)} placeholder="Detalles del evento..." />
          </div>
          <div className="form-group">
            <label className="form-label">Dirigido a</label>
            <div className="alcance-btns">
              <button type="button" className={`alcance-btn ${form.alcance==='institucion'?'selected':''}`}
                onClick={() => set('alcance','institucion')}>
                🏫 Toda la institución
              </button>
              <button type="button" className={`alcance-btn ${form.alcance==='cursos'?'selected':''}`}
                onClick={() => set('alcance','cursos')}>
                👥 Cursos específicos
              </button>
            </div>
          </div>
          {form.alcance === 'cursos' && (
            <div className="form-group">
              <label className="form-label">Seleccioná los cursos</label>
              <div className="curso-checks">
                {cursos.map(c => (
                  <button key={c.id} type="button"
                    className={`curso-check-btn ${form.cursos_ids.includes(c.id)?'selected':''}`}
                    onClick={() => toggleCurso(c.id)}>
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-auto" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
              {saving ? 'Guardando...' : evento?.id ? 'Guardar cambios' : 'Crear evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MODAL CANCELAR / REPROGRAMAR ─────────────────────────────────────────────────
function ModalCambioEvento({ evento, modo, onClose, onGuardado }) {
  const [motivo,     setMotivo]   = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHI,    setNuevaHI]  = useState(evento.hora_inicio || '');
  const [nuevaHF,    setNuevaHF]  = useState(evento.hora_fin || '');
  const [saving,     setSaving]   = useState(false);
  const [error,      setError]    = useState('');
  const esCancelar = modo === 'cancelar';

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const url  = `/api/eventos/${evento.id}/${esCancelar ? 'cancelar' : 'reprogramar'}`;
      const body = esCancelar
        ? { motivo }
        : { motivo, nueva_fecha: nuevaFecha, nueva_hora_inicio: nuevaHI || null, nueva_hora_fin: nuevaHF || null };
      await apiFetch(url, { method:'POST', body });
      onGuardado();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{esCancelar ? '❌ Cancelar evento' : '📅 Reprogramar evento'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{background:'var(--bg3)',borderRadius:8,padding:12,marginBottom:14,fontSize:13}}>
          <strong>{evento.titulo}</strong> — {formatFechaCalendario(evento.fecha)}
          {evento.hora_inicio ? ` a las ${formatHora(evento.hora_inicio)}` : ''}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          {!esCancelar && (
            <div className="form-grid" style={{marginBottom:14}}>
              <div className="form-group">
                <label className="form-label">Nueva fecha *</label>
                <input className="form-control" type="date" value={nuevaFecha}
                  onChange={e => setNuevaFecha(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva hora inicio</label>
                <input className="form-control" type="time" value={nuevaHI}
                  onChange={e => setNuevaHI(e.target.value)} />
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Motivo {esCancelar ? 'de cancelación' : 'de reprogramación'} *</label>
            <textarea className="form-control" rows={3} value={motivo}
              onChange={e => setMotivo(e.target.value)} required
              placeholder={esCancelar ? 'Ej: Problemas climáticos, enfermedad del docente...' : 'Ej: Conflicto con otro evento, solicitud de familias...'} />
          </div>
          <div className="alert alert-warning" style={{fontSize:12,marginBottom:0}}>
            Se enviará una notificación in-app y por email a todos los afectados.
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-auto" onClick={onClose}>Volver</button>
            <button type="submit"
              className={`btn btn-auto ${esCancelar ? 'btn-danger' : 'btn-primary'}`}
              disabled={saving}>
              {saving ? 'Enviando...' : esCancelar ? 'Cancelar evento' : 'Reprogramar y notificar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DETALLE EVENTO ───────────────────────────────────────────────────────────────
function ModalDetalleEvento({ evento, cursos, user, onClose, onEditar, onCambio }) {
  const puede = (p) => user.permisos?.includes(p);
  const cursoNombres = (evento.cursos_ids || []).map(id => cursos.find(c=>c.id===id)?.nombre).filter(Boolean);
  const estadoBadge = {
    activo:       <span className="agenda-item-badge badge-activo">Activo</span>,
    cancelado:    <span className="agenda-item-badge badge-cancelado">Cancelado</span>,
    reprogramado: <span className="agenda-item-badge badge-reprogramado">Reprogramado</span>,
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{evento.titulo}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
          <span style={{background:tipoColor(evento.tipo)+'22',color:tipoColor(evento.tipo),
            borderRadius:12,padding:'3px 10px',fontSize:12,fontWeight:700}}>
            {tipoLabel(evento.tipo)}
          </span>
          {estadoBadge[evento.estado]}
        </div>
        <div style={{fontSize:14,display:'flex',flexDirection:'column',gap:8}}>
          <div><strong>📅 Fecha:</strong> {formatFechaCalendario(evento.fecha)}
            {evento.fecha_fin && evento.fecha_fin !== evento.fecha ? ` al ${formatFechaCalendario(evento.fecha_fin)}` : ''}
            {evento.hora_inicio ? ` · ${formatHora(evento.hora_inicio)}` : ''}
            {evento.hora_fin    ? ` – ${formatHora(evento.hora_fin)}`    : ''}
          </div>
          {evento.lugar && <div><strong>📍 Lugar:</strong> {evento.lugar}</div>}
          {evento.descripcion && <div><strong>📝 Descripción:</strong> {evento.descripcion}</div>}
          <div><strong>👥 Dirigido a:</strong> {evento.alcance==='institucion' ? 'Toda la institución' : cursoNombres.join(', ') || 'Cursos específicos'}</div>
          {evento.estado !== 'activo' && evento.motivo_cambio && (
            <div style={{background:'var(--bg3)',borderRadius:8,padding:10,fontSize:13}}>
              <strong>Motivo del cambio:</strong> {evento.motivo_cambio}
              {evento.fecha_original && <div style={{marginTop:4,color:'var(--text2)'}}>Fecha original: {formatFechaCalendario(evento.fecha_original)}</div>}
            </div>
          )}
        </div>
        {puede('editar_eventos') && evento.estado === 'activo' && (
          <div className="modal-footer" style={{flexWrap:'wrap'}}>
            <button className="btn btn-secondary btn-auto" onClick={() => onEditar(evento)}>✏️ Editar</button>
            <button className="btn btn-secondary btn-auto" style={{color:'var(--warning)',borderColor:'var(--warning)'}}
              onClick={() => onCambio(evento, 'reprogramar')}>📅 Reprogramar</button>
            <button className="btn btn-danger btn-auto" onClick={() => onCambio(evento, 'cancelar')}>❌ Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CALENDARIO ───────────────────────────────────────────────────────────────────
function Calendario({ user }) {
  const puede = (p) => user.permisos?.includes(p);

  const hoy = new Date();
  const [año,     setAnio]     = useState(hoy.getFullYear());
  const [mes,     setMes]      = useState(hoy.getMonth()); // 0-based
  const [vista,   setVista]    = useState('calendario'); // 'calendario' | 'agenda'
  const [eventos, setEventos]  = useState([]);
  const [cursos,  setCursos]   = useState([]);
  const [cargando, setCargando] = useState(false);

  const [modalCrear,   setModalCrear]   = useState(false);
  const [modalEditar,  setModalEditar]  = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [modalCambio,  setModalCambio]  = useState(null);
  const [cumplesMes,   setCumplesMes]   = useState([]); // cumpleaños del mes visible
  const [modalCumple,  setModalCumple]  = useState(null); // {dia, lista}

  // Carga cursos una sola vez
  useEffect(() => {
    apiFetch('/api/cursos').then(d => setCursos(d)).catch(() => {});
  }, []);

  // Carga eventos + cumpleaños al cambiar mes/año
  const cargarEventos = useCallback(async () => {
    setCargando(true);
    try {
      const desde = new Date(año, mes - 1, 1).toISOString().slice(0, 10);
      const hasta  = new Date(año, mes + 2, 0).toISOString().slice(0, 10);
      const [evData, cumpleData] = await Promise.all([
        apiFetch(`/api/eventos?desde=${desde}&hasta=${hasta}`),
        apiFetch(`/api/cumpleanios?mes=${mes + 1}&anio=${año}`),
      ]);
      setEventos(evData);
      setCumplesMes(cumpleData);
    } catch(e) {}
    finally { setCargando(false); }
  }, [año, mes]);

  useEffect(() => { cargarEventos(); }, [cargarEventos]);

  const navMes = (dir) => {
    if (mes + dir < 0)  { setAnio(a => a-1); setMes(11); }
    else if (mes + dir > 11) { setAnio(a => a+1); setMes(0); }
    else setMes(m => m + dir);
  };

  const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const DIAS_ES  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  // Construye la grilla del mes
  const buildGrid = () => {
    const primer = new Date(año, mes, 1);
    const ultimo = new Date(año, mes + 1, 0);
    let dow = primer.getDay(); // 0=Dom
    dow = dow === 0 ? 6 : dow - 1; // convertir a 0=Lun

    const dias = [];
    // días del mes anterior para completar la primera fila
    for (let i = dow - 1; i >= 0; i--) {
      const d = new Date(año, mes, -i);
      dias.push({ fecha: d.toISOString().slice(0,10), actual: false });
    }
    // días del mes actual
    for (let i = 1; i <= ultimo.getDate(); i++) {
      const d = new Date(año, mes, i);
      dias.push({ fecha: d.toISOString().slice(0,10), actual: true });
    }
    // días del mes siguiente para completar la última fila
    let resto = dias.length % 7;
    if (resto !== 0) {
      for (let i = 1; i <= 7 - resto; i++) {
        const d = new Date(año, mes + 1, i);
        dias.push({ fecha: d.toISOString().slice(0,10), actual: false });
      }
    }
    return dias;
  };

  const todayStr = hoy.toISOString().slice(0,10);
  const grid = buildGrid();

  // Devuelve todas las fechas YYYY-MM-DD entre desde y hasta (inclusive)
  const fechasEnRango = (desde, hasta) => {
    const out = []; let d = new Date(desde + 'T12:00:00'); const fin = new Date((hasta||desde) + 'T12:00:00');
    let guard = 0;
    while (d <= fin && guard < 60) { out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); guard++; }
    return out;
  };

  // Mapa fecha → eventos (expandido: un evento multi-día aparece en cada día de su rango,
  // marcado con su posición para dibujar la "barrita" conectada visualmente)
  const eventosPorFecha = {};
  eventos.forEach(ev => {
    const dias = fechasEnRango(ev.fecha, ev.fecha_fin || ev.fecha);
    dias.forEach((f, i) => {
      const multiPos = dias.length <= 1 ? null
        : i === 0 ? 'multi-start' : i === dias.length - 1 ? 'multi-end' : 'multi-mid';
      if (!eventosPorFecha[f]) eventosPorFecha[f] = [];
      eventosPorFecha[f].push({ ...ev, __multiPos: multiPos });
    });
  });

  // Mapa dia → cumpleaños del mes visible
  const cumplesPorDia = {};
  cumplesMes.forEach(c => {
    if (!cumplesPorDia[c.dia]) cumplesPorDia[c.dia] = [];
    cumplesPorDia[c.dia].push(c);
  });

  // Vista agenda: eventos que tocan el mes actual (incluye multi-día que empiezan antes)
  const inicioMesStr = new Date(año, mes, 1).toISOString().slice(0,10);
  const finMesStr    = new Date(año, mes + 1, 0).toISOString().slice(0,10);
  const eventosDelMes = eventos
    .filter(ev => ev.fecha <= finMesStr && (ev.fecha_fin || ev.fecha) >= inicioMesStr)
    .sort((a,b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio||'').localeCompare(b.hora_inicio||''));

  const cerrarTodo = () => {
    setModalCrear(false); setModalEditar(null); setModalDetalle(null); setModalCambio(null);
  };

  const onGuardado = (ev) => {
    cargarEventos();
    cerrarTodo();
  };

  const onCambioGuardado = () => {
    cargarEventos();
    cerrarTodo();
  };

  return (
    <div className="cal-wrap">
      {/* Toolbar */}
      <div className="cal-toolbar">
        <button className="btn btn-secondary btn-auto" style={{padding:'8px 12px'}} onClick={() => navMes(-1)}>‹</button>
        <span className="cal-toolbar-month">{MESES_ES[mes]} {año}</span>
        <button className="btn btn-secondary btn-auto" style={{padding:'8px 12px'}} onClick={() => navMes(1)}>›</button>
        <button className="btn btn-secondary btn-auto" style={{padding:'7px 12px',fontSize:12}}
          onClick={() => { setAnio(hoy.getFullYear()); setMes(hoy.getMonth()); }}>
          Hoy
        </button>
        <div className="cal-view-toggle">
          <button className={`cal-view-btn ${vista==='calendario'?'active':''}`} onClick={() => setVista('calendario')}>📅 Mes</button>
          <button className={`cal-view-btn ${vista==='agenda'?'active':''}`}     onClick={() => setVista('agenda')}>📋 Agenda</button>
        </div>
        {puede('crear_eventos') && (
          <button className="btn btn-primary btn-auto" style={{marginLeft:'auto',whiteSpace:'nowrap'}}
            onClick={() => setModalCrear(true)}>
            + Nuevo evento
          </button>
        )}
      </div>

      {/* Vista calendario — grid flat: 7 headers + N celdas como hijos directos */}
      {vista === 'calendario' && (
        <div className="evtcal-grid">
          {DIAS_ES.map((d, i) => (
            <div key={d} className={`evtcal-header${i >= 5 ? ' wknd' : ''}`}>{d}</div>
          ))}
          {grid.map(({ fecha, actual }) => {
            const evsDia    = eventosPorFecha[fecha] || [];
            const dia       = parseInt(fecha.slice(8), 10);
            const cumpleDia = (actual && fecha.slice(0,7) === `${año}-${String(mes+1).padStart(2,'0')}`)
                              ? cumplesPorDia[dia] || [] : [];
            const cumpleEstDia   = cumpleDia.filter(c => c.tipo === 'estudiante');
            const cumpleStaffDia = cumpleDia.filter(c => c.tipo === 'usuario');
            const isToday   = fecha === todayStr;
            const dow       = new Date(fecha + 'T12:00:00').getDay();
            const isWeekend = dow === 0 || dow === 6;
            const cls = [
              'evtcal-cell',
              !actual    ? 'other-month' : '',
              isToday    ? 'today'       : '',
              isWeekend  ? 'weekend'     : '',
            ].filter(Boolean).join(' ');
            return (
              <div key={fecha} className={cls}>
                <div className="evtcal-num">{dia}</div>

                {/* Puntitos (mobile) */}
                <div className="evtcal-dots">
                  {evsDia.slice(0, 5).map(ev => (
                    <span key={ev.id}
                      className={`evtcal-dot${ev.estado !== 'activo' ? ' inactive' : ''}${ev.__multiPos ? ' '+ev.__multiPos : ''}`}
                      style={{background: tipoColor(ev.tipo)}}
                      title={ev.fecha_fin && ev.fecha_fin !== ev.fecha ? `${ev.titulo} (${formatFechaCalendario(ev.fecha)} al ${formatFechaCalendario(ev.fecha_fin)})` : ev.titulo}
                      onClick={() => setModalDetalle(ev)}
                    />
                  ))}
                  {cumpleEstDia.length > 0 && (
                    <span className="evtcal-cumple" title={`🎂 Estudiantes: ${cumpleEstDia.map(c=>c.nombre).join(', ')}`}
                      onClick={() => setModalCumple({ dia, lista: cumpleDia })} />
                  )}
                  {cumpleStaffDia.length > 0 && (
                    <span className="evtcal-cumple staff" title={`🎂 Equipo: ${cumpleStaffDia.map(c=>c.nombre).join(', ')}`}
                      onClick={() => setModalCumple({ dia, lista: cumpleDia })} />
                  )}
                </div>

                {/* Chips (desktop) */}
                <div className="evtcal-chips">
                  {evsDia.slice(0, 2).map(ev => (
                    <span key={ev.id}
                      className={`evtcal-chip${ev.estado !== 'activo' ? ' inactive' : ''}${ev.__multiPos ? ' '+ev.__multiPos : ''}`}
                      style={{background: tipoColor(ev.tipo)}}
                      title={ev.fecha_fin && ev.fecha_fin !== ev.fecha ? `${ev.titulo} (${formatFechaCalendario(ev.fecha)} al ${formatFechaCalendario(ev.fecha_fin)})` : ev.titulo}
                      onClick={() => setModalDetalle(ev)}>
                      {ev.__multiPos === 'multi-mid' || ev.__multiPos === 'multi-end' ? '' : ev.titulo}
                    </span>
                  ))}
                  {cumpleEstDia.length > 0 && (
                    <span className="evtcal-chip" style={{background:'#ec4899',cursor:'pointer'}}
                      onClick={() => setModalCumple({ dia, lista: cumpleDia })}>
                      🎂 {cumpleEstDia.length === 1 ? cumpleEstDia[0].nombre.split(' ')[0] : `${cumpleEstDia.length} estudiantes`}
                    </span>
                  )}
                  {cumpleStaffDia.length > 0 && (
                    <span className="evtcal-chip" style={{background:'#f59e0b',cursor:'pointer'}}
                      onClick={() => setModalCumple({ dia, lista: cumpleDia })}>
                      🎂 {cumpleStaffDia.length === 1 ? cumpleStaffDia[0].nombre.split(' ')[0] : `${cumpleStaffDia.length} equipo`}
                    </span>
                  )}
                  {evsDia.length > 2 && (
                    <span className="evtcal-more" onClick={() => setVista('agenda')}>
                      +{evsDia.length - 2} más
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista agenda */}
      {vista === 'agenda' && (
        <div>
          {eventosDelMes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div>No hay eventos en {MESES_ES[mes]}</div>
            </div>
          ) : (() => {
            // Agrupa por fecha
            const grupos = {};
            eventosDelMes.forEach(ev => {
              if (!grupos[ev.fecha]) grupos[ev.fecha] = [];
              grupos[ev.fecha].push(ev);
            });
            return Object.entries(grupos).map(([fecha, evs]) => (
              <div key={fecha}>
                <div className="agenda-group-date">
                  {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}
                </div>
                {evs.map(ev => (
                  <div key={ev.id} className="agenda-item" onClick={() => setModalDetalle(ev)}>
                    <div className="agenda-item-stripe" style={{background:tipoColor(ev.tipo)}} />
                    <div className="agenda-item-body">
                      <div className="agenda-item-titulo">{ev.titulo}</div>
                      <div className="agenda-item-meta">
                        <span style={{background:tipoColor(ev.tipo)+'22',color:tipoColor(ev.tipo),
                          borderRadius:8,padding:'1px 7px',fontSize:11,fontWeight:700}}>
                          {tipoLabel(ev.tipo)}
                        </span>
                        {ev.fecha_fin && ev.fecha_fin !== ev.fecha && <span>↔ al {formatFechaCalendario(ev.fecha_fin)}</span>}
                        {ev.hora_inicio && <span>⏰ {formatHora(ev.hora_inicio)}{ev.hora_fin ? ` – ${formatHora(ev.hora_fin)}` : ''}</span>}
                        {ev.lugar && <span>📍 {ev.lugar}</span>}
                        {ev.alcance === 'institucion'
                          ? <span>🏫 Toda la institución</span>
                          : <span>👥 Cursos específicos</span>
                        }
                        <span className={`agenda-item-badge badge-${ev.estado}`}>
                          {ev.estado.charAt(0).toUpperCase() + ev.estado.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Modales */}
      {modalCrear && (
        <ModalEvento cursos={cursos} onClose={cerrarTodo} onGuardado={onGuardado} />
      )}
      {modalEditar && (
        <ModalEvento evento={modalEditar} cursos={cursos} onClose={cerrarTodo} onGuardado={onGuardado} />
      )}
      {modalDetalle && !modalCambio && (
        <ModalDetalleEvento evento={modalDetalle} cursos={cursos} user={user}
          onClose={cerrarTodo}
          onEditar={(ev) => { setModalDetalle(null); setModalEditar(ev); }}
          onCambio={(ev, modo) => setModalCambio({ evento: ev, modo })}
        />
      )}
      {modalCambio && (
        <ModalCambioEvento evento={modalCambio.evento} modo={modalCambio.modo}
          onClose={cerrarTodo} onGuardado={onCambioGuardado} />
      )}
      {modalCumple && (
        <div className="modal-overlay" onClick={() => setModalCumple(null)}>
          <div className="modal" style={{maxWidth:340}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🎂 Cumpleaños del día {modalCumple.dia}</span>
              <button className="modal-close" onClick={() => setModalCumple(null)}>×</button>
            </div>
            {modalCumple.lista.map((c,i) => (
              <div key={i} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:22}}>🎂</span>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{c.nombre}</div>
                  <div style={{fontSize:12,color:'var(--text2)'}}>
                    {c.tipo === 'usuario' ? `👩‍🏫 ${c.rol_nombre}` : '👦 Estudiante'}
                    {c.fecha_nacimiento && ` · ${new Date().getFullYear() - parseInt(c.fecha_nacimiento.slice(0,4))} años`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
