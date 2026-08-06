// ── INVENTARIO ───────────────────────────────────────────────────────────────────
const INV_ESTADOS = {
  disponible:'Disponible', en_uso:'En uso', a_reparar:'A reparar', a_prestamo:'A préstamo',
  en_reparacion:'En reparación', baja:'Baja',
};
// Instrumentos que usan correa (guitarras y bajo) — el resto no muestra el checkbox.
const INV_CON_CORREA = ['Guitarra Criolla','Guitarra eléctrica','Bajo'];

const COLS_CSV_INV = ['Marca','Tipo de instrumento','Estado','Número de serie','Tiene funda','Tiene correa','Fecha de alta','Observaciones'];

function descargarPlantillaInventario() {
  const ej1 = ['Gracia','Guitarra Criolla','Disponible','GC-001','sí','sí','01/03/2024','Cuerdas nuevas'];
  const ej2 = ['Yamaha','Piano','En uso','','no','no','',''];
  const csv = [COLS_CSV_INV,ej1,ej2].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download = 'EPM_plantilla_inventario.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function validarFilaInventarioCSV(row, instrumentos, idx) {
  const errors = [];
  const nombre = row['Marca']?.trim() || '';
  if (!nombre) errors.push('Marca requerida');

  const tipoStr = row['Tipo de instrumento']?.trim() || '';
  let instrumento_id = null, instrumento_nombre = '';
  if (tipoStr) {
    const instr = (instrumentos||[]).find(x => x.nombre.toLowerCase() === tipoStr.toLowerCase());
    if (!instr) errors.push(`Tipo de instrumento "${tipoStr}" no encontrado`);
    else { instrumento_id = Number(instr.id); instrumento_nombre = instr.nombre; }
  }

  const estadoStr = row['Estado']?.trim() || '';
  let estado = 'disponible';
  if (estadoStr) {
    const found = Object.entries(INV_ESTADOS).find(([k,v]) => v.toLowerCase()===estadoStr.toLowerCase() || k===estadoStr.toLowerCase());
    if (!found) errors.push(`Estado "${estadoStr}" no reconocido`);
    else estado = found[0];
  }

  let fecha_alta = '';
  if (row['Fecha de alta']?.trim()) {
    const f = parseFecha(row['Fecha de alta']);
    if (f === null) errors.push('Fecha de alta inválida (usar DD/MM/AAAA o AAAA-MM-DD)');
    else fecha_alta = f;
  }

  return {
    idx: idx+1, ok: errors.length===0, errors,
    nombre, instrumento_id, instrumento_nombre, estado,
    numero_serie:  row['Número de serie']?.trim() || '',
    tiene_funda:   parseBool(row['Tiene funda']),
    tiene_correa:  parseBool(row['Tiene correa']),
    fecha_alta,
    observaciones: row['Observaciones']?.trim() || '',
  };
}

