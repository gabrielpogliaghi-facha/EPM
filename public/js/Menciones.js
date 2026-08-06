// ── @MENCIONES (reutilizable: reuniones, legajo personal, asistencia) ─────────────
// Las menciones viven como texto plano dentro del campo ("...@Laura Martínez...").
// No hay marcado especial guardado — se detectan comparando contra los nombres
// completos de la lista de usuarios pasada al componente (misma lógica que el backend
// en utils/menciones.js).
function nombreCompletoUsuario(u) { return `${u.nombre || ''} ${u.apellido || ''}`.trim(); }

function useMencionables() {
  const [usuarios, setUsuarios] = useState([]);
  useEffect(() => { apiFetch('/api/usuarios/mencionables').then(setUsuarios).catch(() => {}); }, []);
  return usuarios;
}

function parseMenciones(texto, usuarios) {
  if (!texto) return [{ texto: '', mencion: null }];
  const candidatos = (usuarios || [])
    .map(u => ({ id: Number(u.id), nombre: nombreCompletoUsuario(u), rol_nombre: u.rol_nombre }))
    .filter(u => u.nombre)
    .sort((a, b) => b.nombre.length - a.nombre.length);
  if (candidatos.length === 0) return [{ texto, mencion: null }];

  const alt = candidatos.map(u => u.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`@(${alt})(?![\\p{L}\\p{N}])`, 'gu');
  const partes = [];
  let last = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > last) partes.push({ texto: texto.slice(last, m.index), mencion: null });
    partes.push({ texto: '@' + m[1], mencion: candidatos.find(u => u.nombre === m[1]) || null });
    last = re.lastIndex;
  }
  if (last < texto.length) partes.push({ texto: texto.slice(last), mencion: null });
  return partes;
}

function MencionChip({ nombre, usuario }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const cerrar = () => setOpen(false);
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [open]);
  return (
    <span className="mencion-chip-wrap">
      <span className="mencion-chip" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>{nombre}</span>
      {open && (
        <span className="mencion-tooltip" onClick={e => e.stopPropagation()}>
          {usuario?.rol_nombre || 'Usuario del sistema'}
        </span>
      )}
    </span>
  );
}

// Renderiza texto con las @menciones como chips clickeables.
function MencionesTexto({ texto, usuarios, className, style }) {
  const partes = parseMenciones(texto, usuarios);
  return (
    <span className={className} style={{whiteSpace:'pre-wrap', wordBreak:'break-word', ...style}}>
      {partes.map((p, i) => p.mencion
        ? <MencionChip key={i} nombre={p.texto} usuario={p.mencion} />
        : <React.Fragment key={i}>{p.texto}</React.Fragment>)}
    </span>
  );
}

// Input (textarea o input de una línea) con autocompletado de @menciones.
// `inputRef` es opcional — pasalo si otro control (ej. emoji picker) necesita
// escribir en el mismo campo manteniendo la posición del cursor.
function MencionInput({ value, onChange, usuarios, placeholder, rows, as, className, inputRef }) {
  const localRef = React.useRef(null);
  const ref = inputRef || localRef;
  const [dropdown, setDropdown] = useState(null); // { query, start }

  const detectarTrigger = (val, pos) => {
    const uptoCursor = val.slice(0, pos);
    const m = uptoCursor.match(/@([^\s@]*)$/);
    setDropdown(m ? { query: m[1], start: pos - m[1].length - 1 } : null);
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    detectarTrigger(e.target.value, e.target.selectionStart);
  };

  const seleccionar = (u) => {
    const nombre = nombreCompletoUsuario(u);
    const el = ref.current;
    const pos = el ? el.selectionStart : value.length;
    const before = value.slice(0, dropdown.start);
    const after  = value.slice(pos);
    const inserted = `@${nombre} `;
    onChange(before + inserted + after);
    setDropdown(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const p = before.length + inserted.length;
      el.selectionStart = el.selectionEnd = p;
    });
  };

  const filtrados = dropdown
    ? (usuarios || []).filter(u => nombreCompletoUsuario(u).toLowerCase().includes((dropdown.query || '').toLowerCase())).slice(0, 6)
    : [];

  const Tag = as === 'input' ? 'input' : 'textarea';
  const extra = as === 'input' ? {} : { rows: rows || 3 };

  return (
    <div className="mencion-input-wrap">
      <Tag ref={ref} className={className || 'form-control'} value={value} placeholder={placeholder}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setDropdown(null), 150)}
        {...extra} />
      {dropdown && (
        <div className="mencion-dropdown">
          {filtrados.length === 0
            ? <div className="mencion-dropdown-empty">Sin coincidencias</div>
            : filtrados.map(u => (
              <button type="button" key={u.id} className="mencion-dropdown-item"
                onMouseDown={e => e.preventDefault()} onClick={() => seleccionar(u)}>
                <span className="mencion-dropdown-avatar">{iniciales(u.nombre, u.apellido)}</span>
                <span>
                  <div style={{fontWeight:700}}>{nombreCompletoUsuario(u)}</div>
                  {u.rol_nombre && <div style={{fontSize:11,color:'var(--text2)'}}>{u.rol_nombre}</div>}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
