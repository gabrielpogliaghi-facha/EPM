// ── INVENTARIO ───────────────────────────────────────────────────────────────────
const INV_ESTADOS = { disponible:'Disponible', en_uso:'En uso', en_reparacion:'En reparación', baja:'Baja' };

function Inventario({ user }) {
  const puede = (p) => user.permisos?.includes(p);
  const [lista,       setLista]       = useState([]);
  const [instrumentos,setInstrumentos]= useState([]);
  const [filtroTipo,  setFiltroTipo]  = useState('');
  const [filtroEst,   setFiltroEst]   = useState('');
  const [busqueda,    setBusqueda]    = useState('');
  const [cargando,    setCargando]    = useState(true);
  const [modal,       setModal]       = useState(null); // null | 'nuevo' | item
  const [error,       setError]       = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [inv, inst] = await Promise.all([
        apiFetch('/api/inventario'),
        apiFetch('/api/instrumentos'),
      ]);
      setLista(inv); setInstrumentos(inst);
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
    const cols = ['Nombre','Tipo','Estado','Número de serie','Asignado a','Observaciones','Fecha de alta'];
    const rows = listaFiltrada.map(it => [
      it.nombre, it.tipo_instrumento_nombre||'', INV_ESTADOS[it.estado]||it.estado,
      it.numero_serie||'', it.asignado_nombre||'', it.observaciones||'',
      it.fecha_alta||'',
    ]);
    const csv = [cols,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'}));
    a.download = 'EPM_inventario.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{fontSize:18,fontWeight:800}}>🎻 Inventario de instrumentos</h2>
        <div style={{display:'flex',gap:6}}>
          <button className="btn btn-secondary btn-auto" style={{fontSize:12}} onClick={exportarCSV}>⬇ CSV</button>
          {puede('editar_inventario') && (
            <button className="btn btn-primary btn-auto" onClick={() => setModal('nuevo')}>+ Agregar</button>
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
                  {it.asignado_nombre && <span>📎 {it.asignado_nombre}</span>}
                </div>
              </div>
              <span className={`inv-badge inv-estado-${it.estado}`}>{INV_ESTADOS[it.estado]||it.estado}</span>
            </div>
          ))
      }
      {modal !== null && (
        <ModalInventario item={modal === 'nuevo' ? null : modal}
          instrumentos={instrumentos}
          onClose={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
    </div>
  );
}

function ModalInventario({ item, instrumentos, onClose, onGuardado }) {
  const [form, setForm] = useState({
    nombre:        item?.nombre || '',
    instrumento_id: item?.instrumento_id || '',
    estado:        item?.estado || 'disponible',
    numero_serie:  item?.numero_serie || '',
    observaciones: item?.observaciones || '',
    fecha_alta:    item?.fecha_alta || new Date().toISOString().slice(0,10),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

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
            <label className="form-label">Nombre / descripción *</label>
            <input className="form-control" value={form.nombre} onChange={e=>set('nombre',e.target.value)} required
              placeholder='Ej: "Guitarra criolla Gracia Nº3"' />
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
