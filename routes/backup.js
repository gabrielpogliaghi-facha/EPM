const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { verifyToken }    = require('../middleware/auth');
const { requirePermiso } = require('../middleware/permission');
const { backupDir, getDbPath, createBackupNow, IS_TURSO } = require('../utils/backup');

const VALID_FILE = /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/;
const sanitize   = s => s.replace(/[^a-zA-Z0-9_\-\.]/g, '');

// GET /api/backup/lista
router.get('/lista', verifyToken, requirePermiso('acceder_backup'), (req, res) => {
  if (IS_TURSO) return res.json({ turso: true, files: [] });
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const files = fs.readdirSync(backupDir)
      .filter(f => VALID_FILE.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return {
          filename:   f,
          size:       stat.size,
          fecha:      f.slice(7, 17),
          hora:       f.slice(18, 26).replace(/-/g, ':'),
          created_at: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(files);
  } catch(e) { res.json([]); }
});

// POST /api/backup/crear
router.post('/crear', verifyToken, requirePermiso('acceder_backup'), async (req, res) => {
  if (IS_TURSO) return res.status(503).json({ error: 'Backup de archivos no disponible en modo nube. Usá el panel de Turso.' });
  try {
    const result = await createBackupNow();
    res.json({ success: true, ...result });
  } catch(e) {
    res.status(500).json({ error: `Error al crear backup: ${e.message}` });
  }
});

// GET /api/backup/descargar/:filename
router.get('/descargar/:filename', verifyToken, requirePermiso('acceder_backup'), (req, res) => {
  if (IS_TURSO) return res.status(503).json({ error: 'No disponible en modo nube.' });
  const filename = sanitize(req.params.filename);
  if (!VALID_FILE.test(filename)) return res.status(400).json({ error: 'Nombre de archivo inválido' });
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup no encontrado' });
  res.download(filePath, filename);
});

// POST /api/backup/restaurar/:filename
router.post('/restaurar/:filename', verifyToken, requirePermiso('acceder_backup'), async (req, res) => {
  if (IS_TURSO) return res.status(503).json({ error: 'Restauración no disponible en modo nube.' });
  const filename = sanitize(req.params.filename);
  if (!VALID_FILE.test(filename)) return res.status(400).json({ error: 'Nombre de archivo inválido' });
  const srcPath = path.join(backupDir, filename);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Backup no encontrado' });

  try {
    await createBackupNow();

    const stagingPath = getDbPath() + '.pending_restore';
    fs.copyFileSync(srcPath, stagingPath);

    res.json({
      success: true,
      message: 'Restauración preparada. El servidor se cerrará en 2 segundos. Reinicialo manualmente para aplicar el backup.',
    });

    setTimeout(async () => {
      try {
        const db = require('../db');
        try { await db.execute('PRAGMA wal_checkpoint(TRUNCATE)'); } catch(e) {}
        db.close();
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
