// ── BACKUP ──────────────────────────────────────────────────────────────────────
function Backup() {
  const [backups,    setBackups]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [creating,   setCreating]   = useState(false);
  const [descargando,setDescargando]= useState(null);
  const [restoring,  setRestoring]  = useState(null); // backup elegido para restaurar
  const [restSaving, setRestSaving] = useState(false);
  const [restDone,   setRestDone]   = useState(false);
  const [toast,      setToast]      = useState({ type:'', text:'' });

  const showToast = (t,m) => { setToast({type:t,text:m}); setTimeout(()=>setToast({type:'',text:''}),6000); };

  const formatSize = bytes => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return Math.round(bytes/1024) + ' KB';
    return (bytes/1024/1024).toFixed(1) + ' MB';
  };

  const formatFecha = s => {
    try {
      return new Date(s + 'T12:00').toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
    } catch { return s; }
  };

  const cargar = async () => {
    setLoading(true);
    try { setBackups(await apiFetch('/api/backup/lista')); }
    catch(e) { showToast('error', e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const hacerBackup = async () => {
    setCreating(true);
    try {
      const r = await apiFetch('/api/backup/crear', { method:'POST' });
      showToast('success', `✅ Backup creado: ${r.filename} (${formatSize(r.size)})`);
      cargar();
    } catch(e) { showToast('error', e.message); }
    finally { setCreating(false); }
  };

  const descargar = async (filename) => {
    setDescargando(filename);
    try {
      const res = await fetch(`/api/backup/descargar/${filename}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Error al descargar');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch(e) { showToast('error', e.message); }
    finally { setDescargando(null); }
  };

  const restaurar = async () => {
    setRestSaving(true);
    try {
      const r = await apiFetch(`/api/backup/restaurar/${restoring.filename}`, { method:'POST' });
      setRestoring(null);
      setRestDone(true);
      showToast('success', r.message);
    } catch(e) { showToast('error', e.message); }
    finally { setRestSaving(false); }
  };

  if (restDone) return (
    <div style={{textAlign:'center',padding:'40px 20px'}}>
      <div style={{fontSize:64,marginBottom:16}}>🔄</div>
      <h2 style={{fontSize:22,fontWeight:800,marginBottom:12}}>Servidor cerrado</h2>
      <p style={{fontSize:15,color:'var(--text2)',lineHeight:1.7}}>
        La restauración fue preparada exitosamente.<br/>
        <strong>Reiniciá el servidor</strong> con <code style={{background:'var(--bg3)',padding:'2px 6px',borderRadius:4}}>npm start</code> y volvé a iniciar sesión.
      </p>
    </div>
  );

  return (
    <div>
      {toast.text && <div className={`alert alert-${toast.type}`} style={{cursor:'pointer'}} onClick={()=>setToast({type:'',text:''})}>{toast.text}</div>}

      {/* Header */}
      <div className="card" style={{marginBottom:14}}>
        <div className="section-header" style={{marginBottom:0}}>
          <div>
            <div className="card-title" style={{marginBottom:4}}>💾 Backup del sistema</div>
            <p style={{fontSize:12,color:'var(--text2)'}}>Backup automático semanal · Base de datos: epm.db</p>
          </div>
          <button className="btn btn-primary btn-auto" onClick={hacerBackup} disabled={creating}>
            {creating ? 'Creando…' : '💾 Hacer backup ahora'}
          </button>
        </div>
      </div>

      {/* Lista de backups */}
      <div className="card">
        <div className="card-title" style={{marginBottom:12}}>📋 Backups disponibles</div>
        {loading ? <div className="spinner"><div className="spin"/></div>
        : backups.length===0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💾</div>
            <p>No hay backups todavía. Creá uno con el botón de arriba.</p>
          </div>
        ) : backups.map(b => (
          <div key={b.filename} className="backup-item">
            <div style={{fontSize:28,flexShrink:0}}>🗄️</div>
            <div className="backup-fecha">
              <div className="backup-nombre">{formatFecha(b.fecha)}</div>
              <div className="backup-meta">{b.hora} · {formatSize(b.size)}</div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0,flexWrap:'wrap'}}>
              <button className="btn btn-secondary btn-auto"
                onClick={()=>descargar(b.filename)} disabled={descargando===b.filename}>
                {descargando===b.filename ? '⏳' : '⬇️ Descargar'}
              </button>
              <button className="btn btn-auto"
                style={{background:'#fee2e2',color:'var(--danger)',border:'1.5px solid #fca5a5'}}
                onClick={()=>setRestoring(b)}>
                🔄 Restaurar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal confirmación restaurar */}
      {restoring && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:520}}>
            <div className="modal-header">
              <span className="modal-title" style={{color:'var(--danger)'}}>⚠️ Restaurar backup</span>
              <button className="modal-close" onClick={()=>setRestoring(null)}>✕</button>
            </div>

            <div className="restore-warning">
              <div style={{fontSize:20,marginBottom:10,fontWeight:800}}>⚠️ ADVERTENCIA — LEER ANTES DE CONFIRMAR</div>
              <p style={{marginBottom:10,lineHeight:1.6}}>
                Esto va a <strong>reemplazar TODOS los datos actuales</strong> (estudiantes, asistencias,
                planificaciones, usuarios) con los del backup del <strong>{formatFecha(restoring.fecha)}</strong>.
              </p>
              <p style={{marginBottom:10,lineHeight:1.6}}>
                ✅ Antes de restaurar, se creará un <strong>backup automático del estado actual</strong> por seguridad.
              </p>
              <p style={{lineHeight:1.6}}>
                🔄 Después de restaurar, el <strong>servidor se cerrará</strong> y deberás iniciarlo manualmente
                con <code style={{background:'rgba(0,0,0,.1)',padding:'1px 5px',borderRadius:3}}>npm start</code>.
              </p>
            </div>

            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>
              Backup a restaurar: <strong>{restoring.filename}</strong> ({formatSize(restoring.size)})
            </p>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-auto" onClick={()=>setRestoring(null)}>Cancelar</button>
              <button className="btn btn-auto" disabled={restSaving}
                style={{background:'var(--danger)',color:'#fff',border:'none'}}
                onClick={restaurar}>
                {restSaving ? 'Restaurando…' : '⚠️ Sí, restaurar este backup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
