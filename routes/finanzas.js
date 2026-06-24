const express = require('express');
const router  = express.Router();
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');

// Módulo en construcción — la EPM está en trámite de CUIT
// Las tablas (movimientos_financieros, categorias_financieras) ya están creadas en la DB.
// Este archivo se activará cuando el módulo esté operativo.

router.get('/', verifyToken, requirePermiso('ver_finanzas'), (req, res) => {
  res.json({ estado: 'en_construccion', mensaje: 'Módulo de finanzas disponible próximamente.' });
});

module.exports = router;
