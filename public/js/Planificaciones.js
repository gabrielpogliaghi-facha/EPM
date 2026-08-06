// ── GESTIÓN PERÍODOS DE PLANIFICACIÓN ───────────────────────────────────────────
function GestionPeriodosPlani() {
  const [periodos,setPeriodos]= useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [target,  setTarget]  = useState(null);
  const [form,    setForm]    = useState({ nombre:'', fecha_inicio:'', fecha_fin:'' });
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState('');
  const [toast,   setToast]   = useState({ type:'', text:'' });

  const showToast=(t,m)=>{ setToast({type:t,text:m}); setTimeout(()=>setToast({type:'',text:''}),4000); };
  const cargar = async () => {
    setLoading(true);
    try { setPeriodos(await apiFetch('/api/periodos/planificacion')); }
    catch(e) { showToast('error', e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const abrirNuevo  = ()  => { setTarget(null); setForm({nombre:'',fecha_inicio:'',fecha_fin:''}); setFormErr(''); setModal('form'); };
  const abrirEditar = p   => { setTarget(p); setForm({nombre:p.nombre,fecha_inicio:p.fecha_inicio,fecha_fin:p.fecha_fin}); setFormErr(''); setModal('form'); };
  const cerrar = () => setModal(null);

  const guardar = async () => {
    if (!form.nombre.trim()||!form.fecha_inicio||!form.fecha_fin) { setFormErr('Todos los campos son requeridos.'); return; }
    if (form.fecha_inicio>=form.fecha_fin) { setFormErr('La fecha de inicio debe ser anterior al fin.'); return; }
    setSaving(true); setFormErr('');
    try {
      if (!target) {
        await apiFetch('/api/periodos/planificacion', { method:'POST', body:form });
        showToast('success', `Período "${form.nombre}" creado.`);
      } else {
        await apiFetch(`/api/periodos/planificacion/${target.id}`, { method:'PUT', body:form });
        showToast('success', `Período "${form.nombre}" actualizado.`);
      }
      cerrar(); cargar();
    } catch(e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/periodos/planificacion/${target.id}`, { method:'DELETE' });
      showToast('success', 'Período eliminado.'); cerrar(); cargar();
    } catch(e) { showToast('error', e.message); cerrar(); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {toast.text && <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}} onClick={()=>setToast({type:'',text:''})}>{toast.text}</div>}
      <div className="card">
        <div className="section-header">
          <span className="card-title" style={{marginBottom:0}}>📅 Períodos de Planificación</span>
          <button className="btn btn-primary btn-auto" onClick={abrirNuevo}>＋ Nuevo período</button>
        </div>
        {loading ? <div className="spinner"><div className="spin"/></div>
        : periodos.length===0 ? <div className="empty-state"><div className="empty-state-icon">📅</div><p>No hay períodos todavía. Creá uno para empezar.</p></div>
        : periodos.map(p => (
          <div key={p.id} className="list-row">
            <div style={{flex:1}}>
              <div className="list-row-label">{p.nombre}</div>
              <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{p.fecha_inicio} → {p.fecha_fin}</div>
            </div>
            <div className="row-actions">
              <button className="btn-icon" onClick={()=>abrirEditar(p)}>✏️</button>
              <button className="btn-icon btn-icon-danger" onClick={()=>{setTarget(p);setModal('delete');}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      {modal==='form' && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&cerrar()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{!target?'Nuevo período':'Editar período'}</span>
              <button className="modal-close" onClick={cerrar}>✕</button>
            </div>
            {formErr && <div className="alert alert-error">{formErr}</div>}
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={form.nombre} autoFocus onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: 1er Cuatrimestre" />
            </div>
            <div className="form-grid">
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Fecha de inicio *</label>
                <input className="form-control" type="date" value={form.fecha_inicio} onChange={e=>setForm(f=>({...f,fecha_inicio:e.target.value}))} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Fecha de fin *</label>
                <input className="form-control" type="date" value={form.fecha_fin} onChange={e=>setForm(f=>({...f,fecha_fin:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={guardar} disabled={saving}>
                {saving?'Guardando…':!target?'Crear período':'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modal==='delete' && target && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&cerrar()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Eliminar período</span>
              <button className="modal-close" onClick={cerrar}>✕</button>
            </div>
            <p style={{marginBottom:12}}>Período: <strong>{target.nombre}</strong></p>
            <div className="alert alert-warning">Solo se puede eliminar si no tiene planificaciones asociadas.</div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-danger btn-auto" onClick={eliminar} disabled={saving}>{saving?'Eliminando…':'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LISTA DE PLANIFICACIONES ─────────────────────────────────────────────────────
function ListaPlanifs({ user, onSelect }) {
  const [periodos,  setPeriodos]  = useState([]);
  const [cursos,    setCursos]    = useState([]);
  const [planifs,   setPlanifs]   = useState([]);
  const [periodoId, setPeriodoId] = useState('');
  const [cursoId,   setCursoId]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [modalNueva,setModalNueva]= useState(false);
  const [nuevaForm, setNuevaForm] = useState({ curso_id:'', periodo_id:'', titulo:'' });
  const [saving,    setSaving]    = useState(false);
  const [delPlan,   setDelPlan]   = useState(null);
  const [toast,     setToast]     = useState({ type:'', text:'' });

  const puede = p => user.permisos?.includes(p);
  const showToast=(t,m)=>{ setToast({type:t,text:m}); setTimeout(()=>setToast({type:'',text:''}),4000); };

  useEffect(() => {
    Promise.all([apiFetch('/api/periodos/planificacion'), apiFetch('/api/cursos/mis-cursos')])
      .then(([ps,cs]) => {
        setPeriodos(ps); setCursos(cs);
        if (ps.length>0) setPeriodoId(String(ps[0].id));
      }).catch(() => {});
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (periodoId) p.set('periodo_id', periodoId);
      if (cursoId)   p.set('curso_id', cursoId);
      setPlanifs(await apiFetch(`/api/planificaciones?${p}`));
    } catch(e) { showToast('error', e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, [periodoId, cursoId]);

  const crearPlan = async () => {
    if (!nuevaForm.curso_id) return;
    setSaving(true);
    try {
      const r = await apiFetch('/api/planificaciones', { method:'POST', body:{ ...nuevaForm, periodo_id: nuevaForm.periodo_id||null } });
      showToast('success', 'Planificación creada.');
      setModalNueva(false); setNuevaForm({curso_id:'',periodo_id:'',titulo:''});
      onSelect(r.id);
    } catch(e) { showToast('error', e.message); }
    finally { setSaving(false); }
  };

  const eliminarPlan = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/planificaciones/${delPlan.id}`, { method:'DELETE' });
      showToast('success', 'Planificación eliminada.'); setDelPlan(null); cargar();
    } catch(e) { showToast('error', e.message); setDelPlan(null); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {toast.text && <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}} onClick={()=>setToast({type:'',text:''})}>{toast.text}</div>}
      <div className="card" style={{marginBottom:14}}>
        <div className="section-header" style={{marginBottom:12}}>
          <span className="card-title" style={{marginBottom:0}}>📝 Planificaciones</span>
          {puede('editar_planificaciones') && (
            <button className="btn btn-primary btn-auto" onClick={()=>setModalNueva(true)}>＋ Nueva</button>
          )}
        </div>
        <div className="form-grid">
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Período</label>
            <select className="form-control" value={periodoId} onChange={e=>setPeriodoId(e.target.value)}>
              <option value="">Todos</option>
              {periodos.map(p=><option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Curso</label>
            <select className="form-control" value={cursoId} onChange={e=>setCursoId(e.target.value)}>
              <option value="">Todos</option>
              {cursos.map(c=><option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
        {periodos.length===0 && (
          <p style={{fontSize:13,color:'var(--text2)',marginTop:10}}>
            No hay períodos. {puede('editar_planificaciones')&&'Creá uno en la pestaña "Períodos".'}
          </p>
        )}
      </div>

      {loading ? <div className="spinner"><div className="spin"/></div>
      : planifs.length===0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <p>{periodos.length===0 ? 'Primero creá un período de planificación.' : 'No hay planificaciones para estos filtros.'}</p>
        </div>
      ) : planifs.map(p => (
        <div key={p.id} className="plan-item" onClick={()=>onSelect(p.id)}>
          <div className="plan-item-hd">
            <div style={{flex:1,minWidth:0}}>
              <div className="plan-titulo">{p.titulo||'Planificación sin título'}</div>
              <div className="plan-meta">
                📚 {p.curso_nombre} · 👤 {p.docente_nombre}
                {p.periodo_nombre&&<> · <span className="periodo-tag">{p.periodo_nombre}</span></>}
                · {p.n_contenidos} contenido(s)
              </div>
            </div>
            {puede('editar_planificaciones') && (
              <button className="btn-icon btn-icon-danger" style={{flexShrink:0}}
                onClick={e=>{e.stopPropagation();setDelPlan(p);}}>🗑️</button>
            )}
          </div>
        </div>
      ))}

      {modalNueva && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalNueva(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nueva planificación</span>
              <button className="modal-close" onClick={()=>setModalNueva(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Curso *</label>
              <select className="form-control" value={nuevaForm.curso_id} onChange={e=>setNuevaForm(f=>({...f,curso_id:e.target.value}))}>
                <option value="">Seleccionar…</option>
                {cursos.map(c=><option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Período</label>
              <select className="form-control" value={nuevaForm.periodo_id} onChange={e=>setNuevaForm(f=>({...f,periodo_id:e.target.value}))}>
                <option value="">Sin período</option>
                {periodos.map(p=><option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Título (opcional)</label>
              <input className="form-control" value={nuevaForm.titulo} onChange={e=>setNuevaForm(f=>({...f,titulo:e.target.value}))} placeholder="Ej: Planificación anual" />
            </div>
            <p style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>
              ℹ️ UNSAM futuro: se podrá asociar a una materia.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={()=>setModalNueva(false)}>Cancelar</button>
              <button className="btn btn-primary btn-auto" onClick={crearPlan} disabled={saving||!nuevaForm.curso_id}>
                {saving?'Creando…':'Crear planificación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {delPlan && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDelPlan(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Eliminar planificación</span>
              <button className="modal-close" onClick={()=>setDelPlan(null)}>✕</button>
            </div>
            <p style={{marginBottom:12}}>{delPlan.titulo||'Planificación'} — {delPlan.curso_nombre}</p>
            <div className="alert alert-warning">Se eliminarán la planificación y sus {delPlan.n_contenidos} contenido(s) permanentemente.</div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={()=>setDelPlan(null)}>Cancelar</button>
              <button className="btn btn-danger btn-auto" onClick={eliminarPlan} disabled={saving}>{saving?'Eliminando…':'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FICHA DE PLANIFICACIÓN (con contenidos) ──────────────────────────────────────
function FichaPlanif({ user, planId, onBack }) {
  const [plan,       setPlan]      = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [editingCid, setEditingCid]= useState(null);
  const [editForm,   setEditForm]  = useState({ titulo:'', descripcion:'' });
  const [showAdd,    setShowAdd]   = useState(false);
  const [addForm,    setAddForm]   = useState({ titulo:'', descripcion:'' });
  const [saving,     setSaving]    = useState(false);
  const [delCid,     setDelCid]    = useState(null);
  const [toast,      setToast]     = useState({ type:'', text:'' });

  const puede = p => user.permisos?.includes(p);
  const showToast=(t,m)=>{ setToast({type:t,text:m}); setTimeout(()=>setToast({type:'',text:''}),4000); };

  const cargar = async () => {
    setLoading(true);
    try { setPlan(await apiFetch(`/api/planificaciones/${planId}`)); }
    catch(e) { showToast('error', e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, [planId]);

  const puedeEditar = puede('editar_planificaciones') &&
    plan && (plan.docente_id === user.id || user.permisos?.includes('administrar_cursos'));

  // Reordenar ↑/↓
  const mover = async (idx, dir) => {
    const cont = [...plan.contenidos];
    const other = idx + dir;
    if (other < 0 || other >= cont.length) return;
    [cont[idx], cont[other]] = [cont[other], cont[idx]];
    setPlan(p => ({ ...p, contenidos: cont }));
    try {
      await apiFetch(`/api/planificaciones/${planId}/contenidos/orden`, {
        method: 'PUT', body: { items: cont.map((c, i) => ({ id: c.id, orden: i })) }
      });
    } catch(e) { showToast('error', e.message); cargar(); }
  };

  // Editar contenido
  const abrirEdit = c => { setEditingCid(c.id); setEditForm({ titulo:c.titulo, descripcion:c.descripcion||'' }); };
  const guardarEdit = async cid => {
    if (!editForm.titulo.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/planificaciones/${planId}/contenidos/${cid}`, { method:'PUT', body:editForm });
      setPlan(p => ({ ...p, contenidos: p.contenidos.map(c => c.id===cid ? {...c,...editForm} : c) }));
      setEditingCid(null);
    } catch(e) { showToast('error', e.message); }
    finally { setSaving(false); }
  };

  // Agregar contenido
  const agregar = async () => {
    if (!addForm.titulo.trim()) return;
    setSaving(true);
    try {
      const nuevo = await apiFetch(`/api/planificaciones/${planId}/contenidos`, { method:'POST', body:addForm });
      setPlan(p => ({ ...p, contenidos: [...p.contenidos, nuevo] }));
      setAddForm({ titulo:'', descripcion:'' }); setShowAdd(false);
    } catch(e) { showToast('error', e.message); }
    finally { setSaving(false); }
  };

  // Eliminar contenido
  const eliminarCont = async cid => {
    setSaving(true);
    try {
      await apiFetch(`/api/planificaciones/${planId}/contenidos/${cid}`, { method:'DELETE' });
      setPlan(p => ({ ...p, contenidos: p.contenidos.filter(c => c.id!==cid) }));
      setDelCid(null);
    } catch(e) { showToast('error', e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="spinner"><div className="spin"/></div>;
  if (!plan)   return <div className="empty-state"><div className="empty-state-icon">📝</div><p>Planificación no encontrada.</p></div>;

  return (
    <div>
      {toast.text && <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}} onClick={()=>setToast({type:'',text:''})}>{toast.text}</div>}

      {/* Header */}
      <div className="plan-detail-hd">
        <button className="btn btn-secondary btn-auto" style={{flexShrink:0}} onClick={onBack}>← Volver</button>
        <div style={{flex:1,minWidth:0}}>
          <div className="plan-detail-title">{plan.titulo||`Planificación — ${plan.curso_nombre}`}</div>
          <div className="plan-detail-meta">
            📚 {plan.curso_nombre} · 👤 {plan.docente_nombre}
            {plan.periodo_nombre && <> · <span className="periodo-tag">{plan.periodo_nombre}</span></>}
          </div>
        </div>
      </div>

      {/* Descripción */}
      {plan.descripcion && (
        <div style={{fontSize:14,color:'var(--text2)',lineHeight:1.6,marginBottom:16}}>{plan.descripcion}</div>
      )}

      {/* Contenidos */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:14}}>Contenidos</span>
        <span style={{fontSize:12,color:'var(--text2)'}}>{plan.contenidos.length} ítem(s)</span>
      </div>

      {plan.contenidos.length===0 && !showAdd && (
        <div className="empty-state" style={{padding:'20px 0'}}>
          <div className="empty-state-icon" style={{fontSize:32}}>📄</div>
          <p>Sin contenidos. {puedeEditar&&'¡Agregá el primero!'}</p>
        </div>
      )}

      {plan.contenidos.map((c, idx) => (
        <div key={c.id} className="contenido-row">
          <div className="contenido-num">{idx+1}</div>

          {editingCid===c.id ? (
            <div style={{flex:1}}>
              <div className="form-group" style={{marginBottom:8}}>
                <input className="form-control" value={editForm.titulo} autoFocus
                  onChange={e=>setEditForm(f=>({...f,titulo:e.target.value}))} placeholder="Título *" />
              </div>
              <div className="form-group" style={{marginBottom:8}}>
                <textarea className="form-control" value={editForm.descripcion} rows={3} style={{resize:'vertical'}}
                  onChange={e=>setEditForm(f=>({...f,descripcion:e.target.value}))} placeholder="Descripción (opcional)" />
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-secondary btn-auto" onClick={()=>setEditingCid(null)}>Cancelar</button>
                <button className="btn btn-primary btn-auto" onClick={()=>guardarEdit(c.id)} disabled={saving||!editForm.titulo.trim()}>
                  {saving?'Guardando…':'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="contenido-body">
              <div className="contenido-titulo">{c.titulo}</div>
              {c.descripcion && <div className="contenido-desc">{c.descripcion}</div>}
            </div>
          )}

          {puedeEditar && editingCid!==c.id && (<>
            <div className="contenido-orden">
              <button className="btn-ord" onClick={()=>mover(idx,-1)} disabled={idx===0} title="Mover arriba">↑</button>
              <button className="btn-ord" onClick={()=>mover(idx,1)} disabled={idx===plan.contenidos.length-1} title="Mover abajo">↓</button>
            </div>
            <div className="row-actions">
              <button className="btn-icon" onClick={()=>abrirEdit(c)}>✏️</button>
              <button className="btn-icon btn-icon-danger" onClick={()=>setDelCid(c)}>🗑️</button>
            </div>
          </>)}
        </div>
      ))}

      {/* Agregar contenido */}
      {puedeEditar && (showAdd ? (
        <div className="plan-add-form">
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Nuevo contenido</div>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-control" value={addForm.titulo} autoFocus
              onChange={e=>setAddForm(f=>({...f,titulo:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&agregar()}
              placeholder="Título del tema o contenido" />
          </div>
          <div className="form-group" style={{marginBottom:10}}>
            <label className="form-label">Descripción (opcional)</label>
            <textarea className="form-control" value={addForm.descripcion} rows={3} style={{resize:'vertical'}}
              onChange={e=>setAddForm(f=>({...f,descripcion:e.target.value}))}
              placeholder="Objetivos, actividades, materiales…" />
          </div>
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-secondary btn-auto" onClick={()=>{setShowAdd(false);setAddForm({titulo:'',descripcion:''});}}>Cancelar</button>
            <button className="btn btn-primary btn-auto" onClick={agregar} disabled={saving||!addForm.titulo.trim()}>
              {saving?'Agregando…':'＋ Agregar'}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary" style={{marginTop:10}} onClick={()=>setShowAdd(true)}>
          ＋ Agregar contenido
        </button>
      ))}

      {/* Confirmar eliminar contenido */}
      {delCid && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDelCid(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Eliminar contenido</span>
              <button className="modal-close" onClick={()=>setDelCid(null)}>✕</button>
            </div>
            <p style={{marginBottom:12}}>"{delCid.titulo}"</p>
            <div className="alert alert-warning">Este contenido se eliminará permanentemente.</div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={()=>setDelCid(null)}>Cancelar</button>
              <button className="btn btn-danger btn-auto" onClick={()=>eliminarCont(delCid.id)} disabled={saving}>
                {saving?'Eliminando…':'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PLANIFICACIONES (contenedor con tabs) ────────────────────────────────────────
function Planificaciones({ user }) {
  const [view,   setView]   = useState('lista');
  const [planId, setPlanId] = useState(null);
  const puede = p => user.permisos?.includes(p);

  return (
    <div>
      {view !== 'ficha' && (
        <div className="curso-tabs" style={{marginBottom:16}}>
          <div className={`curso-tab ${view==='lista'?'active':''}`} onClick={()=>setView('lista')}>📝 Planificaciones</div>
          {puede('editar_planificaciones') && (
            <div className={`curso-tab ${view==='periodos'?'active':''}`} onClick={()=>setView('periodos')}>📅 Períodos</div>
          )}
        </div>
      )}
      {view==='lista'    && <ListaPlanifs   user={user} onSelect={id=>{setPlanId(id);setView('ficha');}} />}
      {view==='periodos' && <GestionPeriodosPlani />}
      {view==='ficha'    && <FichaPlanif    user={user} planId={planId} onBack={()=>{setPlanId(null);setView('lista');}} />}
    </div>
  );
}
