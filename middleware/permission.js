function requirePermiso(codigo) {
  return (req, res, next) => {
    if (!req.user?.permisos?.includes(codigo)) {
      return res.status(403).json({ error: `Permiso insuficiente: ${codigo}` });
    }
    next();
  };
}

module.exports = { requirePermiso };
