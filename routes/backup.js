const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');
const { backupDir, getDbPath, createBackupNow } = require('../utils/backup');

const VALID_FILE = /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/;
const sanitize   = s => s.replace(/[^a-zA-Z0-9_\-\.]/g, '');

// GET /api/backup/lista
router.get('/lista', verifyToken, requirePermiso('acceder_backup'), (req, res) => {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const files = fs.readdirSync(backupDir)
      .filter(f => VALID_FILE.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return {
          filename:   f,
          size:       stat.size,
          fecha:      f.slice(7, 17),           // YYYY-MM-DD
          hora:       f.slice(18, 26).replace(/-/g, ':'), // HH:MM:SS
          created_at: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(files);
  } catch(e) { res.json([]); }
});

// POST /api/backup/crear
router.post('/crear', verifyToken, requirePermiso('acceder_backup'), (req, res) => {
  try {
    const result = createBackupNow();
    res.json({ success: true, ...result });
  } catch(e) {
    res.status(500).json({ error: `Error al crear backup: ${e.message}` });
  }
});

// GET /api/backup/descargar/:filename
router.get('/descargar/:filename', verifyToken, requirePermiso('acceder_backup'), (req, res) => {
  const filename = sanitize(req.params.filename);
  if (!VALID_FILE.test(filename)) return res.status(400).json({ error: 'Nombre de archivo inválido' });
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup no encontrado' });
  res.download(filePath, filename);
});

// POST /api/backup/restaurar/:filename
// NOTA: cierra el servidor al final. El usuario debe reiniciarlo manualmente.
// FUTURO NUBE: aquí se descargaría el backup desde el storage antes de aplicarlo.
router.post('/restaurar/:filename', verifyToken, requirePermiso('acceder_backup'), (req, res) => {
  const filename = sanitize(req.params.filename);
  if (!VALID_FILE.test(filename)) return res.status(400).json({ error: 'Nombre de archivo inválido' });
  const srcPath = path.join(backupDir, filename);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Backup no encontrado' });

  try {
    // Backup de seguridad del estado actual antes de restaurar
    createBackupNow();

    // Copia el backup a un archivo de staging
    const stagingPath = getDbPath() + '.pending_restore';
    fs.copyFileSync(srcPath, stagingPath);

    res.json({
      success: true,
      message: 'Restauración preparada. El servidor se cerrará en 2 segundos. Reinicialo manualmente para aplicar el backup.',
    });

    // Después de enviar la respuesta: cerrar DB, swap de archivos, salir
    setTimeout(() => {
      try {
        const db = require('../db');
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        db.close(); // libera el lock del archivo en Windows
        fs.copyFileSync(stagingPath, getDbPath());
        try { fs.unlinkSync(stagingPath); } catch(e) {}
      } catch(e) { console.error('Error aplicando restore:', e.message); }
      console.log('🔄 Backup restaurado. Cerrando servidor para aplicar cambios...');
      process.exit(0);
    }, 2000);
  } catch(e) {
    res.status(500).json({ error: `Error al restaurar: ${e.message}` });
  }
});

module.exports = router;
