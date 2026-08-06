// ── GRÁFICO DE TORTA (SVG nativo, sin dependencias externas) ────────────────────
// Colores: verde=Presente, rojo=Ausente, amarillo=Tarde
// FUTURO: cuando se implemente asistencia por materia (UNSAM), reutilizar este
// componente pasando los totales por materia: <PieChart presencias={} ausencias={} tardes={} />
function PieChart({ presencias, ausencias, tardes, size = 80 }) {
  const data = [
    { v: presencias, color: '#22c55e' },
    { v: ausencias,  color: '#ef4444' },
    { v: tardes,     color: '#f59e0b' },
  ];
  const total = data.reduce((s, d) => s + d.v, 0);
  const cx = size / 2, cy = size / 2, r = size / 2 - 2;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',flexShrink:0}}>
        <circle cx={cx} cy={cy} r={r} fill="var(--bg3)" stroke="var(--border)" strokeWidth={1.5} />
        <text x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize={Math.round(size*0.2)} fill="var(--text2)">—</text>
      </svg>
    );
  }

  const activos = data.filter(d => d.v > 0);
  // Caso especial: un solo segmento → círculo completo
  if (activos.length === 1) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',flexShrink:0}}>
        <circle cx={cx} cy={cy} r={r} fill={activos[0].color} />
      </svg>
    );
  }

  let angle = -Math.PI / 2;
  const paths = activos.map(d => {
    const sweep = (d.v / total) * 2 * Math.PI;
    const ea = angle + sweep;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(ea),    y2 = cy + r * Math.sin(ea);
    const la = sweep > Math.PI ? 1 : 0;
    const path = `M${cx},${cy}L${x1.toFixed(3)},${y1.toFixed(3)}A${r},${r},0,${la},1,${x2.toFixed(3)},${y2.toFixed(3)}Z`;
    angle = ea;
    return { path, color: d.color };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',flexShrink:0}}>
      {paths.map((p, i) => (
        <path key={i} d={p.path} fill={p.color} stroke="#fff" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

// ── REPORTES DE ASISTENCIA ───────────────────────────────────────────────────────
function Reportes({ user, onNavigate, filtroNivel }) {
  const [tabReporte, setTabReporte] = useState('asistencia'); // 'asistencia' | 'nivel'

  // Llegada desde un badge de inscripción en Estudiantes ("Tiburones · Canto") — salta
  // directo al tab "Por nivel / curso" con ese curso+instrumento ya filtrados.
  useEffect(() => {
    if (filtroNivel) setTabReporte('nivel');
  }, [filtroNivel]);
  const [ciclos,     setCiclos]     = useState([]);
  const [cursos,     setCursos]     = useState([]);
  const [modo,       setModo]       = useState('semestre');
  const [semActivo,  setSemActivo]  = useState(null);
  const [fechaIni,   setFechaIni]   = useState('');
  const [fechaFin,   setFechaFin]   = useState('');
  const [cursoId,    setCursoId]    = useState('');
  const [reporte,    setReporte]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [sortCol,    setSortCol]    = useState('apellido');
  const [sortDir,    setSortDir]    = useState('asc');
  const [editSem,    setEditSem]    = useState(null);
  const [editForm,   setEditForm]   = useState({ fecha_inicio:'', fecha_fin:'' });
  const [editSaving, setEditSaving] = useState(false);
  const [error,      setError]      = useState('');
  const [toast,      setToast]      = useState({ type:'', text:'' });

  const puede = (p) => user.permisos?.includes(p);
  const showToast = (type, text) => { setToast({type,text}); setTimeout(()=>setToast({type:'',text:''}),4000); };

  useEffect(() => {
    Promise.all([apiFetch('/api/cursos'), apiFetch('/api/periodos/ciclos')])
      .then(([cs, cl]) => {
        setCursos(cs); setCiclos(cl);
        const sem1 = cl[0]?.semestres?.find(s => s.numero === 1);
        if (sem1) { setSemActivo(sem1); setFechaIni(sem1.fecha_inicio); setFechaFin(sem1.fecha_fin); }
      }).catch(() => {});
  }, []);

  const selSemestre = (sem) => {
    setSemActivo(sem); setFechaIni(sem.fecha_inicio); setFechaFin(sem.fecha_fin);
    setModo('semestre'); setReporte(null);
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const cargarReporte = async () => {
    if (!fechaIni || !fechaFin) { setError('Seleccioná un semestre o ingresá un rango de fechas.'); return; }
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ fecha_inicio: fechaIni, fecha_fin: fechaFin });
      if (cursoId) p.set('curso_id', cursoId);
      setReporte(await apiFetch(`/api/reportes/asistencia?${p}`));
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const guardarSemestre = async () => {
    setEditSaving(true);
    try {
      await apiFetch(`/api/periodos/semestres/${editSem.id}`, { method:'PUT', body: editForm });
      const cl = await apiFetch('/api/periodos/ciclos');
      setCiclos(cl);
      if (semActivo?.id === editSem.id) {
        setFechaIni(editForm.fecha_inicio); setFechaFin(editForm.fecha_fin);
        setSemActivo(s => ({...s, ...editForm}));
      }
      setEditSem(null); showToast('success', 'Fechas del semestre actualizadas.'); setReporte(null);
    } catch(e) { showToast('error', e.message); }
    finally { setEditSaving(false); }
  };

  const est = reporte?.estudiantes || [];
  const sorted = [...est].sort((a, b) => {
    let av = sortCol==='apellido' ? `${a.apellido} ${a.nombre}` : a[sortCol];
    let bv = sortCol==='apellido' ? `${b.apellido} ${b.nombre}` : b[sortCol];
    if (sortCol==='porcentaje') { av = av??-1; bv = bv??-1; }
    if (typeof av==='string') return sortDir==='asc' ? av.localeCompare(bv,'es') : bv.localeCompare(av,'es');
    return sortDir==='asc' ? (av??0)-(bv??0) : (bv??0)-(av??0);
  });

  const conDatos = est.filter(e=>e.total_registros>0);
  const promedio = conDatos.length
    ? Math.round(conDatos.reduce((s,e)=>s+(e.porcentaje??0),0)/conDatos.length)
    : null;
  const alerta3   = est.filter(e=>e.ausencias>=3).length;
  const totalPres = est.reduce((s,e) => s+e.presencias, 0);
  const totalAus  = est.reduce((s,e) => s+e.ausencias,  0);
  const totalTard = est.reduce((s,e) => s+e.tardes,     0);
  const totalReg  = totalPres + totalAus + totalTard;
  const allSems   = ciclos.flatMap(c=>c.semestres||[]);

  const periodoLabel = modo==='semestre'&&semActivo
    ? `${ciclos.find(c=>c.semestres?.some(s=>s.id===semActivo.id))?.nombre||''} · ${semActivo.nombre}`
    : (fechaIni&&fechaFin ? `${fechaIni} al ${fechaFin}` : '');
  const cursoLabel = cursoId ? (cursos.find(c=>String(c.id)===cursoId)?.nombre||'') : 'Todos los cursos';

  const exportarCSV = () => {
    if (!sorted.length) return;
    const heads = ['Apellido','Nombre','Curso','Presencias','Ausencias','Tardes','Días','% Asistencia'];
    const rows  = sorted.map(e=>[
      e.apellido, e.nombre, e.curso_nombre||'',
      e.presencias, e.ausencias, e.tardes, e.total_registros,
      e.porcentaje!==null ? e.porcentaje+'%' : 'Sin datos',
    ]);
    const csv  = [heads,...rows].map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EPM_asistencia_${fechaIni}_${fechaFin}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const SortTh = ({col, label}) => (
    <th className="rpt-th" onClick={()=>toggleSort(col)}>
      {label}{sortCol===col && <span style={{marginLeft:4,fontSize:10}}>{sortDir==='asc'?'▲':'▼'}</span>}
    </th>
  );
  const PctBadge = ({pct}) => {
    if (pct===null) return <span style={{color:'var(--text2)',fontSize:12}}>—</span>;
    return <span className={`pct-badge ${pct>=90?'pct-alta':pct>=75?'pct-media':'pct-baja'}`}>{pct}%</span>;
  };

  return (
    <div>
      {toast.text && <div className={`alert alert-${toast.type} no-print`} style={{cursor:'pointer'}} onClick={()=>setToast({type:'',text:''})}>{toast.text}</div>}

      {/* ── Selector de tipo de reporte ── */}
      <div className="cal-view-toggle no-print" style={{marginBottom:14}}>
        <button className={`cal-view-btn ${tabReporte==='asistencia'?'active':''}`} onClick={()=>setTabReporte('asistencia')}>📊 Asistencia</button>
        <button className={`cal-view-btn ${tabReporte==='nivel'?'active':''}`} onClick={()=>setTabReporte('nivel')}>🏫 Por nivel / curso</button>
      </div>

      {tabReporte === 'nivel' && <ReportePorNivel cursos={cursos} onNavigate={onNavigate} filtroInicial={filtroNivel} />}

      {tabReporte === 'asistencia' && <>
      {/* ── Panel de control ── */}
      <div className="card no-print" style={{marginBottom:14}}>
        <div className="card-title" style={{marginBottom:12}}>📊 Reporte de Asistencia</div>

        <div style={{marginBottom:14}}>
          <div className="form-label">Período</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
            {allSems.map(s => (
              <button key={s.id}
                className={`curso-tab ${semActivo?.id===s.id&&modo==='semestre'?'active':''}`}
                style={{display:'flex',alignItems:'center',gap:6}}
                onClick={() => selSemestre(s)}>
                <span>{s.nombre}</span>
                <span style={{fontSize:10,opacity:.65}}>{s.fecha_inicio} → {s.fecha_fin}</span>
                {puede('editar_reportes') && (
                  <span style={{fontSize:12}} title="Editar fechas"
                    onClick={e=>{e.stopPropagation();setEditSem(s);setEditForm({fecha_inicio:s.fecha_inicio,fecha_fin:s.fecha_fin});}}>
                    ✏️
                  </span>
                )}
              </button>
            ))}
            <button className={`curso-tab ${modo==='rango'?'active':''}`}
              onClick={()=>{setModo('rango');setSemActivo(null);setReporte(null);}}>
              Rango personalizado
            </button>
          </div>
          {modo==='rango' && (
            <div className="form-grid">
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Desde</label>
                <input className="form-control" type="date" value={fechaIni}
                  onChange={e=>{setFechaIni(e.target.value);setReporte(null);}} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Hasta</label>
                <input className="form-control" type="date" value={fechaFin}
                  onChange={e=>{setFechaFin(e.target.value);setReporte(null);}} />
              </div>
            </div>
          )}
        </div>

        <div className="form-group" style={{marginBottom:12}}>
          <label className="form-label">Curso</label>
          <select className="form-control" value={cursoId}
            onChange={e=>{setCursoId(e.target.value);setReporte(null);}}>
            <option value="">Todos los cursos</option>
            {cursos.map(c=><option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary" onClick={cargarReporte} disabled={loading}>
          {loading ? 'Generando…' : '📊 Generar reporte'}
        </button>
      </div>

      {loading && <div className="spinner"><div className="spin" /></div>}

      {reporte && !loading && (
        <>
          {/* Header visible solo al imprimir */}
          <div className="print-header">
            <h2 style={{fontSize:18,fontWeight:800,marginBottom:4}}>EPM – Reporte de Asistencia</h2>
            <p style={{fontSize:12,color:'#666'}}>{periodoLabel} · {cursoLabel} · {new Date().toLocaleDateString('es-AR')}</p>
            {reporte.dias_registrados>0 && <p style={{fontSize:12,color:'#666'}}>Días de clase registrados: {reporte.dias_registrados}</p>}
          </div>

          {/* Stats */}
          <div className="report-stats no-print">
            <div className="rstat">
              <div className="rstat-value">{est.length}</div>
              <div className="rstat-label">Estudiantes</div>
            </div>
            <div className="rstat">
              <div className="rstat-value">{reporte.dias_registrados}</div>
              <div className="rstat-label">Días registrados</div>
            </div>
            <div className={`rstat ${promedio!==null&&promedio<75?'rstat-danger':promedio!==null&&promedio<90?'rstat-alert':''}`}>
              <div className="rstat-value">{promedio!==null?promedio+'%':'—'}</div>
              <div className="rstat-label">Promedio asistencia</div>
            </div>
            <div className={`rstat ${alerta3>0?'rstat-alert':''}`}>
              <div className="rstat-value">{alerta3}</div>
              <div className="rstat-label">Con 3+ ausencias ⚠️</div>
            </div>
          </div>

          {/* Torta general del curso */}
          {totalReg > 0 && (
            <div className="card no-print pie-wrap" style={{marginBottom:14,padding:'16px 20px'}}>
              <PieChart presencias={totalPres} ausencias={totalAus} tardes={totalTard} size={110} />
              <div>
                <div className="form-label" style={{marginBottom:10}}>
                  Distribución total del período · {sorted.length} estudiantes
                </div>
                <div className="pie-legend">
                  <span style={{color:'#22c55e',fontSize:18,lineHeight:1}}>●</span>
                  Presencias: <strong>{totalPres}</strong>
                  <span style={{color:'var(--text2)',fontSize:12}}>({Math.round(totalPres/totalReg*100)}%)</span>
                </div>
                <div className="pie-legend">
                  <span style={{color:'#ef4444',fontSize:18,lineHeight:1}}>●</span>
                  Ausencias: <strong>{totalAus}</strong>
                  <span style={{color:'var(--text2)',fontSize:12}}>({Math.round(totalAus/totalReg*100)}%)</span>
                </div>
                <div className="pie-legend">
                  <span style={{color:'#f59e0b',fontSize:18,lineHeight:1}}>●</span>
                  Tardes: <strong>{totalTard}</strong>
                  <span style={{color:'var(--text2)',fontSize:12}}>({Math.round(totalTard/totalReg*100)}%)</span>
                </div>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="no-print" style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
            <button className="btn btn-secondary btn-auto" onClick={exportarCSV}>📤 Exportar CSV</button>
            <button className="btn btn-secondary btn-auto" onClick={()=>window.print()}>🖨️ Imprimir</button>
            <span style={{fontSize:12,color:'var(--text2)'}}>
              {sorted.length} est. · {periodoLabel} · {cursoLabel}
            </span>
          </div>

          {/* Tabla */}
          {sorted.length===0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <p>No hay estudiantes para mostrar con esos filtros.</p>
            </div>
          ) : (
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <SortTh col="apellido"        label="Estudiante" />
                      {!cursoId && <SortTh col="curso_nombre" label="Curso" />}
                      <SortTh col="presencias"      label="✅ Pres." />
                      <SortTh col="ausencias"       label="❌ Aus." />
                      <SortTh col="tardes"          label="⏰ Tarde" />
                      <SortTh col="total_registros" label="Días" />
                      <SortTh col="porcentaje"      label="% Asist." />
                      <th className="rpt-th" style={{textAlign:'center'}}>Dist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(e => (
                      <tr key={e.id} className={e.ausencias>=3?'rpt-row-alerta':''}>
                        <td className="rpt-nombre">
                          {e.apellido}, {e.nombre}
                          {e.total_registros===0 && <span className="rpt-sin-datos">sin datos</span>}
                        </td>
                        {!cursoId && <td className="rpt-td">{e.curso_nombre||'—'}</td>}
                        <td className="rpt-td rpt-num">{e.presencias}</td>
                        <td className={`rpt-td rpt-num ${e.ausencias>=3?'rpt-aus-alta':e.ausencias>0?'rpt-aus-media':''}`}>
                          {e.ausencias}
                        </td>
                        <td className="rpt-td rpt-num">{e.tardes}</td>
                        <td className="rpt-td rpt-num">{e.total_registros}</td>
                        <td className="rpt-td"><PctBadge pct={e.porcentaje} /></td>
                        <td className="rpt-td" style={{padding:'4px 8px',textAlign:'center'}}>
                          <PieChart presencias={e.presencias} ausencias={e.ausencias} tardes={e.tardes} size={44} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      </>}

      {/* Modal editar semestre */}
      {editSem && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditSem(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">✏️ Editar fechas: {editSem.nombre}</span>
              <button className="modal-close" onClick={()=>setEditSem(null)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Fecha de inicio</label>
                <input className="form-control" type="date" value={editForm.fecha_inicio}
                  onChange={e=>setEditForm(f=>({...f,fecha_inicio:e.target.value}))} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Fecha de fin</label>
                <input className="form-control" type="date" value={editForm.fecha_fin}
                  onChange={e=>setEditForm(f=>({...f,fecha_fin:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={()=>setEditSem(null)}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={guardarSemestre} disabled={editSaving}>
                {editSaving?'Guardando…':'Guardar fechas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── REPORTE POR NIVEL / CURSO ─────────────────────────────────────────────────────
const CAMPOS_COMPLETITUD = [
  { key:'dni',            label:'DNI',        ok: e => !!e.dni },
  { key:'fecha_nac',      label:'F. nac.',    ok: e => !!e.fecha_nacimiento },
  { key:'telefono',       label:'Teléfono',   ok: e => !!e.telefono },
  { key:'tutor',          label:'Tutor',      ok: e => !!e.tutor_nombre && !!e.tutor_dni },
  { key:'tutor_telefono', label:'Tel. tutor', ok: e => !!e.tutor_telefono },
  { key:'direccion',      label:'Dirección',  ok: e => !!e.direccion },
  { key:'foto',           label:'Foto',       ok: e => !!e.foto_path },
];

function ReportePorNivel({ cursos, onNavigate, filtroInicial }) {
  const [cursoId,      setCursoId]      = useState(filtroInicial?.curso_id ? String(filtroInicial.curso_id) : '');
  const [instrumentoId,setInstrumentoId]= useState(filtroInicial?.instrumento_id ? String(filtroInicial.instrumento_id) : '');
  const [instrumentos, setInstrumentos] = useState([]);
  const [datos,   setDatos]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [sortCol, setSortCol] = useState('apellido');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => { apiFetch('/api/instrumentos').then(setInstrumentos).catch(()=>{}); }, []);

  // Un click en un badge de inscripción ("Tiburones · Canto") puede llegar más de una vez
  // con curso/instrumento distintos — hay que releer el filtro cada vez que cambia (el `ts`
  // asegura que se detecte incluso si el usuario clickea el mismo combo de nuevo).
  useEffect(() => {
    if (!filtroInicial) return;
    setCursoId(filtroInicial.curso_id ? String(filtroInicial.curso_id) : '');
    setInstrumentoId(filtroInicial.instrumento_id ? String(filtroInicial.instrumento_id) : '');
  }, [filtroInicial?.ts]);

  const cargar = async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams();
      if (cursoId)       p.set('curso_id', cursoId);
      if (instrumentoId) p.set('instrumento_id', instrumentoId);
      setDatos(await apiFetch(`/api/reportes/nivel?${p}`));
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [cursoId, instrumentoId]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const est = datos || [];
  const sorted = [...est].sort((a, b) => {
    let av = sortCol==='apellido' ? `${a.apellido} ${a.nombre}` : a[sortCol];
    let bv = sortCol==='apellido' ? `${b.apellido} ${b.nombre}` : b[sortCol];
    if (sortCol==='completitud' || sortCol==='porcentaje') { av = av??-1; bv = bv??-1; }
    if (typeof av==='string') return sortDir==='asc' ? av.localeCompare(bv,'es') : bv.localeCompare(av,'es');
    return sortDir==='asc' ? (av??0)-(bv??0) : (bv??0)-(av??0);
  });

  const cursoLabel      = cursoId ? (cursos.find(c=>String(c.id)===cursoId)?.nombre||'') : 'Todos los niveles';
  const instrumentoLabel = instrumentoId ? (instrumentos.find(i=>String(i.id)===instrumentoId)?.nombre||'') : '';
  const filtroLabel      = instrumentoLabel ? `${cursoLabel} · ${instrumentoLabel}` : cursoLabel;

  const exportarCSV = () => {
    if (!sorted.length) return;
    const heads = ['Apellido','Nombre','Curso/Nivel','Instrumento(s)','Teléfono','Tutor','Tel. tutor','Dirección',
                   'Presencias','Ausencias','Tardes','Días','% Asistencia',
                   ...CAMPOS_COMPLETITUD.map(c=>c.label), 'Completitud %'];
    const rows = sorted.map(e => {
      const niveles = (e.inscripciones||[]).map(i=>i.curso_nombre).join(' | ');
      const instrs  = (e.inscripciones||[]).map(i=>i.instrumento_nombre).join(' | ');
      const okCount = CAMPOS_COMPLETITUD.filter(c=>c.ok(e)).length;
      return [
        e.apellido, e.nombre, niveles, instrs,
        e.telefono||'', e.tutor_nombre||'', e.tutor_telefono||'', e.direccion||'',
        e.presencias, e.ausencias, e.tardes, e.total_registros,
        e.porcentaje!==null ? e.porcentaje+'%' : 'Sin datos',
        ...CAMPOS_COMPLETITUD.map(c=>c.ok(e)?'sí':'no'),
        Math.round(okCount/CAMPOS_COMPLETITUD.length*100)+'%',
      ];
    });
    const csv  = [heads,...rows].map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EPM_reporte_nivel_${filtroLabel.replace(/\s+/g,'_')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const SortTh = ({col, label}) => (
    <th className="rpt-th" onClick={()=>toggleSort(col)}>
      {label}{sortCol===col && <span style={{marginLeft:4,fontSize:10}}>{sortDir==='asc'?'▲':'▼'}</span>}
    </th>
  );

  return (
    <div>
      <div className="card no-print" style={{marginBottom:14}}>
        <div className="card-title" style={{marginBottom:12}}>🏫 Resumen por nivel / curso</div>
        <div className="form-grid">
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Nivel / Curso</label>
            <select className="form-control" value={cursoId} onChange={e=>setCursoId(e.target.value)}>
              <option value="">Todos los niveles</option>
              {cursos.map(c=><option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Instrumento</label>
            <select className="form-control" value={instrumentoId} onChange={e=>setInstrumentoId(e.target.value)}>
              <option value="">Todos los instrumentos</option>
              {instrumentos.map(i=><option key={i.id} value={String(i.id)}>{i.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="spinner"><div className="spin" /></div>}

      {!loading && datos && (
        <>
          <div className="no-print" style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
            <button className="btn btn-secondary btn-auto" onClick={exportarCSV}>📤 Exportar CSV</button>
            <button className="btn btn-secondary btn-auto" onClick={()=>window.print()}>🖨️ Imprimir</button>
            <span style={{fontSize:12,color:'var(--text2)'}}>{sorted.length} est. · {filtroLabel}</span>
          </div>

          {sorted.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏫</div>
              <p>No hay estudiantes para mostrar con esos filtros.</p>
            </div>
          ) : (
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <SortTh col="apellido" label="Estudiante" />
                      <th className="rpt-th">Nivel · Instrumento</th>
                      <th className="rpt-th">Contacto</th>
                      <SortTh col="porcentaje" label="% Asist." />
                      <th className="rpt-th">Completitud de datos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(e => {
                      const okCount = CAMPOS_COMPLETITUD.filter(c=>c.ok(e)).length;
                      const pctCompletitud = Math.round(okCount/CAMPOS_COMPLETITUD.length*100);
                      const irAFicha = () => onNavigate && onNavigate('asistencia', e.id);
                      return (
                        <tr key={e.id}>
                          <td className="rpt-nombre" style={{cursor:'pointer'}} onClick={irAFicha}>
                            {e.apellido}, {e.nombre}
                          </td>
                          <td className="rpt-td" style={{fontSize:12}}>
                            {(e.inscripciones||[]).length
                              ? (e.inscripciones||[]).map((i,idx)=>(
                                  <div key={idx}>{i.curso_nombre} · {i.instrumento_nombre}</div>
                                ))
                              : <span style={{color:'var(--text2)'}}>—</span>}
                          </td>
                          <td className="rpt-td" style={{fontSize:12}}>
                            {e.telefono && <div>📱 {e.telefono}</div>}
                            {e.tutor_telefono && <div>👨‍👩‍👧 {e.tutor_telefono}</div>}
                            {!e.telefono && !e.tutor_telefono && <span style={{color:'var(--text2)'}}>—</span>}
                          </td>
                          <td className="rpt-td">
                            {e.porcentaje===null
                              ? <span style={{color:'var(--text2)',fontSize:12}}>Sin datos</span>
                              : <span className={`pct-badge ${e.porcentaje>=90?'pct-alta':e.porcentaje>=75?'pct-media':'pct-baja'}`}>{e.porcentaje}%</span>}
                          </td>
                          <td className="rpt-td">
                            <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                              {CAMPOS_COMPLETITUD.map(c => (
                                <span key={c.key} title={`${c.label}: ${c.ok(e)?'completo':'falta — tocá para completar'}`}
                                  onClick={c.ok(e) ? undefined : irAFicha}
                                  style={{cursor:c.ok(e)?'default':'pointer',fontSize:11,whiteSpace:'nowrap',
                                          padding:'2px 6px',borderRadius:6,
                                          background: c.ok(e)?'rgba(34,197,94,.12)':'rgba(239,68,68,.12)',
                                          color: c.ok(e)?'#16a34a':'#dc2626'}}>
                                  {c.ok(e)?'✅':'❌'} {c.label}
                                </span>
                              ))}
                              <span className={`pct-badge ${pctCompletitud>=90?'pct-alta':pctCompletitud>=60?'pct-media':'pct-baja'}`} style={{marginLeft:4}}>
                                {pctCompletitud}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
