// ── FINANZAS (placeholder) ───────────────────────────────────────────────────────
function Finanzas() {
  return (
    <div className="construccion-wrap">
      <div className="construccion-icon">💰</div>
      <div className="construccion-titulo">Módulo de Finanzas</div>
      <div className="construccion-sub">
        Este módulo estará disponible próximamente.<br/>
        La EPM está completando los trámites de obtención del CUIT.
        Cuando esté listo, vas a poder registrar ingresos y egresos, generar reportes
        de balance e integrar pagos con Mercado Pago y facturación con AFIP.
      </div>
      <span className="badge-wip">🚧 En construcción</span>
      <div style={{marginTop:16,fontSize:12,color:'var(--text2)',maxWidth:360}}>
        Las tablas de datos ya están creadas en la base de datos y los permisos configurados.
        Solo falta activar la lógica cuando la institución obtenga el CUIT.
      </div>
    </div>
  );
}