function ModalImportInventario({ instrumentos, onImportado, onClose }) {
  const [fase,      setFase]      = useState('upload'); // upload | preview | done
  const [filas,     setFilas]     = useState([]);
  const [validas,   setValidas]   = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [saving,    setSaving]    = useState(false);
  const [resultado, setResultado] = useState(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [parseErr,  setParseErr]  = useState('');

  const procesar = (file) => {
    if (!file) return;
    if (!file.name.match(/\.csv$/i)) { setParseErr('El archivo debe ser .csv'); return; }
    setParseErr('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseCsv(ev.target.result);
        if (!rows.length) { setParseErr('El archivo no tiene filas de datos.'); return; }
        const proc = rows.map((r,i) => validarFilaInventarioCSV(r, instrumentos, i));
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
    let importados = 0;
    const erroresImport = [];
    for (const f of validas) {
      try {
        await apiFetch('/api/inventario', { method:'POST', body:{
          nombre: f.nombre, instrumento_id: f.instrumento_id, estado: f.estado,
          numero_serie: f.numero_serie||null, tiene_funda: f.tiene_funda, tiene_correa: f.tiene_correa,
          fecha_alta: f.fecha_alta||null, observaciones: f.observaciones||null,
        }});
        importados++;
      } catch(e) { erroresImport.push({ nombre: f.nombre, error: e.message }); }
    }
    setResultado({ importados, errores: erroresImport });
    setFase('done'); onImportado();
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:600}}>
        <div className="modal-header">
          <span className="modal-title">📥 Importar inventario desde CSV</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {fase==='upload' && (
          <>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:14,lineHeight:1.6}}>
              Subí un CSV con los ítems del inventario. El tipo de instrumento debe coincidir
              exactamente con uno de los existentes en el sistema.
            </p>
            <button className="btn btn-secondary btn-auto" style={{marginBottom:14}}
              onClick={descargarPlantillaInventario}>
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
                ✅ <strong>{validas.length} ítem(s)</strong> listos para importar.
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
                  <tr><th>#</th><th>Marca</th><th>Tipo</th><th>Estado</th><th>Estado import.</th></tr>
                </thead>
                <tbody>
                  {filas.map(f=>(
                    <tr key={f.idx} className={f.ok?'pr-ok':'pr-err'}>
                      <td>{f.idx}</td>
                      <td>{f.nombre}</td>
                      <td>{f.instrumento_nombre||'—'}</td>
                      <td>{INV_ESTADOS[f.estado]||f.estado}</td>
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
                {saving ? 'Importando…' : `💾 Importar ${validas.length} ítem(s)`}
              </button>
            </div>
          </>
        )}

        {fase==='done' && resultado && (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:56,marginBottom:8}}>✅</div>
            <h3 style={{fontSize:20,fontWeight:800,marginBottom:8}}>¡Importación completada!</h3>
            <p style={{color:'var(--text2)'}}>{resultado.importados} ítem(s) importados exitosamente.</p>
            {resultado.errores?.length>0 && (
              <div className="alert alert-warning" style={{marginTop:12,textAlign:'left'}}>
                {resultado.errores.length} fila(s) no se importaron.
                <ul style={{marginTop:6,paddingLeft:16,fontSize:12}}>
                  {resultado.errores.map((e,i)=><li key={i}>{e.nombre}: {e.error}</li>)}
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

function Inventario({ user }) {
  const puede = (p) => user.permisos?.includes(p);
  const [lista,       setLista]       = useState([]);
  const [instrumentos,setInstrumentos]= useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [equipo,       setEquipo]     = useState([]);
  const [filtroTipo,  setFiltroTipo]  = useState('');
  const [filtroEst,   setFiltroEst]   = useState('');
  const [busqueda,    setBusqueda]    = useState('');
  const [cargando,    setCargando]    = useState(true);
  const [modal,       setModal]       = useState(null); // null | 'nuevo' | 'importar' | item
  const [error,       setError]       = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [inv, inst, ests, equi] = await Promise.all([
        apiFetch('/api/inventario'),
        apiFetch('/api/instrumentos'),
        apiFetch('/api/estudiantes').catch(()=>[]),
        apiFetch('/api/usuarios/mencionables').catch(()=>[]),
      ]);
      setLista(inv); setInstrumentos(inst); setEstudiantes(ests); setEquipo(equi);
    } catch(e) { setError(e.message); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const listaFiltrada = lista.filter(it => {
    if (filtroTipo && String(it.instrumento_id) !== filtroTipo) return false;
    if (filtroEst  && it.estado !== filtroEst) return false;
    if (busqueda   && !`${it.nombre} ${it.tipo_instrumento_nombre||''}`.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const exportarCSV = () => {
    const cols = ['Marca','Tipo','Estado','Número de serie','Funda','Correa','Asignado a','Observaciones','Fecha de alta'];
    const rows = listaFiltrada.map(it => [
      it.nombre, it.tipo_instrumento_nombre||'', INV_ESTADOS[it.estado]||it.estado,
      it.numero_serie||'', it.tiene_funda?'sí':'no', it.tiene_correa?'sí':'no',
      it.asignado_nombre||'', it.observaciones||'', it.fecha_alta||'',
    ]);
    const csv = [cols,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'}));
    a.download = 'EPM_inventario.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{fontSize:18,fontWeight:800}}>🎻 Inventario de instrumentos</h2>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button className="btn btn-secondary btn-auto" style={{fontSize:12}} onClick={exportarCSV}>⬇ CSV</button>
          {puede('editar_inventario') && (
            <>
              <button className="btn btn-secondary btn-auto" style={{fontSize:12}} onClick={() => setModal('importar')}>📥 Importar</button>
              <button className="btn btn-primary btn-auto" onClick={() => setModal('nuevo')}>+ Agregar</button>
            </>
          )}
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        <input className="form-control" style={{flex:1,minWidth:140}}
          placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="form-control" style={{width:'auto'}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {instrumentos.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <select className="form-control" style={{width:'auto'}} value={filtroEst} onChange={e=>setFiltroEst(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(INV_ESTADOS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {cargando ? <div className="spinner"><div className="spin"/></div>
        : listaFiltrada.length === 0
        ? <div className="empty-state"><div className="empty-state-icon">🎻</div><div>Sin ítems en el inventario</div></div>
        : listaFiltrada.map(it => (
            <div key={it.id} className="list-row" style={{cursor: puede('editar_inventario') ? 'pointer' : 'default'}}
              onClick={() => puede('editar_inventario') && setModal(it)}>
              <div style={{flex:1,minWidth:0}}>
                <div className="list-row-label">{it.nombre}</div>
                <div style={{fontSize:12,color:'var(--text2)',marginTop:2,display:'flex',flexWrap:'wrap',gap:8}}>
                  {it.tipo_instrumento_nombre && <span>{it.tipo_instrumento_nombre}</span>}
                  {it.numero_serie && <span>N/S: {it.numero_serie}</span>}
                  {!!it.tiene_funda && <span>👝 Funda</span>}
                  {!!it.tiene_correa && <span>🎸 Correa</span>}
                  {it.asignado_nombre && <span>📎 {it.asignado_nombre}</span>}
                </div>
              </div>
              <span className={`inv-badge inv-estado-${it.estado}`}>{INV_ESTADOS[it.estado]||it.estado}</span>
            </div>
          ))
      }
      {modal === 'importar' && (
        <ModalImportInventario instrumentos={instrumentos}
          onImportado={cargar}
          onClose={() => setModal(null)}
        />
      )}
      {modal !== null && modal !== 'importar' && (
        <ModalInventario item={modal === 'nuevo' ? null : modal}
          instrumentos={instrumentos} estudiantes={estudiantes} equipo={equipo}
          onClose={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
    </div>
  );
}

function ModalInventario({ item, instrumentos, estudiantes, equipo, onClose, onGuardado }) {
  const [form, setForm] = useState({
    nombre:        item?.nombre || '',
    instrumento_id: item?.instrumento_id || '',
    estado:        item?.estado || 'disponible',
    numero_serie:  item?.numero_serie || '',
    tiene_funda:   !!item?.tiene_funda,
    tiene_correa:  !!item?.tiene_correa,
    asignado_tipo: item?.asignado_tipo || '',
    asignado_id:   item?.asignado_id || '',
    reparacion_fecha_envio:   item?.reparacion_fecha_envio || new Date().toISOString().slice(0,10),
    reparacion_lugar:         item?.reparacion_lugar || '',
    reparacion_telefono:      item?.reparacion_telefono || '',
    reparacion_observaciones: item?.reparacion_observaciones || '',
    observaciones: item?.observaciones || '',
    fecha_alta:    item?.fecha_alta || new Date().toISOString().slice(0,10),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const instrumentoNombre = instrumentos.find(i => String(i.id)===String(form.instrumento_id))?.nombre || '';
  const muestraCorrea = INV_CON_CORREA.includes(instrumentoNombre);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const method = item?.id ? 'PUT' : 'POST';
      const url    = item?.id ? `/api/inventario/${item.id}` : '/api/inventario';
      await apiFetch(url, { method, body: form });
      onGuardado();
    } catch(err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const eliminar = async () => {
    if (!confirm('¿Eliminar este ítem del inventario?')) return;
    try { await apiFetch(`/api/inventario/${item.id}`, { method:'DELETE' }); onGuardado(); }
    catch(err) { setError(err.message); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{item?.id ? 'Editar ítem' : 'Nuevo ítem de inventario'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Marca *</label>
            <input className="form-control" value={form.nombre} onChange={e=>set('nombre',e.target.value)} required
              placeholder='Ej: "Gracia", "Yamaha", "Fender"' />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Tipo de instrumento</label>
              <select className="form-control" value={form.instrumento_id} onChange={e=>set('instrumento_id',e.target.value||null)}>
                <option value="">— Sin tipo —</option>
                {instrumentos.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-control" value={form.estado} onChange={e=>set('estado',e.target.value)}>
                {Object.entries(INV_ESTADOS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Número de serie</label>
              <input className="form-control" value={form.numero_serie} onChange={e=>set('numero_serie',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de alta</label>
              <input className="form-control" type="date" value={form.fecha_alta} onChange={e=>set('fecha_alta',e.target.value)} />
            </div>
            <div className="form-group" style={{display:'flex',alignItems:'center',gap:8}}>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                <input type="checkbox" checked={form.tiene_funda} onChange={e=>set('tiene_funda',e.target.checked)} />
                Tiene funda
              </label>
            </div>
            {muestraCorrea && (
              <div className="form-group" style={{display:'flex',alignItems:'center',gap:8}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  <input type="checkbox" checked={form.tiene_correa} onChange={e=>set('tiene_correa',e.target.checked)} />
                  Tiene correa
                </label>
              </div>
            )}

            {form.estado === 'a_prestamo' && (
              <div className="form-group col-full" style={{background:'var(--bg3)',borderRadius:8,padding:10}}>
                <label className="form-label">Prestado a</label>
                <select className="form-control" value={form.asignado_tipo && form.asignado_id ? `${form.asignado_tipo}:${form.asignado_id}` : ''}
                  onChange={e=>{
                    const [tipo,id] = e.target.value.split(':');
                    set('asignado_tipo', tipo||''); set('asignado_id', id||'');
                  }}>
                  <option value="">— Seleccionar persona —</option>
                  {estudiantes.length>0 && (
                    <optgroup label="Estudiantes">
                      {estudiantes.map(e=><option key={`e${e.id}`} value={`estudiante:${e.id}`}>{e.apellido}, {e.nombre}</option>)}
                    </optgroup>
                  )}
                  {equipo.length>0 && (
                    <optgroup label="Equipo">
                      {equipo.map(u=><option key={`u${u.id}`} value={`usuario:${u.id}`}>{u.apellido?`${u.apellido}, `:''}{u.nombre} ({u.rol_nombre})</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {form.estado === 'a_reparar' && (
              <div className="form-group col-full" style={{background:'var(--bg3)',borderRadius:8,padding:10}}>
                <label className="form-label">Descripción del daño</label>
                <textarea className="form-control" rows={2} value={form.reparacion_observaciones}
                  onChange={e=>set('reparacion_observaciones',e.target.value)}
                  placeholder="¿Qué le pasa al instrumento?" />
              </div>
            )}

            {form.estado === 'en_reparacion' && (
              <div className="form-group col-full" style={{background:'var(--bg3)',borderRadius:8,padding:10,display:'grid',gap:10}}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Fecha de envío a reparación</label>
                    <input className="form-control" type="date" value={form.reparacion_fecha_envio}
                      onChange={e=>set('reparacion_fecha_envio',e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lugar / taller</label>
                    <input className="form-control" value={form.reparacion_lugar}
                      onChange={e=>set('reparacion_lugar',e.target.value)} placeholder='Ej: "Luthería Don Carlos"' />
                  </div>
                  <div className="form-group col-full">
                    <label className="form-label">Teléfono de contacto</label>
                    <input className="form-control" value={form.reparacion_telefono}
                      onChange={e=>set('reparacion_telefono',e.target.value)} />
                  </div>
                  <div className="form-group col-full">
                    <label className="form-label">Observaciones de la reparación</label>
                    <textarea className="form-control" rows={2} value={form.reparacion_observaciones}
                      onChange={e=>set('reparacion_observaciones',e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            <div className="form-group col-full">
              <label className="form-label">Observaciones</label>
              <textarea className="form-control" rows={2} value={form.observaciones} onChange={e=>set('observaciones',e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            {item?.id && <button type="button" className="btn btn-danger btn-auto" onClick={eliminar}>🗑</button>}
            <button type="button" className="btn btn-secondary btn-auto" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
