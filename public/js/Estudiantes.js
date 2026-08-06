// ── MODAL IMPORTAR CSV ───────────────────────────────────────────────────────────
function ModalImport({ cursos, instrumentos, onImportado, onClose }) {
  const [fase,        setFase]       = useState('upload'); // upload | preview | done
  const [filas,       setFilas]      = useState([]);
  const [validas,     setValidas]    = useState([]);
  const [errores,     setErrores]    = useState([]);
  const [saving,      setSaving]     = useState(false);
  const [resultado,   setResultado]  = useState(null);
  const [dragOver,    setDragOver]   = useState(false);
  const [parseErr,    setParseErr]   = useState('');

  const procesar = (file) => {
    if (!file) return;
    if (!file.name.match(/\.csv$/i)) { setParseErr('El archivo debe ser .csv'); return; }
    setParseErr('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseCsv(ev.target.result);
        if (!rows.length) { setParseErr('El archivo no tiene filas de datos.'); return; }
        const dnis = rows.map(r=>r['DNI']?.trim()).filter(Boolean);
        const proc = rows.map((r,i) => validarFilaCSV(r, cursos, instrumentos, dnis, i));
        setFilas(proc);
        setValidas(proc.filter(f=>f.ok));
        setErrores(proc.filter(f=>!f.ok));
        setFase('preview');
      } catch(e) { setParseErr('Error al leer el archivo: '+e.message); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const importar = async () => {
    setSaving(true); setParseErr('');
    try {
      const r = await apiFetch('/api/estudiantes/importar', {
        method:'POST',
        body:{ estudiantes: validas.map(f=>({
          nombre:f.nombre, apellido:f.apellido, dni:f.dni,
          cuit:f.cuit||null, fecha_nacimiento:f.fecha_nacimiento||null, telefono:f.telefono||null,
          direccion:f.direccion||null, tutor_nombre:f.tutor_nombre||null,
          tutor_dni:f.tutor_dni||null, tutor_telefono:f.tutor_telefono||null,
          auth_imagen:f.auth_imagen, auth_general:f.auth_general, auth_boleto:f.auth_boleto,
          inscripciones: f.inscripciones||[],
        })) }
      });
      setResultado(r); setFase('done'); onImportado();
    } catch(e) { setParseErr(e.message); }
    finally { setSaving(false); }
  };

  const conInscripciones = validas.filter(f=>(f.inscripciones||[]).length>0).length;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:600}}>
        <div className="modal-header">
          <span className="modal-title">📥 Importar estudiantes desde CSV</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {fase==='upload' && (
          <>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:14,lineHeight:1.6}}>
              Subí un CSV con los datos del plantel. Las columnas deben estar en el orden de la plantilla.
              Los nombres de curso deben coincidir exactamente con los existentes en el sistema.
            </p>
            <button className="btn btn-secondary btn-auto" style={{marginBottom:14}}
              onClick={descargarPlantilla}>
              📄 Descargar plantilla CSV con ejemplos
            </button>
            {parseErr && <div className="alert alert-error">{parseErr}</div>}
            <label className={`import-drop ${dragOver?'over':''}`}
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);procesar(e.dataTransfer.files[0])}}>
              <div style={{fontSize:36}}>📂</div>
              <p><strong>Tocá para elegir un archivo CSV</strong></p>
              <p>o arrastrá el archivo aquí (desktop)</p>
              <input type="file" accept=".csv,text/csv" hidden
                onChange={e=>procesar(e.target.files[0])} />
            </label>
          </>
        )}

        {fase==='preview' && (
          <>
            {validas.length>0 && (
              <div className="alert alert-success" style={{marginBottom:8}}>
                ✅ <strong>{validas.length} estudiante(s)</strong> listos para importar.
                {conInscripciones>0 && <span> · {conInscripciones} con inscripciones</span>}
                {validas.length-conInscripciones>0 && <span> · {validas.length-conInscripciones} sin instrumento</span>}
              </div>
            )}
            {errores.length>0 && (
              <div className="alert alert-error" style={{marginBottom:8}}>
                ❌ <strong>{errores.length} fila(s) con errores</strong> — no se importarán.
              </div>
            )}
            {parseErr && <div className="alert alert-error">{parseErr}</div>}

            <div className="preview-scroll">
              <table className="preview-table">
                <thead>
                  <tr><th>#</th><th>Apellido, Nombre</th><th>DNI</th><th>Inscripciones</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {filas.map(f=>(
                    <tr key={f.idx} className={f.ok?'pr-ok':'pr-err'}>
                      <td>{f.idx}</td>
                      <td>{f.apellido}, {f.nombre}</td>
                      <td>{f.dni}</td>
                      <td>{f.inscripcionesLabel||'—'}</td>
                      <td>{f.ok ? '✅' : <span className="pr-error-msg">{f.errors.join(' · ')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto"
                onClick={()=>{setFase('upload');setParseErr('');}}>← Volver</button>
              <button className="btn btn-primary btn-auto"
                disabled={validas.length===0||saving} onClick={importar}>
                {saving ? 'Importando…' : `💾 Importar ${validas.length} estudiante(s)`}
              </button>
            </div>
          </>
        )}

        {fase==='done' && resultado && (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:56,marginBottom:8}}>✅</div>
            <h3 style={{fontSize:20,fontWeight:800,marginBottom:8}}>¡Importación completada!</h3>
            <p style={{color:'var(--text2)'}}>{resultado.importados} estudiante(s) importados exitosamente.</p>
            {resultado.errores?.length>0 && (
              <div className="alert alert-warning" style={{marginTop:12,textAlign:'left'}}>
                {resultado.errores.length} fila(s) no se importaron (DNI ya existente u otro error).
                <ul style={{marginTop:6,paddingLeft:16,fontSize:12}}>
                  {resultado.errores.map((e,i)=><li key={i}>DNI {e.dni}: {e.error}</li>)}
                </ul>
              </div>
            )}
            <button className="btn btn-primary btn-auto" style={{marginTop:16}} onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CALENDARIO DE ASISTENCIA (componente reutilizable) ──────────────────────────
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_ES  = ['L','M','M','J','V','S','D'];

function CalendarioAsistencia({ estudianteId }) {
  const hoy = new Date();
  const [anio,  setAnio]  = useState(hoy.getFullYear());
  const [mes,   setMes]   = useState(hoy.getMonth());
  const [asis,  setAsis]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [selDay, setSelDay] = useState(null);
  const mencionables = useMencionables();

  useEffect(() => {
    if (!estudianteId) return;
    const inicio = `${anio}-${String(mes+1).padStart(2,'0')}-01`;
    const ultimo = new Date(anio, mes+1, 0).getDate();
    const fin    = `${anio}-${String(mes+1).padStart(2,'0')}-${String(ultimo).padStart(2,'0')}`;
    setLoading(true); setSelDay(null);
    apiFetch(`/api/asistencias/estudiante/${estudianteId}?fecha_inicio=${inicio}&fecha_fin=${fin}`)
      .then(setAsis).catch(()=>setAsis([]))
      .finally(()=>setLoading(false));
  }, [estudianteId, anio, mes]);

  const prevMes = () => { if (mes===0){setAnio(a=>a-1);setMes(11);}else setMes(m=>m-1); };
  const nextMes = () => {
    const esActual = anio===hoy.getFullYear()&&mes>=hoy.getMonth();
    if (!esActual) { if(mes===11){setAnio(a=>a+1);setMes(0);}else setMes(m=>m+1); }
  };
  const esFuturo = anio===hoy.getFullYear()&&mes>=hoy.getMonth();

  // Mapa fecha → asistencia
  const asMap = {};
  asis.forEach(a => { asMap[a.fecha] = a; });

  // Construir grilla del mes (lunes primero)
  const firstDow  = new Date(anio, mes, 1).getDay();
  const startPad  = (firstDow===0) ? 6 : firstDow-1;
  const lastDay   = new Date(anio, mes+1, 0).getDate();
  const days = [];
  for (let i=0; i<startPad; i++) days.push(null);
  for (let d=1; d<=lastDay; d++) {
    const dateStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = new Date(anio,mes,d).getDay();
    days.push({ d, dateStr, isWeekend:dow===0||dow===6, a:asMap[dateStr]||null });
  }
  while (days.length%7!==0) days.push(null);

  const pres  = asis.filter(a=>a.estado==='presente').length;
  const aus   = asis.filter(a=>a.estado==='ausente').length;
  const tard  = asis.filter(a=>a.estado==='tarde').length;
  const total = pres+aus+tard;
  const pct   = total>0 ? Math.round(pres/total*100) : null;

  return (
    <div>
      {/* Navegación mes */}
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMes}>←</button>
        <span className="cal-month-label">{MESES_ES[mes]} {anio}</span>
        <button className="cal-nav-btn" onClick={nextMes} disabled={esFuturo}>→</button>
      </div>

      {/* Resumen */}
      {total>0 && (
        <div className="cal-summary">
          <div className="cal-sum-item"><div className="cal-sum-dot" style={{background:'#22c55e'}}/>✅ {pres}{pct!==null&&` (${pct}%)`}</div>
          <div className="cal-sum-item"><div className="cal-sum-dot" style={{background:'#ef4444'}}/>❌ {aus}</div>
          <div className="cal-sum-item"><div className="cal-sum-dot" style={{background:'#f59e0b'}}/>⏰ {tard}</div>
        </div>
      )}

      {loading ? <div className="spinner" style={{padding:16}}><div className="spin"/></div> : (
        <>
          {/* Encabezados días */}
          <div className="cal-header">
            {DIAS_ES.map((d,i)=><div key={i} className="cal-dow">{d}</div>)}
          </div>

          {/* Grilla */}
          <div className="cal-grid">
            {days.map((cell,i) => {
              if (!cell) return <div key={i} className="cal-cell cal-empty"/>;
              const { d, dateStr, isWeekend, a } = cell;
              const isSel = selDay?.dateStr===dateStr;

              // Clases CSS
              let cls = 'cal-cell';
              if (isWeekend) cls += ' cal-weekend';
              else if (a)    cls += ` cal-${a.estado}`;
              else           cls += ' cal-nodata';
              if (isSel)     cls += ' cal-selected';

              // Inline style como respaldo — garantiza el color sin importar la cascada
              const inlineStyle = {};
              if (!isWeekend && a) {
                if (a.estado==='presente') Object.assign(inlineStyle,{background:'#22c55e',borderColor:'#16a34a'});
                if (a.estado==='ausente')  Object.assign(inlineStyle,{background:'#ef4444',borderColor:'#dc2626'});
                if (a.estado==='tarde')    Object.assign(inlineStyle,{background:'#f59e0b',borderColor:'#d97706'});
              }

              const SIMBOLO = { presente:'✓', ausente:'✗', tarde:'~' };

              return (
                <div key={i} className={cls} style={inlineStyle}
                  onClick={()=>{ if(!isWeekend) setSelDay(isSel?null:{...cell}); }}>
                  <span className="cal-day-num" style={!isWeekend&&a?{color:'#fff',fontWeight:800}:{}}>{d}</span>
                  {!isWeekend && a && <span className="cal-status">{SIMBOLO[a.estado]||''}</span>}
                  {a?.observacion && <span className="cal-obs-dot" style={{color:'rgba(255,255,255,.8)'}}>●</span>}
                </div>
              );
            })}
          </div>

          {/* Detalle día seleccionado */}
          {selDay && (
            <div className="cal-obs-card">
              <div className="cal-obs-fecha">
                {new Date(selDay.dateStr+'T12:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}
              </div>
              {selDay.a ? (
                <>
                  <div style={{marginBottom:selDay.a.observacion?4:0}}>
                    {selDay.a.estado==='presente'&&'✅ Presente'}
                    {selDay.a.estado==='ausente'&&'❌ Ausente'}
                    {selDay.a.estado==='tarde'&&'⏰ Tarde'}
                  </div>
                  {selDay.a.observacion&&<div style={{fontSize:12,color:'var(--text2)'}}>💬 <MencionesTexto texto={selDay.a.observacion} usuarios={mencionables} /></div>}
                </>
              ) : (
                <div style={{color:'var(--text2)'}}>Sin registro de asistencia este día.</div>
              )}
            </div>
          )}

          {total===0 && (
            <div style={{textAlign:'center',padding:'16px 0',color:'var(--text2)',fontSize:13}}>
              Sin registros en {MESES_ES[mes]} {anio}.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── LISTA DE ESTUDIANTES ────────────────────────────────────────────────────────
function ListaEstudiantes({ user, onNuevo, onEditar, onVerReporteNivel }) {
  const [cursos,        setCursos]        = useState([]);
  const [instrumentos,  setInstrumentos]  = useState([]);
  const [cursoId,       setCursoId]       = useState('');
  const [instrumentoId, setInstrumentoId] = useState('');
  const [buscar,        setBuscar]        = useState('');
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [delTarget,   setDelTarget]   = useState(null);
  const [toast,       setToast]       = useState({ type:'', text:'' });
  // ── Selección y bulk
  const [sel,         setSel]         = useState(new Set());
  const [modalBulk,   setModalBulk]   = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkAuths,   setBulkAuths]   = useState({ auth_imagen:false, auth_general:false, auth_boleto:false });
  const [bulkSaving,  setBulkSaving]  = useState(false);
  const [modalImport, setModalImport] = useState(false);

  const puede = (p) => user.permisos?.includes(p);
  const showToast = (type, text) => { setToast({ type, text }); setTimeout(() => setToast({type:'',text:''}), 4000); };

  useEffect(() => {
    apiFetch('/api/cursos').then(setCursos).catch(()=>{});
    apiFetch('/api/instrumentos').then(setInstrumentos).catch(()=>{});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (cursoId)        p.set('curso_id',       cursoId);
      if (instrumentoId)  p.set('instrumento_id', instrumentoId);
      if (buscar.trim())  p.set('buscar',          buscar.trim());
      setEstudiantes(await apiFetch(`/api/estudiantes?${p}`));
      setSel(new Set());
    } catch (e) { showToast('error', e.message); }
    finally { setLoading(false); }
  }, [cursoId, instrumentoId, buscar]);

  useEffect(() => { const t = setTimeout(cargar, buscar ? 300 : 0); return () => clearTimeout(t); }, [cargar]);

  const confirmarBaja = async () => {
    try {
      await apiFetch(`/api/estudiantes/${delTarget.id}`, { method:'DELETE' });
      showToast('success', `${delTarget.apellido}, ${delTarget.nombre} fue dado de baja.`);
      setDelTarget(null); cargar();
    } catch (e) { showToast('error', e.message); }
  };

  const toggleSel = (id) => setSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleTodos = () => setSel(sel.size === estudiantes.length ? new Set() : new Set(estudiantes.map(e => e.id)));

  const exportarCSV = () => {
    const target = sel.size > 0 ? estudiantes.filter(e => sel.has(e.id)) : estudiantes;
    const rows = target.map(e => [
      e.nombre, e.apellido, e.dni, e.cuit||'',
      e.fecha_nacimiento ? e.fecha_nacimiento.split('-').reverse().join('/') : '',
      e.telefono||'', e.direccion||'', e.tutor_nombre||'', e.tutor_dni||'', e.tutor_telefono||'',
      e.auth_imagen?'sí':'no', e.auth_general?'sí':'no', e.auth_boleto?'sí':'no',
      (e.inscripciones||[]).map(i=>i.curso_nombre).join('|'),
      (e.inscripciones||[]).map(i=>i.instrumento_nombre).join('|'),
    ]);
    const csv  = [COLS_CSV,...rows].map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    const curso = cursoId ? (cursos.find(c=>String(c.id)===cursoId)?.nombre||'plantel') : 'plantel';
    a.download = `EPM_${curso}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const aplicarBulk = async () => {
    if (!bulkAuths.auth_imagen && !bulkAuths.auth_general && !bulkAuths.auth_boleto) return;
    setBulkSaving(true);
    try {
      const r = await apiFetch('/api/estudiantes/bulk-autorizar', { method:'PUT', body:{ ids: [...sel], ...bulkAuths } });
      showToast('success', `${r.actualizados} estudiante(s) actualizados.`);
      setModalBulk(false); setConfirmBulk(false);
      setSel(new Set()); setBulkAuths({ auth_imagen:false, auth_general:false, auth_boleto:false });
      cargar();
    } catch (e) { showToast('error', e.message); }
    finally { setBulkSaving(false); }
  };

  const ini = (e) => `${e.nombre?.[0]||''}${e.apellido?.[0]||''}`.toUpperCase();
  const nombresAuths = { auth_imagen:'Imagen', auth_general:'General', auth_boleto:'Boleto' };
  const authsSeleccionadas = Object.entries(bulkAuths).filter(([,v])=>v).map(([k])=>nombresAuths[k]).join(', ');

  return (
    <div>
      {toast.text && (
        <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}} onClick={() => setToast({type:'',text:''})}>
          {toast.text}
        </div>
      )}
      <div className="card">
        <div className="section-header">
          <span className="card-title" style={{marginBottom:0}}>👥 Estudiantes</span>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button className="btn btn-secondary btn-auto" onClick={exportarCSV}>📤 Exportar CSV</button>
            {puede('crear_estudiantes') && (<>
              <button className="btn btn-secondary btn-auto" onClick={() => setModalImport(true)}>📥 Importar</button>
              <button className="btn btn-primary btn-auto" onClick={onNuevo}>＋ Nueva ficha</button>
            </>)}
          </div>
        </div>

        {/* Filtro por nivel */}
        <div className="curso-tabs">
          <div className={`curso-tab ${!cursoId?'active':''}`} onClick={() => setCursoId('')}>Todos los niveles</div>
          {cursos.map(c => (
            <div key={c.id} className={`curso-tab ${String(cursoId)===String(c.id)?'active':''}`}
              onClick={() => setCursoId(String(c.id))}>{c.nombre}</div>
          ))}
        </div>

        {/* Filtro por instrumento */}
        {instrumentos.length > 0 && (
          <div style={{marginBottom:8}}>
            <select className="form-control" value={instrumentoId} onChange={e=>setInstrumentoId(e.target.value)}
              style={{fontSize:13}}>
              <option value="">🎸 Todos los instrumentos</option>
              {instrumentos.map(i=><option key={i.id} value={String(i.id)}>{i.nombre}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <input className="form-control" placeholder="🔍 Buscar por nombre, apellido o DNI…"
            value={buscar} onChange={e => setBuscar(e.target.value)} />
        </div>

        {/* Barra de selección / bulk */}
        {puede('editar_estudiantes') && !loading && estudiantes.length > 0 && (
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <div className={`est-check ${sel.size===estudiantes.length&&estudiantes.length>0?'on':''}`}
              onClick={toggleTodos} title="Seleccionar todos">
              {sel.size===estudiantes.length&&estudiantes.length>0?'✓':''}
            </div>
            <span style={{fontSize:12,color:'var(--text2)'}}>
              {sel.size > 0 ? `${sel.size} seleccionado(s)` : 'Seleccionar todos'}
            </span>
            {sel.size > 0 && (
              <button className="btn btn-secondary btn-auto" style={{marginLeft:'auto'}}
                onClick={() => setModalBulk(true)}>
                ✅ Marcar autorizaciones ({sel.size})
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="spinner"><div className="spin" /></div>
        ) : estudiantes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <p>{buscar ? 'Sin resultados para esa búsqueda.' : 'No hay estudiantes aquí todavía.'}</p>
          </div>
        ) : estudiantes.map(e => (
          <div key={e.id} className={`est-row ${sel.has(e.id)?'sel':''}`}>
            {puede('editar_estudiantes') && (
              <div className={`est-check ${sel.has(e.id)?'on':''}`} onClick={() => toggleSel(e.id)}>
                {sel.has(e.id)?'✓':''}
              </div>
            )}
            <div className="est-avatar" style={{cursor:'pointer'}} onClick={() => onEditar(e.id)}>
              {e.foto_path
                ? <img src={e.foto_path} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}} />
                : ini(e)}
            </div>
            <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={() => onEditar(e.id)}>
              <div className="est-nombre">{e.apellido}, {e.nombre}</div>
              <div className="est-sub">DNI {e.dni}</div>
            </div>
            {(e.inscripciones||[]).map(i=>(
              <span key={i.id} className="est-tag est-tag-link" style={{fontSize:11}}
                title={`Ver reporte de ${i.curso_nombre} · ${i.instrumento_nombre}`}
                onClick={(ev) => { ev.stopPropagation(); onVerReporteNivel?.(i.curso_id, i.instrumento_id); }}>
                {i.curso_nombre} · {i.instrumento_nombre}
              </span>
            ))}
            <div className="row-actions">
              <button className="btn-icon" onClick={() => onEditar(e.id)} title="Editar ficha">✏️</button>
              {puede('editar_estudiantes') && (
                <button className="btn-icon btn-icon-danger" onClick={() => setDelTarget(e)} title="Dar de baja">🗑️</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal bulk autorizar */}
      {modalBulk && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalBulk(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">✅ Marcar autorizaciones</span>
              <button className="modal-close" onClick={() => setModalBulk(false)}>✕</button>
            </div>
            <p style={{marginBottom:12,fontSize:13,color:'var(--text2)'}}>
              Se aplicará a <strong>{sel.size} estudiante(s)</strong>. Solo marca; no desmarca autorizaciones ya otorgadas.
            </p>
            <div className="auth-list">
              {Object.entries(nombresAuths).map(([campo, label]) => (
                <div key={campo} className={`auth-row ${bulkAuths[campo]?'on':''}`}
                  onClick={() => setBulkAuths(prev => ({...prev, [campo]:!prev[campo]}))}>
                  <div className="auth-check">{bulkAuths[campo]?'✓':''}</div>
                  <div className="auth-label">Autorización de {label}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={() => setModalBulk(false)}>Cancelar</button>
              <button className="btn btn-primary btn-auto"
                disabled={!bulkAuths.auth_imagen && !bulkAuths.auth_general && !bulkAuths.auth_boleto}
                onClick={() => setConfirmBulk(true)}>Continuar →</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación bulk */}
      {confirmBulk && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Confirmar cambio masivo</span>
            </div>
            <div className="alert alert-warning">
              Esto va a generar el siguiente cambio: se va a marcar como <strong>SÍ</strong> la autorización de&nbsp;
              <strong>{authsSeleccionadas}</strong> en <strong>{sel.size} estudiante(s)</strong>.
              Esta acción no puede deshacerse desde la interfaz.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={() => setConfirmBulk(false)}>Volver</button>
              <button className="btn btn-primary btn-auto" onClick={aplicarBulk} disabled={bulkSaving}>
                {bulkSaving ? 'Aplicando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalImport && (
        <ModalImport
          cursos={cursos}
          instrumentos={instrumentos}
          onImportado={() => { cargar(); setSel(new Set()); }}
          onClose={() => setModalImport(false)}
        />
      )}

      {/* Modal baja */}
      {delTarget && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setDelTarget(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Dar de baja al estudiante</span>
              <button className="modal-close" onClick={() => setDelTarget(null)}>✕</button>
            </div>
            <p style={{marginBottom:12}}>Estudiante: <strong>{delTarget.apellido}, {delTarget.nombre}</strong></p>
            <div className="alert alert-warning">
              Esto va a generar el siguiente cambio: el estudiante quedará <strong>inactivo</strong> y no
              aparecerá en los listados. Todos sus registros se conservan intactos.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={() => setDelTarget(null)}>Cancelar</button>
              <button className="btn btn-danger btn-auto" onClick={confirmarBaja}>Confirmar baja</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PANEL DE INSCRIPCIONES (dentro de la Ficha) ──────────────────────────────────
function InscripcionesPanel({ estudianteId, user }) {
  const [inscripciones, setInscripciones] = useState([]);
  const [cursos,        setCursos]        = useState([]);
  const [instrumentos,  setInstrumentos]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState(false);
  const [editando,      setEditando]      = useState(null); // { id, instrumento_id, instrumento_nombre, curso_id }
  const [form,          setForm]          = useState({ curso_id:'', instrumento_id:'' });
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const puede = (p) => user.permisos?.includes(p);

  const cargar = async () => {
    setLoading(true);
    try {
      const [ins, cs, instr] = await Promise.all([
        apiFetch(`/api/estudiantes/${estudianteId}/inscripciones`),
        apiFetch('/api/cursos'),
        apiFetch('/api/instrumentos'),
      ]);
      setInscripciones(ins); setCursos(cs); setInstrumentos(instr);
    } catch(e) {} finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [estudianteId]);

  const abrirAgregar = () => {
    setEditando(null); setForm({ curso_id:'', instrumento_id:'' }); setError(''); setModal(true);
  };
  const abrirEditar  = (ins) => {
    setEditando(ins); setForm({ curso_id: String(ins.curso_id), instrumento_id: String(ins.instrumento_id) });
    setError(''); setModal(true);
  };
  const cerrar = () => setModal(false);

  const guardar = async () => {
    if (!form.curso_id) { setError('Seleccioná un nivel'); return; }
    if (!editando && !form.instrumento_id) { setError('Seleccioná un instrumento'); return; }
    setSaving(true); setError('');
    try {
      if (editando) {
        await apiFetch(`/api/estudiantes/${estudianteId}/inscripciones/${editando.id}`, {
          method:'PUT', body:{ curso_id: Number(form.curso_id) }
        });
      } else {
        await apiFetch(`/api/estudiantes/${estudianteId}/inscripciones`, {
          method:'POST', body:{ curso_id: Number(form.curso_id), instrumento_id: Number(form.instrumento_id) }
        });
      }
      cerrar(); cargar();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const quitar = async (ins) => {
    if (!window.confirm(`¿Quitar la inscripción de ${ins.instrumento_nombre}?`)) return;
    try {
      await apiFetch(`/api/estudiantes/${estudianteId}/inscripciones/${ins.id}`, { method:'DELETE' });
      cargar();
    } catch(e) {}
  };

  // El mismo instrumento puede repetirse en niveles distintos (ej: Mojarrita de Guitarra
  // Y Delfín de Guitarra a la vez), así que ya no se ocultan del selector — se muestran
  // todos y, si corresponde, se avisa con una advertencia no bloqueante.
  const instrDisponibles = instrumentos;

  // Otras inscripciones activas del mismo instrumento (para la advertencia no bloqueante)
  const otrasConMismoInstrumento = form.instrumento_id
    ? inscripciones.filter(i =>
        Number(i.instrumento_id) === Number(form.instrumento_id) &&
        (!editando || i.id !== editando.id) &&
        String(i.curso_id) !== String(form.curso_id))
    : [];

  const NIVEL_ORDER = { Mojarritas:1, Delfines:2, Tiburones:3, Pulpos:4 };
  const nivelBadge  = (nombre) => {
    const emoji = { Mojarritas:'🐟', Delfines:'🐬', Tiburones:'🦈', Pulpos:'🐙' }[nombre] || '📚';
    return `${emoji} ${nombre}`;
  };

  if (loading) return <div className="spinner" style={{padding:12}}><div className="spin"/></div>;

  return (
    <div>
      {inscripciones.length === 0
        ? <p style={{color:'var(--text2)',fontSize:13,marginBottom:8}}>Sin inscripciones activas.</p>
        : inscripciones.map(ins => (
          <div key={ins.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,padding:'8px 10px',
                                    background:'var(--bg3)',borderRadius:8}}>
            <span style={{flex:1,fontSize:14}}>
              <strong>{nivelBadge(ins.curso_nombre)}</strong>
              <span style={{color:'var(--text2)',marginLeft:6}}>·</span>
              <span style={{marginLeft:6}}>{ins.instrumento_nombre}</span>
            </span>
            {puede('editar_estudiantes') && (<>
              <button className="btn-icon" onClick={() => abrirEditar(ins)} title="Cambiar nivel">✏️</button>
              <button className="btn-icon btn-icon-danger" onClick={() => quitar(ins)} title="Quitar">🗑️</button>
            </>)}
          </div>
        ))
      }
      {puede('editar_estudiantes') && instrumentos.length > 0 && (
        <button className="btn btn-secondary btn-auto" style={{marginTop:4}} onClick={abrirAgregar}>
          ＋ Agregar instrumento
        </button>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&cerrar()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editando ? `Cambiar nivel · ${editando.instrumento_nombre}` : 'Agregar inscripción'}</span>
              <button className="modal-close" onClick={cerrar}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}

            {!editando && (
              <div className="form-group">
                <label className="form-label">Instrumento</label>
                <select className="form-control" value={form.instrumento_id}
                  onChange={e=>setForm(p=>({...p,instrumento_id:e.target.value}))}>
                  <option value="">-- Seleccionar --</option>
                  {instrDisponibles.map(i=><option key={i.id} value={String(i.id)}>{i.nombre}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Nivel</label>
              <select className="form-control" value={form.curso_id}
                onChange={e=>setForm(p=>({...p,curso_id:e.target.value}))}>
                <option value="">-- Seleccionar --</option>
                {[...cursos].sort((a,b)=>(NIVEL_ORDER[a.nombre]||99)-(NIVEL_ORDER[b.nombre]||99))
                  .map(c=><option key={c.id} value={String(c.id)}>{nivelBadge(c.nombre)}</option>)}
              </select>
            </div>

            {otrasConMismoInstrumento.length > 0 && (
              <div className="alert alert-warning" style={{fontSize:13}}>
                ⚠️ Este estudiante ya tiene otra inscripción en {otrasConMismoInstrumento[0].instrumento_nombre}
                {' '}({otrasConMismoInstrumento.map(i=>nivelBadge(i.curso_nombre)).join(', ')}). Podés continuar igual.
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando…' : editando ? 'Cambiar nivel' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LEGAJO: componentes auxiliares ───────────────────────────────────────────────
function HistorialItem({ entry, usuarios }) {
  const fecha = entry.fecha ? entry.fecha.split('-').reverse().join('/') : '—';
  const cuandoCargado = entry.created_at
    ? new Date(entry.created_at).toLocaleDateString('es-AR')
    : '';
  return (
    <div className="tl-entry">
      <div className="tl-dot" />
      <div className="tl-body">
        <div className="tl-fecha">{fecha}</div>
        <div className="tl-desc">
          {usuarios ? <MencionesTexto texto={entry.descripcion} usuarios={usuarios} /> : entry.descripcion}
        </div>
        <div className="tl-meta">
          {entry.autor ? `Cargado por ${entry.autor}` : 'Sistema'}
          {cuandoCargado ? ` · ${cuandoCargado}` : ''}
        </div>
      </div>
    </div>
  );
}

// `usuarios` es opcional: si viene, habilita el picker de @menciones en la descripción.
function HistorialInput({ onAdd, placeholder, usuarios }) {
  const hoy = new Date().toISOString().slice(0,10);
  const [fecha,  setFecha]  = useState(hoy);
  const [desc,   setDesc]   = useState('');
  const [saving, setSaving] = useState(false);

  const agregar = async () => {
    if (!desc.trim() || !fecha) return;
    setSaving(true);
    try { await onAdd({ fecha, descripcion: desc.trim() }); setDesc(''); }
    catch(e) {}
    finally { setSaving(false); }
  };

  return (
    <div className="tl-add">
      <input className="form-control" type="date" value={fecha} onChange={e=>setFecha(e.target.value)} />
      {usuarios
        ? <MencionInput as="textarea" rows={2} value={desc} usuarios={usuarios} onChange={setDesc}
            placeholder={(placeholder||'Descripción…') + ' (@ para mencionar a alguien)'} />
        : <textarea className="form-control" rows={2} placeholder={placeholder||'Descripción…'}
            value={desc} onChange={e=>setDesc(e.target.value)} />}
      <button className="btn btn-primary btn-auto" onClick={agregar}
        disabled={saving || !desc.trim() || !fecha}>
        {saving ? 'Guardando…' : '＋ Agregar entrada'}
      </button>
    </div>
  );
}

const LEGAJO_VACIO = {
  composicion_familiar:'', emergencia_nombre:'', emergencia_telefono:'', obra_social:'',
  alergias:'', medicacion:'', condiciones_salud:'', instituciones_anteriores:'',
};

function LegajoTab({ estudianteId, user }) {
  const [form,     setForm]     = useState(LEGAJO_VACIO);
  const [savedForm,setSavedForm]= useState(LEGAJO_VACIO);
  const [saludH,   setSaludH]   = useState([]);
  const [trayH,    setTrayH]    = useState([]);
  const [obsH,     setObsH]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');
  const [error,    setError]    = useState('');
  const mencionables = useMencionables(); // solo se usa en "Observaciones generales"

  const puede   = (p) => user.permisos?.includes(p);
  const setF    = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/legajo/${estudianteId}`);
      const d = {
        composicion_familiar:     data.datos?.composicion_familiar     || '',
        emergencia_nombre:        data.datos?.emergencia_nombre        || '',
        emergencia_telefono:      data.datos?.emergencia_telefono      || '',
        obra_social:              data.datos?.obra_social              || '',
        alergias:                 data.datos?.alergias                 || '',
        medicacion:               data.datos?.medicacion               || '',
        condiciones_salud:        data.datos?.condiciones_salud        || '',
        instituciones_anteriores: data.datos?.instituciones_anteriores || '',
      };
      setForm(d); setSavedForm(d);
      setSaludH(data.salud_historial      || []);
      setTrayH(data.trayectoria_historial || []);
      setObsH(data.observaciones          || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [estudianteId]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const guardarDatos = async () => {
    setSaving(true); setError('');
    try {
      await apiFetch(`/api/legajo/${estudianteId}/datos`, { method:'PUT', body: form });
      setSavedForm(form); showToast('✅ Legajo guardado');
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const addSalud = async (entry) => {
    const r = await apiFetch(`/api/legajo/${estudianteId}/salud`, { method:'POST', body: entry });
    setSaludH(prev => [{ ...entry, id:r.id, autor:user.nombre, created_at:new Date().toISOString() }, ...prev]);
  };
  const addTray = async (entry) => {
    const r = await apiFetch(`/api/legajo/${estudianteId}/trayectoria`, { method:'POST', body: entry });
    setTrayH(prev => [{ ...entry, id:r.id, autor:user.nombre, created_at:new Date().toISOString() }, ...prev]);
  };
  const addObs = async (entry) => {
    const r = await apiFetch(`/api/legajo/${estudianteId}/observacion`, { method:'POST', body: entry });
    setObsH(prev => [{ ...entry, id:r.id, autor:user.nombre, created_at:new Date().toISOString() }, ...prev]);
  };

  if (loading) return <div className="spinner"><div className="spin"/></div>;

  const editable = puede('editar_legajo_personal');

  return (
    <div>
      {toast && <div className="alert alert-success" style={{marginBottom:8}}>{toast}</div>}
      {error && <div className="alert alert-error" style={{marginBottom:8}}>{error}</div>}

      {/* ── 1. Grupo familiar ── */}
      <div className="ficha-section">
        <div className="ficha-section-title">👨‍👩‍👧 Grupo familiar</div>
        <div className="form-group">
          <label className="form-label">Composición familiar</label>
          <textarea className="form-control" rows={2} value={form.composicion_familiar}
            onChange={e=>setF('composicion_familiar',e.target.value)} disabled={!editable}
            placeholder="Ej: Vive con madre y dos hermanos menores" />
        </div>
        <div className="form-grid">
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Contacto de emergencia</label>
            <input className="form-control" value={form.emergencia_nombre}
              onChange={e=>setF('emergencia_nombre',e.target.value)} disabled={!editable}
              placeholder="Nombre y relación" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Teléfono de emergencia</label>
            <input className="form-control" inputMode="tel" value={form.emergencia_telefono}
              onChange={e=>setF('emergencia_telefono',e.target.value)} disabled={!editable}
              placeholder="Ej: 11-1234-5678" />
          </div>
        </div>
        <div className="form-group" style={{marginBottom:0,marginTop:12}}>
          <label className="form-label">Obra social / cobertura médica</label>
          <input className="form-control" value={form.obra_social}
            onChange={e=>setF('obra_social',e.target.value)} disabled={!editable}
            placeholder="Nombre de la cobertura o 'No tiene'" />
        </div>
      </div>

      {/* ── 2. Salud ── */}
      <div className="ficha-section">
        <div className="ficha-section-title">🏥 Salud</div>
        <div className="form-grid">
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Alergias</label>
            <input className="form-control" value={form.alergias}
              onChange={e=>setF('alergias',e.target.value)} disabled={!editable}
              placeholder="Ej: Penicilina, mariscos, o 'Ninguna'" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Medicación actual</label>
            <input className="form-control" value={form.medicacion}
              onChange={e=>setF('medicacion',e.target.value)} disabled={!editable}
              placeholder="Ej: Ritalin 10mg o 'Ninguna'" />
          </div>
        </div>
        <div className="form-group" style={{marginTop:12,marginBottom:0}}>
          <label className="form-label">Condiciones de salud a tener en cuenta</label>
          <textarea className="form-control" rows={2} value={form.condiciones_salud}
            onChange={e=>setF('condiciones_salud',e.target.value)} disabled={!editable}
            placeholder="Ej: Asma, diabetes, condición motriz, etc." />
        </div>

        <div className="legajo-subtitle">Historial de salud</div>
        <div className="tl-list">
          {saludH.length === 0
            ? <p className="tl-empty">Sin entradas registradas.</p>
            : saludH.map(e => <HistorialItem key={e.id} entry={e} />)
          }
        </div>
        {editable && <HistorialInput onAdd={addSalud} placeholder="Ej: Se detectó alergia a X. Se comunicó a la familia." />}
      </div>

      {/* ── 3. Trayectoria educativa ── */}
      <div className="ficha-section">
        <div className="ficha-section-title">🎓 Trayectoria educativa</div>
        <div className="form-group">
          <label className="form-label">Instituciones anteriores</label>
          <textarea className="form-control" rows={2} value={form.instituciones_anteriores}
            onChange={e=>setF('instituciones_anteriores',e.target.value)} disabled={!editable}
            placeholder="Ej: Escuela N° 5 San Martín 2018-2023, Conservatorio municipal 2023-2024" />
        </div>

        <div className="legajo-subtitle">Historial de trayectoria</div>
        <div className="tl-list">
          {trayH.length === 0
            ? <p className="tl-empty">Sin entradas registradas.</p>
            : trayH.map(e => <HistorialItem key={e.id} entry={e} />)
          }
        </div>
        {editable && <HistorialInput onAdd={addTray} placeholder="Ej: Ingresa a la EPM como Mojarrita de Guitarra." />}
      </div>

      {/* ── 4. Observaciones generales ── */}
      <div className="ficha-section">
        <div className="ficha-section-title">📝 Observaciones generales</div>
        <div className="tl-list">
          {obsH.length === 0
            ? <p className="tl-empty">Sin observaciones registradas.</p>
            : obsH.map(e => <HistorialItem key={e.id} entry={e} usuarios={mencionables} />)
          }
        </div>
        {editable && <HistorialInput onAdd={addObs} usuarios={mencionables}
          placeholder="Cualquier observación relevante sobre el estudiante." />}
      </div>

      {/* Botón guardar campos fijos */}
      {editable && isDirty && (
        <div className="legajo-save-bar">
          <button className="btn btn-primary btn-auto" onClick={guardarDatos} disabled={saving}>
            {saving ? 'Guardando…' : '💾 Guardar legajo'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── FICHA DE ESTUDIANTE ──────────────────────────────────────────────────────────
const FORM_VACIO = {
  nombre:'', apellido:'', dni:'', cuit:'', fecha_nacimiento:'', telefono:'',
  tutor_nombre:'', tutor_dni:'', tutor_telefono:'', direccion:'',
  auth_imagen:false, auth_general:false, auth_boleto:false,
};

const AUTORIZACIONES = [
  { campo:'auth_imagen',  label:'Autorización de Imagen',          sub:'Permite usar la imagen del estudiante en comunicaciones institucionales.' },
  { campo:'auth_general', label:'Autorización General',            sub:'Autorización general para actividades y salidas escolares.' },
  { campo:'auth_boleto',  label:'Autorización Boleto Estudiantil', sub:'Solicitud del beneficio de boleto estudiantil de transporte.' },
];

function Ficha({ user, estudianteId, initialTab, onClose, onGuardarYCargarOtro, onCreado }) {
  const isNew = !estudianteId;
  const [form,         setForm]        = useState(FORM_VACIO);
  const [savedForm,    setSavedForm]   = useState(FORM_VACIO);
  const [loading,      setLoading]     = useState(!isNew);
  const [saving,       setSaving]      = useState(false);
  const [error,        setError]       = useState('');
  // ── Foto
  const [fotoActual,   setFotoActual]  = useState(null);
  const [fotoPend,     setFotoPend]    = useState(null);   // File object pendiente
  const [fotoPreview,  setFotoPreview] = useState(null);   // DataURL local
  const [fotoQuitada,  setFotoQuitada] = useState(false);
  const [tab,          setTab]         = useState(initialTab || 'datos');

  const puede = (p) => user.permisos?.includes(p);
  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }));
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm) || !!fotoPend || fotoQuitada;

  useEffect(() => {
    if (!isNew) {
      apiFetch(`/api/estudiantes/${estudianteId}`)
        .then(data => {
          const f = {
            nombre:           data.nombre || '',
            apellido:         data.apellido || '',
            dni:              data.dni || '',
            cuit:             data.cuit || '',
            fecha_nacimiento: data.fecha_nacimiento || '',
            telefono:         data.telefono || '',
            direccion:        data.direccion || '',
            tutor_nombre:     data.tutor_nombre || '',
            tutor_dni:        data.tutor_dni || '',
            tutor_telefono:   data.tutor_telefono || '',
            auth_imagen:      !!data.auth_imagen,
            auth_general:     !!data.auth_general,
            auth_boleto:      !!data.auth_boleto,
          };
          setForm(f); setSavedForm(f);
          setFotoActual(data.foto_path || null);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, []);

  const handleClose = () => {
    if (isDirty && !window.confirm('Hay cambios sin guardar. ¿Salir de todas formas?')) return;
    onClose();
  };

  const onFotoSel = (file) => {
    setFotoPend(file); setFotoQuitada(false);
    const r = new FileReader(); r.onload = e => setFotoPreview(e.target.result); r.readAsDataURL(file);
  };

  const quitarFoto = () => {
    setFotoPend(null); setFotoPreview(null);
    if (fotoActual) setFotoQuitada(true);
    setFotoActual(null);
  };

  const guardar = async (modo) => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.dni.trim()) {
      setError('Nombre, apellido y DNI son obligatorios.'); return;
    }
    setSaving(true); setError('');
    try {
      const body = {
        ...form,
        auth_imagen:  form.auth_imagen  ? 1 : 0,
        auth_general: form.auth_general ? 1 : 0,
        auth_boleto:  form.auth_boleto  ? 1 : 0,
      };
      let estId = estudianteId;
      if (isNew) { const r = await apiFetch('/api/estudiantes', { method:'POST', body }); estId = r.id; }
      else { await apiFetch(`/api/estudiantes/${estudianteId}`, { method:'PUT', body }); }

      if (fotoQuitada && estId) {
        await fetch(`/api/estudiantes/${estId}/foto`, { method:'DELETE', headers:{ Authorization:`Bearer ${getToken()}` } });
      }
      if (fotoPend && estId) {
        await apiFotoUpload(estId, fotoPend);
      }
      setSavedForm(form); setFotoPend(null); setFotoQuitada(false);
      if (modo === 'otro') { onGuardarYCargarOtro(); }
      else if (isNew && onCreado) { onCreado(estId); }
      else { onClose(); }
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const initials = [form.nombre?.[0], form.apellido?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const fotoSrc  = fotoPreview || fotoActual;
  const titulo   = isNew ? 'Nueva ficha' : (form.apellido || form.nombre) ? `${form.apellido}, ${form.nombre}` : 'Editando estudiante';

  if (loading) return <div className="spinner"><div className="spin" /></div>;

  return (
    <div className="ficha-wrap">
      {/* ── Header con avatar-foto ── */}
      <div className="ficha-header">
        <button className="btn btn-secondary btn-auto" style={{flexShrink:0}} onClick={handleClose}>← Lista</button>
        <label className="foto-avatar-wrap" title={fotoSrc ? 'Cambiar foto' : 'Agregar foto'}>
          {fotoSrc ? <img src={fotoSrc} alt="foto" /> : initials}
          <input type="file" accept="image/*" hidden onChange={e => e.target.files[0] && onFotoSel(e.target.files[0])} />
        </label>
        <div className="ficha-meta">
          <h2>{titulo}</h2>
          <p>{isNew ? 'Ficha nueva · sin guardar' : `ID ${estudianteId}`}</p>
          {fotoSrc
            ? <button onClick={quitarFoto} style={{background:'none',border:'none',color:'var(--danger)',fontSize:11,cursor:'pointer',padding:0,marginTop:2}}>✕ Quitar foto</button>
            : <span className="foto-hint">📷 Tocá el círculo para agregar foto</span>}
        </div>
      </div>

      {!isNew && puede('ver_legajo_personal') && (
        <div className="ficha-tab-bar">
          <button className={`ficha-tab-btn ${tab==='datos'?'active':''}`} onClick={()=>setTab('datos')}>📋 Datos</button>
          <button className={`ficha-tab-btn ${tab==='legajo'?'active':''}`} onClick={()=>setTab('legajo')}>📁 Legajo personal</button>
        </div>
      )}

      {(isNew || tab === 'datos') && <>
      {isDirty && <div className="dirty-bar"><span>●</span> Cambios sin guardar</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {/* ── Identidad ── */}
      <div className="ficha-section">
        <div className="ficha-section-title">🪪 Identidad</div>
        <div className="form-grid">
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Nombre *</label>
            <input className="form-control" value={form.nombre}
              onChange={e => set('nombre', e.target.value)} placeholder="Juan" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Apellido *</label>
            <input className="form-control" value={form.apellido}
              onChange={e => set('apellido', e.target.value)} placeholder="García" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">DNI *</label>
            <input className="form-control" value={form.dni} inputMode="numeric"
              onChange={e => set('dni', e.target.value)} placeholder="12345678" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">CUIT</label>
            <input className="form-control" value={form.cuit}
              onChange={e => set('cuit', e.target.value)} placeholder="20-12345678-9" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Fecha de nacimiento</label>
            <input className="form-control" type="date" value={form.fecha_nacimiento}
              onChange={e => set('fecha_nacimiento', e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Dirección</label>
            <input className="form-control" value={form.direccion}
              onChange={e => set('direccion', e.target.value)} placeholder="Av. Ejemplo 1234, Ciudad" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Teléfono</label>
            <input className="form-control" type="tel" value={form.telefono}
              onChange={e => set('telefono', e.target.value)} placeholder="11 2233-4455" />
          </div>
        </div>
      </div>

      {/* ── Familia / Tutor ── */}
      <div className="ficha-section">
        <div className="ficha-section-title">👨‍👩‍👧 Familia / Tutor</div>
        <div className="form-grid">
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Nombre del tutor</label>
            <input className="form-control" value={form.tutor_nombre}
              onChange={e => set('tutor_nombre', e.target.value)} placeholder="María García" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">DNI del tutor</label>
            <input className="form-control" value={form.tutor_dni} inputMode="numeric"
              onChange={e => set('tutor_dni', e.target.value)} placeholder="23456789" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Teléfono del tutor</label>
            <input className="form-control" type="tel" value={form.tutor_telefono}
              onChange={e => set('tutor_telefono', e.target.value)} placeholder="11 5566-7788" />
          </div>
        </div>
      </div>

      {/* ── Inscripciones ── */}
      <div className="ficha-section">
        <div className="ficha-section-title">🎵 Inscripciones (nivel · instrumento)</div>
        {isNew
          ? <p style={{color:'var(--text2)',fontSize:13,margin:0}}>Guardá la ficha primero para agregar inscripciones.</p>
          : <InscripcionesPanel estudianteId={estudianteId} user={user} />
        }
      </div>

      {/* ── Autorizaciones ── */}
      <div className="ficha-section ficha-autorizaciones">
        <div className="ficha-section-title">📋 Autorizaciones</div>
        <div className="auth-list">
          {AUTORIZACIONES.map(({ campo, label, sub }) => (
            <div key={campo} className={`auth-row ${form[campo] ? 'on' : ''}`}
              onClick={() => set(campo, !form[campo])}>
              <div className="auth-check">{form[campo] ? '✓' : ''}</div>
              <div>
                <div className="auth-label">{label}</div>
                <div className="auth-sub">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Historial de asistencia (solo al editar) ── */}
      {!isNew && (
        <div className="ficha-section">
          <div className="ficha-section-title">📊 Historial de asistencia</div>
          <CalendarioAsistencia estudianteId={estudianteId} />
        </div>
      )}

      {/* ── Footer ── */}
      <div className="ficha-footer">
        <button className="btn btn-secondary btn-auto" onClick={handleClose}>Cancelar</button>
        {(isNew ? puede('crear_estudiantes') : puede('editar_estudiantes')) && (<>
          {isNew && (
            <button className="btn btn-secondary btn-auto" onClick={() => guardar('otro')} disabled={saving}>
              {saving ? 'Guardando…' : '💾 Guardar y cargar otro'}
            </button>
          )}
          {isNew && onCreado && (
            <button className="btn btn-secondary btn-auto" onClick={() => guardar('editar')} disabled={saving}>
              {saving ? 'Guardando…' : '💾 Guardar y agregar inscripciones'}
            </button>
          )}
          <button className="btn btn-primary btn-auto" onClick={() => guardar('cerrar')} disabled={saving}>
            {saving ? 'Guardando…' : '💾 Guardar y cerrar'}
          </button>
        </>)}
      </div>
      </>}

      {!isNew && tab === 'legajo' && puede('ver_legajo_personal') && (
        <LegajoTab estudianteId={estudianteId} user={user} />
      )}
    </div>
  );
}

// ── ESTUDIANTES (contenedor) ──────────────────────────────────────────────────────
function Estudiantes({ user, deepLink, onVerReporteNivel }) {
  const [view,        setView]       = useState('list');
  const [fichaId,     setFichaId]    = useState(null);
  const [fichaKey,    setFichaKey]   = useState(0);
  const [fichaTabIni, setFichaTabIni]= useState('datos');

  const abrirNuevo  = () => { setFichaId(null); setFichaTabIni('datos'); setFichaKey(k=>k+1); setView('ficha'); };
  const abrirEditar = (id) => { setFichaId(id); setFichaTabIni('datos'); setFichaKey(k=>k+1); setView('ficha'); };
  const cargarOtro  = () => { setFichaId(null); setFichaKey(k=>k+1); };
  const onCreado    = (id) => { setFichaId(id); setFichaKey(k=>k+1); }; // queda en edit mode

  // Llegada desde la campanita de notificaciones (mención en legajo o asistencia)
  useEffect(() => {
    if (deepLink?.tipo === 'legajo' || deepLink?.tipo === 'asistencia') {
      setFichaId(deepLink.id);
      setFichaTabIni(deepLink.tipo === 'legajo' ? 'legajo' : 'datos');
      setFichaKey(k=>k+1);
      setView('ficha');
    }
  }, [deepLink]);

  if (view === 'ficha') {
    return (
      <Ficha key={fichaKey} user={user}
        estudianteId={fichaId}
        initialTab={fichaTabIni}
        onClose={() => setView('list')}
        onGuardarYCargarOtro={cargarOtro}
        onCreado={onCreado}
      />
    );
  }
  return <ListaEstudiantes user={user} onNuevo={abrirNuevo} onEditar={abrirEditar} onVerReporteNivel={onVerReporteNivel} />;
}
